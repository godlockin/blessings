import { GoogleGenAI, Part } from "@google/genai";

interface Env {
  INVITE_CODE: string;
  GEMINI_API_KEY: string;
  OSS_REGION: string;
  OSS_ACCESS_KEY_ID: string;
  OSS_ACCESS_KEY_SECRET: string;
  OSS_BUCKET: string;
  OSS_ENDPOINT?: string;
  OSS_PREFIX?: string;
  ENVIRONMENT?: string;
}

interface ProcessRequest {
  image: string;
  inviteCode: string;
}

// Constants for optimization
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const BASE64_CHUNK_SIZE = 8000; // Optimal chunk size for streaming
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const REQUEST_TIMEOUT = 300000; // 5 minutes
const MEMORY_CLEANUP_INTERVAL = 5000; // 5 seconds

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Utility functions for security
const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>&'&]/g, '');
};

const validateBase64 = (base64: string): boolean => {
  try {
    return base64.length > 0 && base64.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(base64);
  } catch {
    return false;
  }
};

const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));



async function sign(secret: string, data: string): Promise<string> {
  if (!secret || !data) {
    throw new Error('Missing required parameters for signing');
  }
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function safeBase64ToUint8Array(base64Data: string): Promise<Uint8Array> {
  try {
    const cleanBase64 = base64Data.replace(/\s/g, '');
    if (!validateBase64(cleanBase64)) {
      throw new Error('Invalid base64 data format');
    }
    
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    
    // Use more efficient conversion
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  } catch (error) {
    throw new Error(`Base64 conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function createRetryableOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = RETRY_DELAY_BASE
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = async (retryCount: number): Promise<void> => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        if (retryCount >= maxRetries) {
          reject(error);
          return;
        }
        
        const delay = baseDelay * Math.pow(2, retryCount);
        await sleep(delay);
        attempt(retryCount + 1);
      }
    };
    
    attempt(0);
  });
}

async function uploadToOSS(env: Env, filename: string, base64Data: string): Promise<string | null> {
  const uploadOperation = async (): Promise<string> => {
    const date = new Date().toUTCString();
    const endpoint = env.OSS_ENDPOINT || `${env.OSS_REGION}.aliyuncs.com`;
    const host = `${env.OSS_BUCKET}.${endpoint}`;
    const url = `https://${host}/${filename}`;
    const resourcePath = `/${env.OSS_BUCKET}/${filename}`;
    const contentType = "image/png";

    const stringToSign = `PUT\n\n${contentType}\n${date}\n${resourcePath}`;
    const signature = await sign(env.OSS_ACCESS_KEY_SECRET, stringToSign);
    const auth = `OSS ${env.OSS_ACCESS_KEY_ID}:${signature}`;

    const bytes = await safeBase64ToUint8Array(base64Data);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'Date': date,
        'Content-Type': contentType,
        'Host': host,
        'User-Agent': 'blessings-img/1.0'
      },
      body: bytes,
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OSS upload failed: ${response.status} ${text}`);
    }

    return url;
  };

  try {
    return await createRetryableOperation(uploadOperation);
  } catch (error) {
    console.error("OSS Upload Error:", error);
    return null;
  }
}

interface CloudflareContext {
  request: {
    json: () => Promise<unknown>;
    cf?: Record<string, unknown>;
  };
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<void>) => void;
  passThroughOnException: () => void;
}

export const onRequestPost = async (context: CloudflareContext) => {
  const { request, env } = context;

  // Security headers
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'"
  };

  // Create a TransformStream for SSE with error handling
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Memory cleanup interval
  let cleanupInterval: NodeJS.Timeout | null = null;

  // Helper to send SSE events with error handling
  const sendEvent = async (event: string, data: unknown): Promise<void> => {
    try {
      const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(eventData));
    } catch (error) {
      console.error('Failed to send SSE event:', error);
      throw error;
    }
  };

  // Memory cleanup function
  const startMemoryCleanup = (): void => {
    cleanupInterval = setInterval(() => {
      // Force garbage collection hint - only in development
      // In production, rely on Cloudflare's automatic GC
      const g = globalThis as typeof globalThis & { gc?: () => void };
      if (g.gc && env.ENVIRONMENT !== 'production') {
        g.gc();
      }
    }, MEMORY_CLEANUP_INTERVAL);
  };

  const stopMemoryCleanup = (): void => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  };

  // Process in background with timeout
  const processWithTimeout = async (): Promise<void> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout')), REQUEST_TIMEOUT);
    });

    const processingPromise = processImage(
      // @ts-expect-error - Cloudflare Request type compatibility
      request,
      env,
      sendEvent,
      writer
    );
    
    await Promise.race([processingPromise, timeoutPromise]);
  };

  // Main processing function
  const processImage = async (
    request: Request,
    env: Env,
    sendEvent: (event: string, data: unknown) => Promise<void>,
    writer: WritableStreamDefaultWriter<Uint8Array>
  ): Promise<void> => {
    try {
      startMemoryCleanup();
      
      const body = await request.json() as ProcessRequest;
      
      // Validate and sanitize input
      if (!body.inviteCode || !body.image) {
        await sendEvent('error', { message: 'Missing required parameters' });
        return;
      }

      const sanitizedCode = sanitizeInput(body.inviteCode);

      // 1. Verify Invite Code (use constant-time comparison)
      const isValidCode = constantTimeCompare(sanitizedCode, env.INVITE_CODE);
      if (!isValidCode) {
        await sendEvent('error', { message: 'Invalid invite code' });
        return;
      }

      // Validate image data
      if (!validateBase64(body.image)) {
        await sendEvent('error', { message: 'Invalid image data format' });
        return;
      }

      // Check image size
      const imageSize = Math.floor(body.image.length * 0.75); // Approximate size
      if (imageSize > MAX_IMAGE_SIZE) {
        await sendEvent('error', { message: 'Image size exceeds limit' });
        return;
      }

      // Initialize Gemini with error handling
      if (!env.GEMINI_API_KEY) {
        await sendEvent('error', { message: 'AI service configuration error' });
        return;
      }

      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const model = "gemini-3-pro-preview";

      const imagePart: Part = {
        inlineData: {
          data: body.image,
          mimeType: "image/jpeg"
        }
      };

      // 2. Audit Image (Expert 1)
      await sendEvent('step', { id: 'audit', status: 'processing' });

      const auditPrompt = "你是一个图片审核专家。请审核这张图片是否包含清晰的人物，且适合用于生成中国新年祝福照片。如果通过，请只回答'PASS'，否则回答'FAIL'并说明原因。";
      
      const auditOperation = async (): Promise<string> => {
        const auditResult = await ai.models.generateContent({
          model: model,
          contents: [{
            role: 'user',
            parts: [{ text: auditPrompt }, imagePart]
          }]
        });
        return auditResult.text?.trim() || "";
      };

      let auditText: string;
      try {
        auditText = await createRetryableOperation(auditOperation);
      } catch (e) {
        console.warn("Audit failed, proceeding anyway...", e);
        auditText = "PASS"; // Fail open for better UX
      }

      if (!auditText.toUpperCase().startsWith("PASS")) {
        await sendEvent('error', { message: `Image audit failed: ${auditText}` });
        return;
      }
      await sendEvent('step', { id: 'audit', status: 'completed' });

      // 3. Analyze Image (Expert 2)
      await sendEvent('step', { id: 'analysis', status: 'processing' });

      const analysisPrompt = "你是一个照片分析专家。请分析这张照片中的人物特征（性别、年龄、表情、发型、衣着等），并以简洁的文本描述这些特征，用于后续生成prompt。";
      
      const analysisOperation = async (): Promise<string> => {
        const result = await ai.models.generateContent({
          model: model,
          contents: [{
            role: 'user',
            parts: [{ text: analysisPrompt }, imagePart]
          }]
        });
        return result.text || "";
      };

      const analysisText = await createRetryableOperation(analysisOperation);
      await sendEvent('step', { id: 'analysis', status: 'completed' });

      // 4. Generate Prompt (Expert 3)
      await sendEvent('step', { id: 'prompt', status: 'processing' });

      const promptGenPrompt = `你是一个Prompt专家。根据以下人物特征，生成一个用于生成中国新年祝福照片的英文Prompt。
      人物特征：${analysisText}
      要求：
      1. 保持人物主要特征（如性别、年龄、族裔特点），确保人物具有高辨识度，亲友能认出是本人。
      2. 智能美颜优化：保留皮肤纹理和毛孔细节，不过度磨皮；自然真实的光影过渡；针对不同肤质（特别是外国人）保持真实的肤质特点，不强制改变为亚洲人风格。
      3. 背景为中国新年氛围（红色、灯笼、烟花等）。
      4. 人物穿着喜庆的中国传统服饰或现代红色系服饰。
      5. 动作：双手抱拳作揖（中国传统拜年姿势），保持全身构图。
      6. 风格：**iPhone 16 Pro Max 真实摄影风格** - 保留皮肤纹理和毛孔细节，不过度磨皮；自然真实的光影过渡，智能HDR高光处理；色彩真实自然，白平衡准确；景深效果自然，主体清晰背景虚化适中；整体效果要像用手机近距离实拍的，真实自然有生活感。
      请只输出英文Prompt内容，不要包含其他解释。`;

      const promptOperation = async (): Promise<string> => {
        const result = await ai.models.generateContent({
          model: model,
          contents: [{ role: 'user', parts: [{ text: promptGenPrompt }] }]
        });
        return result.text || "";
      };

      const generatedPrompt = await createRetryableOperation(promptOperation);
      await sendEvent('step', { id: 'prompt', status: 'completed' });

      // 5. Generate Image (Expert 4 - The Generator)
      await sendEvent('step', { id: 'generation', status: 'processing' });

      const imageOperation = async (): Promise<string> => {
        const imageModel = 'gemini-3-pro-image-preview';
        const imageConfig = {
          responseModalities: ['IMAGE'],
          imageConfig: {
            imageSize: '1K',
            aspectRatio: '9:16',
          }
        };
        const imageContents = [
          {
            role: 'user',
            parts: [
              { text: generatedPrompt },
              imagePart
            ]
          }
        ];

        const imageResponse = await ai.models.generateContent({
          model: imageModel,
          config: imageConfig,
          contents: imageContents
        });

        const candidate = imageResponse.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (!part?.inlineData?.data) {
          throw new Error("No image data found in AI response");
        }

        return part.inlineData.data;
      };

      const generatedImageBase64 = await createRetryableOperation(imageOperation);
      await sendEvent('step', { id: 'generation', status: 'completed' });

      // 6. Review Image (Expert 5)
      await sendEvent('step', { id: 'review', status: 'processing' });

      const reviewPart: Part = {
        inlineData: {
          data: generatedImageBase64,
          mimeType: "image/png"
        }
      };
      
      const reviewPrompt = "你是一个图片质量审核专家。请审核这张生成的图片是否符合'中国新年祝福'的主题，且没有明显的畸变或质量问题。如果通过，请回答'PASS'，否则回答'FAIL'。";
      
      const reviewOperation = async (): Promise<string> => {
        const result = await ai.models.generateContent({
          model: model,
          contents: [{
            role: 'user',
            parts: [{ text: reviewPrompt }, reviewPart]
          }]
        });
        return result.text?.trim() || "";
      };

      try {
        const reviewText = await createRetryableOperation(reviewOperation);

        if (!reviewText.toUpperCase().startsWith("PASS")) {
          console.warn(`Image review warning: ${reviewText}`);
          // Continue with warning rather than failing for better UX
        }
      } catch (e) {
        console.warn("Image review failed, proceeding anyway...", e);
      }
      
      await sendEvent('step', { id: 'review', status: 'completed' });

      // 7. Upload to OSS (non-blocking)
      const uploadAndStream = async (): Promise<void> => {
        try {
          const now = new Date();
          const timestamp = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');

          const batchId = `${timestamp}_${crypto.randomUUID()}`;
          const prefix = env.OSS_PREFIX ? `${env.OSS_PREFIX}/${batchId}` : batchId;

          // Upload original image (fire and forget)
          const originalFilename = `${prefix}/original.jpg`;
          uploadToOSS(env, originalFilename, body.image).catch(err => {
            console.warn("Original image upload failed:", err);
          });

          // Upload generated image (fire and forget)
          const generatedFilename = `${prefix}/generated.png`;
          uploadToOSS(env, generatedFilename, generatedImageBase64).catch(err => {
            console.warn("Generated image upload failed:", err);
          });

          // Stream image to client with optimized chunks
          const totalLength = generatedImageBase64.length;
          let offset = 0;

          while (offset < totalLength) {
            const chunk = generatedImageBase64.slice(offset, offset + BASE64_CHUNK_SIZE);
            await sendEvent('image_chunk', { chunk });
            offset += BASE64_CHUNK_SIZE;
            
            // Small delay to prevent overwhelming the client
            await sleep(10);
          }

          // Send completion event
          await sendEvent('complete', { status: 'done' });
        } catch (error) {
          console.error('Upload/stream error:', error);
          // Don't fail the whole process if upload fails
        }
      };

      await uploadAndStream();

    } catch (error: unknown) {
      console.error("Process Error:", error);
      const message = error instanceof Error ? error.message : 'Processing failed';
      await sendEvent('error', { message });
    } finally {
      stopMemoryCleanup();
      await writer.close();
    }
  };

  // Handle the processing
  processWithTimeout()
    .catch(async (error) => {
      console.error("Processing timeout or error:", error);
      try {
        await sendEvent('error', { 
          message: error instanceof Error ? error.message : 'Processing failed' 
        });
      } catch (sseError) {
        console.error("Failed to send error event:", sseError);
      }
      await writer.close();
    })
    .finally(() => {
      stopMemoryCleanup();
    });

  return new Response(readable, { headers });
};

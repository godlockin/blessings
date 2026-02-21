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

type DeityOption = 'none' | 'wealth' | 'love' | 'mercy' | 'career' | 'blessing';

interface DeityConfig {
  name: string;
  costume: string;
  pose: string;
  prompt: string;
}

const DEITY_CONFIGS: Record<DeityOption, DeityConfig> = {
  none: {
    name: '无',
    costume: '喜庆的新年服饰',
    pose: '双手抱拳作揖',
    prompt: ''
  },
  wealth: {
    name: '武财神关羽',
    costume: '红色喜庆服饰，象征红红火火',
    pose: '与关羽并排站立，两人同时双手抱拳作揖拜年',
    prompt: `在人物身旁绘制武财神关羽，与人物并排站立：
      - 关羽形象：红脸长须（标志性美髯）、丹凤眼、头戴绿巾或武官帽、身穿绿色战袍或锦袍、手持青龙偃月刀
      - 关羽动作：双手抱拳作揖，与人物一起拜年
      - 两人一起拱手作揖，展现"文武财神同贺新春"的喜庆场景
      - 关羽表情威严而慈祥，带有节日喜气
      - 人物穿着：红色或金色的喜庆新年服饰，象征财运亨通`
  },
  love: {
    name: '月老',
    costume: '粉色或红色系的温婉服饰',
    pose: '与月老相对而立，双手合十或抱拳，表达虔诚祈愿',
    prompt: `在人物身旁绘制月老，与人物相对而立：
      - 月老形象：白发长须、面容慈祥、手持红线团和姻缘簿、身穿红色或粉色长袍
      - 月老动作：一手持红线，一手轻抚胡须，微笑注视人物
      - 两人之间可有红色姻缘线轻轻相连
      - 人物穿着：粉色或红色系的温婉服饰，象征爱情甜蜜
      - 背景可增加桃花、鸳鸯等爱情元素`
  },
  mercy: {
    name: '观音菩萨',
    costume: '素雅端庄的白色或淡蓝色服饰',
    pose: '双手合十虔诚礼拜，或一手持莲一手合十',
    prompt: `在人物身旁绘制观音菩萨，与人物并肩或略前：
      - 观音形象：面容慈悲庄严、头戴宝冠、手持净瓶杨柳或莲花、身穿白色或淡蓝色飘逸长裙
      - 观音动作：手持净瓶洒下甘露，或手持莲花慈悲注视
      - 人物动作：双手合十虔诚礼拜
      - 人物穿着：素雅端庄的白色或淡蓝色服饰
      - 背景可增加祥云、莲花、佛光等圣洁元素`
  },
  career: {
    name: '文曲星',
    costume: '书卷气的蓝色或青色长衫',
    pose: '与文曲星并肩，手持书卷或笔，作揖或拱手',
    prompt: `在人物身旁绘制文曲星君，与人物并肩而立：
      - 文曲星形象：面容儒雅、头戴官帽或书生巾、手持毛笔或书卷、身穿蓝色或青色官服或长衫
      - 文曲星动作：手持毛笔指点江山，或手持书卷微笑
      - 两人并肩而立，可共同探讨书卷
      - 人物穿着：书卷气的蓝色或青色长衫，象征文运昌隆
      - 背景可增加书卷、笔墨、文昌塔等文运元素`
  },
  blessing: {
    name: '福神',
    costume: '大红色喜庆服饰，可带金色装饰',
    pose: '与福神同向站立，一起伸手送福或同时作揖',
    prompt: `在人物身旁绘制福神，与人物同向站立：
      - 福神形象：面容圆润喜庆、笑容可掬、手持"福"字或如意、身穿大红色锦袍、头戴福字帽
      - 福神动作：手持大福字，或双手捧如意，笑容满面
      - 两人一起向镜头送福，或同时作揖拜年
      - 人物穿着：大红色喜庆服饰，可带金色装饰，象征福气满满
      - 背景可增加蝙蝠（福）、如意、金元宝等福运元素`
  }
};

interface ProcessRequest {
  image: string;
  inviteCode: string;
  selectedDeity?: DeityOption;
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
    console.log(`[OSS] Signing request: ${stringToSign}`);
    console.log(`[OSS] Using endpoint: ${endpoint}, bucket: ${env.OSS_BUCKET}`);
    console.log(`[OSS] Filename: ${filename}`);

    const signature = await sign(env.OSS_ACCESS_KEY_SECRET, stringToSign);
    const auth = `OSS ${env.OSS_ACCESS_KEY_ID}:${signature}`;

    const bytes = await safeBase64ToUint8Array(base64Data);
    console.log(`[OSS] Uploading ${bytes.length} bytes to ${url}`);

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
      console.error(`[OSS] Upload failed: ${response.status} ${text}`);
      throw new Error(`OSS upload failed: ${response.status} ${text}`);
    }

    console.log(`[OSS] Upload successful: ${response.status}`);
    return url;
  };

  try {
    return await createRetryableOperation(uploadOperation);
  } catch (error) {
    console.error("[OSS] Upload Error:", error);
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
  const { request, env, waitUntil } = context;

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

      // Get deity configuration
      const selectedDeity: DeityOption = body.selectedDeity || 'none';
      const deityConfig = DEITY_CONFIGS[selectedDeity];

      const deityInstruction = selectedDeity !== 'none'
        ? `特别彩蛋 - 与${deityConfig.name}合影：
      ${deityConfig.prompt}
      - 构图确保人物和${deityConfig.name}都清晰可见，互动自然，画面和谐
      - 人物服饰要求：${deityConfig.costume}
      - 人物姿势要求：${deityConfig.pose}`
        : '';

      const promptGenPrompt = `你是一个Prompt专家。根据以下人物特征，生成一个用于生成中国新年祝福照片的英文Prompt。
      人物特征：${analysisText}
      要求：
      1. 保持人物主要特征（如性别、年龄、族裔特点），确保人物具有高辨识度，亲友能认出是本人。
      2. 智能美颜优化：保留皮肤纹理和毛孔细节，不过度磨皮；自然真实的光影过渡；针对不同肤质（特别是外国人）保持真实的肤质特点，不强制改变为亚洲人风格。
      3. 背景为中国新年氛围（红色、灯笼、烟花等）。
      ${selectedDeity === 'none' ? '4. 人物穿着喜庆的中国传统服饰或现代红色系服饰。\n      5. 动作：双手抱拳作揖（中国传统拜年姿势），保持全身构图。' : `4. 人物穿着：${deityConfig.costume}
      5. 人物姿势：${deityConfig.pose}，保持全身构图。`}
      6. 风格：**iPhone 16 Pro Max 真实摄影风格** - 保留皮肤纹理和毛孔细节，不过度磨皮；自然真实的光影过渡，智能HDR高光处理；色彩真实自然，白平衡准确；景深效果自然，主体清晰背景虚化适中；整体效果要像用手机近距离实拍的，真实自然有生活感。
      ${deityInstruction}
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

          console.log(`[OSS] Starting upload with prefix: ${prefix}`);

          // Upload original image (fire and forget)
          const originalFilename = `${prefix}/original.jpg`;
          console.log(`[OSS] Uploading original image: ${originalFilename}`);
          const originalUploadPromise = uploadToOSS(env, originalFilename, body.image)
            .then(url => {
              if (url) {
                console.log(`[OSS] Original image uploaded successfully: ${url}`);
              } else {
                console.warn(`[OSS] Original image upload returned null`);
              }
            })
            .catch(err => {
              console.warn("[OSS] Original image upload failed:", err);
            });

          // Upload generated image (fire and forget)
          const generatedFilename = `${prefix}/generated.png`;
          console.log(`[OSS] Uploading generated image: ${generatedFilename}`);
          const generatedUploadPromise = uploadToOSS(env, generatedFilename, generatedImageBase64)
            .then(url => {
              if (url) {
                console.log(`[OSS] Generated image uploaded successfully: ${url}`);
              } else {
                console.warn(`[OSS] Generated image upload returned null`);
              }
            })
            .catch(err => {
              console.warn("[OSS] Generated image upload failed:", err);
            });

          // Use waitUntil to ensure uploads complete even after response is sent
          if (waitUntil) {
            waitUntil(originalUploadPromise.then(() => {}));
            waitUntil(generatedUploadPromise.then(() => {}));
          }

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
          console.error('[OSS] Upload/stream error:', error);
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

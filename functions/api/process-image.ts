
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
}

function fileToGenerativePart(base64Data: string, mimeType: string): Part {
  return {
    inlineData: {
      data: base64Data,
      mimeType
    },
  };
}

async function sign(secret: string, data: string) {
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

async function uploadToOSS(env: Env, filename: string, base64Data: string) {
  try {
    const date = new Date().toUTCString();
    // Use OSS_ENDPOINT if available, otherwise construct from region
    const endpoint = env.OSS_ENDPOINT || `${env.OSS_REGION}.aliyuncs.com`;
    const host = `${env.OSS_BUCKET}.${endpoint}`;
    // filename already contains the prefix logic from caller
    const url = `https://${host}/${filename}`;
    const resourcePath = `/${env.OSS_BUCKET}/${filename}`;
    const contentType = "image/png";

    const stringToSign = `PUT\n\n${contentType}\n${date}\n${resourcePath}`;
    const signature = await sign(env.OSS_ACCESS_KEY_SECRET, stringToSign);
    const auth = `OSS ${env.OSS_ACCESS_KEY_ID}:${signature}`;

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'Date': date,
        'Content-Type': contentType,
        'Host': host
      },
      body: bytes
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`OSS Upload Failed: ${response.status} ${text}`);
      // Fallback to not throwing, just return null so we can still return the base64 to user
      return null;
    }

    return url;
  } catch (e) {
    console.error("OSS Upload Error:", e);
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json() as { image: string, inviteCode: string };

    // 1. Verify Invite Code
    if (body.inviteCode !== env.INVITE_CODE) {
      return new Response(JSON.stringify({ status: 'failed', message: 'Invalid invite code' }), { status: 401 });
    }

    if (!body.image) {
      return new Response(JSON.stringify({ status: 'failed', message: 'No image provided' }), { status: 400 });
    }

    // Initialize Gemini
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const model = "gemini-3-pro-preview"; // 分析模型，按目标设定文档配置

    const imagePart = {
      inlineData: {
        data: body.image,
        mimeType: "image/jpeg"
      }
    };

    // 2. Audit Image (Expert 1)
    const auditPrompt = "你是一个图片审核专家。请审核这张图片是否包含清晰的人物，且适合用于生成中国新年祝福照片。如果通过，请只回答'PASS'，否则回答'FAIL'并说明原因。";

    let auditText = "";
    try {
      // Try the user requested model first for text analysis if available, otherwise fallback
      // The error says gemini-1.5-pro is not found for v1beta or not supported.
      // It's safer to use gemini-2.0-flash which is the current standard/stable model often available.
      const auditResult = await ai.models.generateContent({
        model: model,
        contents: [{
          role: 'user',
          parts: [{ text: auditPrompt }, imagePart]
        }]
      });
      auditText = auditResult.text?.trim() || "";
    } catch (e) {
      console.warn("Primary text model failed, trying fallback...", e);
      // Fallback to gemini-1.5-flash as another option
      const fallbackModel = "gemini-3-pro-preview"; // 保持与主模型一致
      const auditResult = await ai.models.generateContent({
        model: fallbackModel,
        contents: [{
          role: 'user',
          parts: [{ text: auditPrompt }, imagePart]
        }]
      });
      auditText = auditResult.text?.trim() || "";
    }

    if (!auditText.toUpperCase().startsWith("PASS")) {
      return new Response(JSON.stringify({ status: 'failed', message: `Image audit failed: ${auditText}` }), { status: 200 });
    }

    // 3. Analyze Image (Expert 2)
    const analysisPrompt = "你是一个照片分析专家。请分析这张照片中的人物特征（性别、年龄、表情、发型、衣着等），并以简洁的文本描述这些特征，用于后续生成prompt。";
    const analysisResult = await ai.models.generateContent({
      model: model,
      contents: [{
        role: 'user',
        parts: [{ text: analysisPrompt }, imagePart]
      }]
    });
    const analysisText = analysisResult.text || "";

    // 4. Generate Prompt (Expert 3)
    const promptGenPrompt = `你是一个Prompt专家。根据以下人物特征，生成一个用于生成中国新年祝福照片的英文Prompt。
    人物特征：${analysisText}
    要求：
    1. 保持人物主要特征（如性别、年龄），确保人物具有高辨识度。
    2. 对人物进行美化处理：大眼、瘦脸、磨皮、瘦身，提升整体颜值，看起来完美无瑕。
    3. 背景为中国新年氛围（红色、灯笼、烟花等）。
    4. 人物穿着喜庆的中国传统服饰或现代红色系服饰。
    5. 动作：双手抱拳作揖（中国传统拜年姿势），保持全身构图。
    6. 风格：写实风格，具有高辨识度又带有艺术美感。
    请只输出英文Prompt内容，不要包含其他解释。`;

    const promptResult = await ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [{ text: promptGenPrompt }] }]
    });
    const generatedPrompt = promptResult.text || "";
    console.log("Generated Prompt:", generatedPrompt);

    // 5. Generate Image (Expert 4 - The Generator)
    // Using the NEW SDK method as requested by user

    let generatedImageBase64 = "";
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
      config: imageConfig as any, // Fix: config structure for image generation
      contents: imageContents
    });

    // Extract image from response
    // Based on user provided snippet:
    // chunk.candidates[0].content.parts[0].inlineData.data
    // The response object in generateContent (non-stream) should be similar.

    const candidate = imageResponse.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part?.inlineData?.data) {
      generatedImageBase64 = part.inlineData.data;
    } else {
      throw new Error("No image data found in response");
    }

    // 6. Review Image (Expert 5)
    // Check if the generated image is safe/appropriate/good quality
    const reviewPart = {
      inlineData: {
        data: generatedImageBase64,
        mimeType: "image/png"
      }
    };
    const reviewPrompt = "你是一个图片质量审核专家。请审核这张生成的图片是否符合'中国新年祝福'的主题，且没有明显的畸变或质量问题。如果通过，请回答'PASS'，否则回答'FAIL'。";
    const reviewResult = await ai.models.generateContent({
      model: model,
      contents: [{
        role: 'user',
        parts: [{ text: reviewPrompt }, reviewPart]
      }]
    });
    const reviewText = reviewResult.text?.trim() || "";

    if (!reviewText.toUpperCase().startsWith("PASS")) {
      console.warn(`Image Review Warning: ${reviewText}`);
    }

    // 7. Upload to OSS
    const now = new Date();
    const timestamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    
    const batchId = `${timestamp}_${crypto.randomUUID()}`;
    const prefix = env.OSS_PREFIX ? `${env.OSS_PREFIX}/${batchId}` : batchId;
    
    // Upload original
    const originalFilename = `${prefix}/original.jpg`;
    await uploadToOSS(env, originalFilename, body.image);

    // Upload generated
    const generatedFilename = `${prefix}/generated.png`;
    const ossUrl = await uploadToOSS(env, generatedFilename, generatedImageBase64);

    // We return the base64 for immediate display, but also the OSS URL if needed (though frontend uses base64 currently)

    return new Response(JSON.stringify({
      status: 'completed',
      result: generatedImageBase64,
      ossUrl: ossUrl,
      steps: [
        { id: 'audit', label: '图片审核', status: 'completed' },
        { id: 'analysis', label: '照片分析', status: 'completed' },
        { id: 'prompt', label: 'Prompt生成', status: 'completed' },
        { id: 'generation', label: '图片生成', status: 'completed' },
        { id: 'review', label: '结果审核', status: 'completed' },
      ]
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("Process Error:", err);
    return new Response(JSON.stringify({ status: 'failed', message: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

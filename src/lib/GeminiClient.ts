import { GoogleGenAI, Part } from '@google/genai';
import { AI_CONFIG } from './Config';

export class GeminiClient {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = AI_CONFIG.MODEL_NAME;
  }

  async generateContent(
    prompt: string,
    imagePart?: Part,
    options?: {
      model?: string;
      responseModalities?: string[];
      imageSize?: string;
      aspectRatio?: string;
    }
  ): Promise<string> {
    const model = options?.model || this.model;
    const contents = imagePart
      ? [{ role: 'user' as const, parts: [{ text: prompt }, imagePart] }]
      : [{ role: 'user' as const, parts: [{ text: prompt }] }];

    const config: Record<string, unknown> = {};
    if (options?.responseModalities) {
      config.responseModalities = [...options.responseModalities];
    }
    if (options?.imageSize) {
      config.imageSize = options.imageSize;
    }
    if (options?.aspectRatio) {
      config.aspectRatio = options.aspectRatio;
    }

    const generateConfig = Object.keys(config).length > 0 ? config : {};

    const response = await this.client.models.generateContent({
      model,
      contents,
      config: generateConfig,
    });

    return response.text || '';
  }

  async generateImage(prompt: string, imagePart: Part): Promise<string> {
    return this.generateContent(prompt, imagePart, {
      model: AI_CONFIG.IMAGE_MODEL_NAME,
      responseModalities: ['IMAGE'] as string[],
      imageSize: AI_CONFIG.IMAGE_SIZE,
      aspectRatio: AI_CONFIG.ASPECT_RATIO,
    });
  }
}

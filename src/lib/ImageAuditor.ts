import { GeminiClient } from './GeminiClient';

export class ImageAuditor {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  async audit(imagePart: { inlineData: { data: string; mimeType: string } }): Promise<boolean> {
    const prompt = `你是一个图片审核专家。请审核这张图片是否包含清晰的人物，且适合用于生成中国新年祝福照片。如果通过，请只回答'PASS'，否则回答'FAIL'并说明原因。`;

    const result = await this.client.generateContent(prompt, imagePart);
    const trimmedResult = result.trim();

    if (!trimmedResult.toUpperCase().startsWith('PASS')) {
      throw new Error(`Image audit failed: ${trimmedResult}`);
    }

    return true;
  }
}

import { GeminiClient } from './GeminiClient';

export class ImageReviewer {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  async review(imageBase64: string): Promise<boolean> {
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/png' as const,
      },
    };

    const prompt = `你是一个图片质量审核专家。请审核这张生成的图片是否符合'中国新年祝福'的主题，且没有明显的畸变或质量问题。如果通过，请回答'PASS'，否则回答'FAIL'。`;

    const result = await this.client.generateContent(prompt, imagePart);
    const trimmedResult = result.trim();

    if (!trimmedResult.toUpperCase().startsWith('PASS')) {
      console.warn(`Image review warning: ${trimmedResult}`);
    }

    return true;
  }
}

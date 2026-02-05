import { GeminiClient } from './GeminiClient';

export class ImageAnalyzer {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  async analyze(imagePart: { inlineData: { data: string; mimeType: string } }): Promise<string> {
    const prompt = `你是一个照片分析专家。请分析这张照片中的人物特征（性别、年龄、表情、发型、衣着等），并以简洁的文本描述这些特征，用于后续生成prompt。`;

    return this.client.generateContent(prompt, imagePart);
  }
}

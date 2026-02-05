import { GeminiClient } from './GeminiClient';

export class PromptGenerator {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  async generate(analysisText: string): Promise<string> {
    const prompt = `你是一个Prompt专家。根据以下人物特征，生成一个用于生成中国新年祝福照片的英文Prompt。
    人物特征：${analysisText}
    要求：
    1. 保持人物主要特征（如性别、年龄），确保人物具有高辨识度。
    2. 对人物进行美化处理：大眼、瘦脸、磨皮、瘦身，提升整体颜值，看起来完美无瑕。
    3. 背景为中国新年氛围（红色、灯笼、烟花等）。
    4. 人物穿着喜庆的中国传统服饰或现代红色系服饰。
    5. 动作：双手抱拳作揖（中国传统拜年姿势），保持全身构图。
    6. 风格：超清摄影风格，具有高辨识度又带有艺术美感，看着像用 iPhone 17 pro max近距离实拍的。
    请只输出英文Prompt内容，不要包含其他解释。`;

    return this.client.generateContent(prompt);
  }
}

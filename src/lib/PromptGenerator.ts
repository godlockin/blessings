import { GeminiClient } from './GeminiClient';
import { beautify, type AgeGroup, type BeautifyContext } from './Beautifier';

export class PromptGenerator {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  async generate(analysisText: string): Promise<string> {
    // 智能美颜分析 - 获取完整的美颜上下文
    const { context, prompt: beautifyPrompt } = beautify(analysisText);
    
    // 根据年龄组调整美颜说明
    const ageGroupDescription: Record<AgeGroup, string> = {
      child: '儿童（保持天真可爱）',
      teenager: '青少年（保持青春活力）',
      young_adult: '青年人（大眼瘦脸，完美妆容）',
      adult: '成年人（去皱纹，紧致肌肤）',
      middle_aged: '中年人（减龄美颜，保持尊严）',
      elderly: '老年人（温和美颜，健康气色）'
    };

    // 构建美颜信息摘要
    const beautifyInfo = this.buildBeautifyInfo(context);

    const prompt = `你是一个Prompt专家。根据以下人物特征，生成一个用于生成中国新年祝福照片的英文Prompt。
    人物特征：${analysisText}
    年龄组：${ageGroupDescription[context.ageGroup]}
    美颜配置：${beautifyInfo}
    
    要求：
    1. 保持人物主要特征（如性别、年龄），确保人物具有高辨识度，亲友能认出是本人。
    2. **智能美颜**（非常重要）：${beautifyPrompt}
    3. 背景为中国新年氛围（红色、灯笼、烟花等）。
    4. 人物穿着喜庆的中国传统服饰或现代红色系服饰。
    5. 动作：双手抱拳作揖（中国传统拜年姿势），保持全身构图。
    6. 风格：超清摄影风格，具有高辨识度又带有艺术美感，看着像用 iPhone 17 pro max近距离实拍的。
    
    注意：美颜要自然适度，在提升颜值的同时必须保证能看出是本人，不要过度变形。
    请只输出英文Prompt内容，不要包含其他解释。`;

    return this.client.generateContent(prompt);
  }

  private buildBeautifyInfo(context: BeautifyContext): string {
    const parts: string[] = [];
    
    if (context.age) {
      parts.push(`${context.age}岁`);
    }
    
    if (context.gender !== 'unknown') {
      parts.push(context.gender === 'female' ? '女性' : '男性');
    }
    
    if (context.skinTone !== 'unknown') {
      const toneMap: Record<string, string> = {
        fair: '白皙', light: '偏白', medium: '自然', 
        olive: '橄榄', tan: '偏黄', dark: '深色'
      };
      parts.push(`${toneMap[context.skinTone]}肤色`);
    }
    
    if (context.facialFeatures.faceShape !== 'unknown') {
      const shapeMap: Record<string, string> = {
        oval: '鹅蛋脸', round: '圆脸', square: '方脸',
        heart: '心形脸', long: '长脸', diamond: '菱形脸'
      };
      parts.push(shapeMap[context.facialFeatures.faceShape]);
    }
    
    return parts.join('，') || '标准美颜';
  }
}

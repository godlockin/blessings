import { GeminiClient } from './GeminiClient';
import { beautify, type AgeGroup, type BeautifyContext } from './Beautifier';

export class PromptGenerator {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  async generate(analysisText: string): Promise<string> {
    const { context, prompt: beautifyPrompt } = beautify(analysisText);
    
    const ageGroupDescription: Record<AgeGroup, string> = {
      child: '儿童（保持天真可爱）',
      teenager: '青少年（保持青春活力）',
      young_adult: '青年女性（精致美颜）',
      adult: '成年女性（减龄8岁）',
      middle_aged: '中年女性（减龄10岁）',
      elderly: '老年女性（温和美颜）'
    };

    const beautifyInfo = this.buildBeautifyInfo(context);

    const isAsianFemale = context.ethnicity === 'asian' && context.gender === 'female';
    const youthTarget = isAsianFemale && (context.ageGroup === 'adult' || context.ageGroup === 'middle_aged') 
      ? '目标：看起来年轻8-10岁' 
      : '';

    const prompt = `你是一个Prompt专家。根据以下人物特征，生成一个用于生成中国新年祝福照片的英文Prompt。
    人物特征：${analysisText}
    年龄组：${ageGroupDescription[context.ageGroup]}
    美颜配置：${beautifyInfo}
    ${youthTarget}
    
    核心要求（必须严格遵守）：
    1. **真实感第一**：照片必须看起来完全像是用 iPhone 16 Pro Max 在自然光线下拍摄的真实照片
    2. **真实摄影特征**：保留皮肤毛孔纹理、自然肤色过渡、真实光影效果、自然的眼神光
    3. **自然美化**：比原图好看 - 肤色更均匀、痘印瑕疵减少、气色更好、眼睛更有神
    4. **禁止塑料感**：不要过度磨皮、不要假白、不要像AI生成的虚假感
    5. **保持辨识度**：能看出是同一个人，保留面部独特特征（痣、独特轮廓等）
    
    智能美颜：${beautifyPrompt}
    
    场景：背景为中国新年氛围（红色、灯笼、烟花等）
    服饰：喜庆的中国传统服饰或现代红色系服饰
    动作：双手抱拳作揖（中国传统拜年姿势），全身构图
    
    风格：iPhone 16 Pro Max 真实摄影风格
    - 保留皮肤纹理和毛孔细节（真实感的关键）
    - 自然真实的光影过渡，智能HDR高光处理
    - 准确的白平衡和自然的色彩还原
    - 景深效果自然，主体清晰背景虚化适中
    - 整体效果像手机近距离实拍，有生活感和真实感
    
    ${isAsianFemale ? '针对亚洲女性：提亮肤色、瘦脸、大眼、磨皮除皱，但必须保持真实皮肤质感。' : ''}
    
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

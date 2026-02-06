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
    const isMale = context.gender === 'male';
    const youthTarget = isAsianFemale && (context.ageGroup === 'adult' || context.ageGroup === 'middle_aged') 
      ? '目标：看起来年轻8-10岁' 
      : '';
    
    const clothingInstruction = isMale 
      ? '男士穿着传统中国唐装，红色或金色为主，经典盘扣设计，体现中国传统男性魅力'
      : '女士穿着优雅中国旗袍，红色或金色为主，经典立领盘扣，贴身剪裁展现东方女性曲线之美';
    
    const prompt = `你是一个Prompt专家。根据以下人物特征，生成一个用于生成中国新年祝福照片的英文Prompt。
    人物特征：${analysisText}
    年龄组：${ageGroupDescription[context.ageGroup]}
    美颜配置：${beautifyInfo}
    ${youthTarget}
    
    ===========================================
    核心要求（严格遵守）：
    ===========================================
    1. **真实摄影**：必须完全像 iPhone 16 Pro Max 拍摄的真人照片
       - 保留皮肤纹理和毛孔细节
       - 自然肤色过渡和真实光影
       - 眼神有自然的 catchlights
       - 禁止塑料感、AI虚假感
    
     2. **自然美化**：比原图更好看，但真实自然
        - 肤色更均匀、气色更好
        - 痘印瑕疵减少
        - 眼睛更有神采
        - 能看出是同一个人
    
    智能美颜细节：${beautifyPrompt}
    
    ===========================================
    统一场景设置：
    ===========================================
    ${clothingInstruction}
    
    背景：中国传统新年场景
    - 红色为主色调，象征喜庆吉祥
    - 传统装饰元素：灯笼、对联、福字、烟花、鞭炮、金色装饰
    - 温暖的室内光线，营造温馨氛围
    - 背景适度虚化，突出人物主体
    - 整体透出欢乐、喜庆、温暖的中国新年气息
    
    动作：双手抱拳作揖拜年姿势，展现中国传统礼仪风范，全身构图
    
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

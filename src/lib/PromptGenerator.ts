import { GeminiClient } from './GeminiClient';
import { beautify, beautifyHeavy, type AgeGroup, type BeautifyContext } from './Beautifier';
import type { GenerationContext } from './ImageReviewer';

export class PromptGenerator {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  async generate(analysisText: string): Promise<string> {
    const { prompt } = await this.buildFullPrompt(analysisText);
    return prompt;
  }

  async buildFullPrompt(analysisText: string): Promise<{ prompt: string; context: GenerationContext }> {
    const { context, prompt: beautifyPrompt } = beautify(analysisText);
    
    const ageGroupDescription: Record<AgeGroup, string> = {
      child: '儿童（保持天真可爱）',
      teenager: '青少年（保持青春活力）',
      young_adult: '青年女性（精致美颜）',
      adult: '成年女性（减龄12岁，强力去皱瘦脸）',
      middle_aged: '中年女性（减龄15岁，深度去皱瘦脸）',
      elderly: '老年女性（减龄10岁，温和美颜）'
    };

    const beautifyInfo = this.buildBeautifyInfo(context);

    const isAsianFemale = context.ethnicity === 'asian' && context.gender === 'female';
    const isMale = context.gender === 'male';
    const youthTarget = isAsianFemale 
      ? context.ageGroup === 'adult' ? '目标：看起来年轻12岁' 
        : context.ageGroup === 'middle_aged' ? '目标：看起来年轻15岁'
        : context.ageGroup === 'elderly' ? '目标：看起来年轻10岁'
        : ''
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
    
    2. **自然美化**：比原图好看很多，但不失真
       - 专业打光：主灯+补光灯+反光板，模拟影棚多层次光照
       - 消除脸部所有阴影，均匀提亮
       - 磨皮祛痘去闭口去皱纹去斑
       - 缩小毛孔，瓷肌质感
       - 瘦脸，大眼，增加气色
       - 能看出是同一个人，更年轻更精神
    
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
    - 专业多层次打光效果（主灯+补光+反光）
    - 保留皮肤纹理和毛孔细节
    - 自然真实的光影过渡
    - 准确的白平衡和自然的色彩还原
    - 景深效果自然，主体清晰背景虚化适中
    
    ${isAsianFemale ? '针对中国/亚洲女士强化要求：强力瘦脸（V-line下颌、尖下巴、小脸效果）；深度去皱（消除所有皱纹）；显著减龄12-15岁；紧致提升面部轮廓；大眼效果；磨皮祛痘去闭口；看起来比本人好看很多，但依然真实自然。' : ''}
    
    请只输出英文Prompt内容，不要包含其他解释。`;

    const finalContext: GenerationContext = {
      originalAnalysis: analysisText,
      prompt,
      ageGroup: context.ageGroup,
      isAsianFemale
    };

    return {
      prompt: await this.client.generateContent(prompt),
      context: finalContext
    };
  }

  /**
   * 重度美颜模式 -  beauty first
   */
  async buildHeavyBeautifyPrompt(analysisText: string): Promise<{ prompt: string; context: GenerationContext }> {
    const { context, prompt: beautifyPrompt } = beautifyHeavy(analysisText);

    const isAsianFemale = context.ethnicity === 'asian' && context.gender === 'female';
    const isMale = context.gender === 'male';

    const clothingInstruction = isMale
      ? 'Wearing luxurious traditional Chinese Tang suit in vibrant red with intricate gold embroidery, mandarin collar with jade buttons, elegant and noble appearance'
      : 'Wearing elegant traditional Chinese Qipao in vibrant red silk with delicate gold embroidery, high mandarin collar, form-fitting silhouette showing graceful curves';

    const prompt = `Generate a HEAVILY BEAUTIFIED Chinese New Year portrait photo with MAXIMUM beauty enhancement:

**SUBJECT DESCRIPTION:**
${analysisText}

**AGGRESSIVE BEAUTIFICATION REQUIREMENTS:**
${beautifyPrompt}

**ADDITIONAL BEAUTY ENHANCEMENTS:**
- Overall image brightness increased by 60-80%
- Heavy skin smoothing: completely flawless, poreless, porcelain-like skin
- Dramatic face slimming: small V-line face, delicate jawline
- Extreme eye enlargement: big bright sparkling eyes with dramatic catchlights
- Complete wrinkle removal: zero wrinkles, zero fine lines
- Heavy anti-aging: looks 15-20 years younger
- Skin whitening: fair glowing porcelain complexion
- Teeth brightening: dazzling white smile
- Lip enhancement: glossy pink lips
- Rosy cheek blush: healthy vibrant flush
- Professional makeup: full glam look with defined features

**CLOTHING & SCENE:**
${clothingInstruction}

**BACKGROUND:**
- Festive Chinese New Year scene with red lanterns and golden decorations
- Warm celebratory lighting with bokeh effects
- Traditional Chinese architectural elements
- Rich red and gold color palette symbolizing prosperity
- Joyful and auspicious atmosphere

**TECHNICAL SPECIFICATIONS:**
- High-end beauty portrait photography style
- Professional studio lighting with ring light and beauty dish
- Soft focus dreamy effect
- Shallow depth of field, beautifully blurred background
- High-key bright and cheerful lighting
- Magazine cover quality and composition
- Photo-realistic (NOT anime/3D/cartoon)

**CRITICAL - IDENTITY:**
- Must remain recognizable as the same person
- Enhance beauty while preserving key facial features
- Make them look like the BEST version of themselves

${isAsianFemale ? 'HEAVY ASIAN BEAUTY ENHANCEMENT: Dramatic V-line face contouring, extreme eye enlargement with double eyelid effect, porcelain white smooth skin, small delicate facial features, glamorous K-beauty style makeup, 15+ years younger appearance' : ''}

Style: Heavy beauty filter effect like Meitu/Snow/Instagram glam filter, magazine cover quality, stunning and attractive.`;

    const finalContext: GenerationContext = {
      originalAnalysis: analysisText,
      prompt,
      ageGroup: context.ageGroup,
      isAsianFemale
    };

    return {
      prompt: await this.client.generateContent(prompt),
      context: finalContext
    };
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

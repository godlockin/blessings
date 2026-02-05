/**
 * 智能美颜处理模块
 * 基于年龄、性别、肤色、面部特征的多维度美颜策略
 */

// ==================== 类型定义 ====================

export type AgeGroup = 'child' | 'teenager' | 'young_adult' | 'adult' | 'middle_aged' | 'elderly';
export type Gender = 'male' | 'female' | 'unknown';
export type SkinTone = 'fair' | 'light' | 'medium' | 'olive' | 'tan' | 'dark' | 'unknown';
export type Ethnicity = 'asian' | 'caucasian' | 'african' | 'middle_eastern' | 'mixed' | 'unknown';
export type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'long' | 'diamond' | 'unknown';
export type BeautifyLevel = 'minimal' | 'light' | 'moderate' | 'strong' | 'gentle';

export interface FacialFeatures {
  faceShape: FaceShape;
  eyeSize: 'small' | 'medium' | 'large' | 'unknown';
  skinIssues: SkinIssue[];
  specialFeatures: string[]; // 痣、酒窝、眼镜、胡须等
}

export type SkinIssue = 'acne' | 'wrinkles' | 'spots' | 'dark_circles' | 'pores' | 'oily' | 'dry';

export interface BeautifyContext {
  ageGroup: AgeGroup;
  age: number | undefined;
  gender: Gender;
  skinTone: SkinTone;
  ethnicity: Ethnicity;
  facialFeatures: FacialFeatures;
  originalAnalysis: string;
}

export interface BeautifyStrategy {
  level: BeautifyLevel;
  focus: string[];
  avoid: string[];
  prompt: string;
}

// ==================== 年龄检测 ====================

interface AgeIndicators {
  keywords: string[];
  ageRange: [number, number];
}

const AGE_KEYWORDS: Record<AgeGroup, AgeIndicators> = {
  child: {
    keywords: ['child', 'kid', 'baby', 'toddler', 'infant', 'boy', 'girl', 'children', '小孩', '儿童', '宝宝', '男孩', '女孩'],
    ageRange: [0, 12]
  },
  teenager: {
    keywords: ['teenager', 'teen', 'adolescent', 'youth', 'student', '青少年', '少年', '学生'],
    ageRange: [13, 19]
  },
  young_adult: {
    keywords: ['young adult', 'young man', 'young woman', 'youthful', '20s', '青年', '年轻人'],
    ageRange: [20, 35]
  },
  adult: {
    keywords: ['adult', 'man', 'woman', 'mature', 'grown', '成年人', '中年'],
    ageRange: [36, 59]
  },
  middle_aged: {
    keywords: ['middle-aged', 'mature', '中年', '壮年'],
    ageRange: [40, 59]
  },
  elderly: {
    keywords: ['elderly', 'senior', 'old', 'aged', 'grandpa', 'grandma', 'elder', '老人', '老年', '爷爷', '奶奶'],
    ageRange: [60, 120]
  }
};

/**
 * 提取年龄数字
 */
export function extractAgeNumber(analysis: string): number | null {
  const patterns = [
    /大约(\d+)岁/,
    /(\d+)岁/,
    /(\d+)岁左右/,
    /(\d+)-(\d+)岁/,
    /age\s+(\d+)/i,
    /(\d+)\s*years?\s*old/i,
    /(\d+)-year-old/i,
    /(\d+)s/i,
    /(\d+)岁上下/,
    /(\d+)多岁/
  ];
  
  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match) {
      if (match[2]) {
        // 范围取中间值
        return Math.floor((parseInt(match[1], 10) + parseInt(match[2], 10)) / 2);
      }
      return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * 检测年龄组
 */
export function detectAgeGroup(analysis: string): { group: AgeGroup; age?: number } {
  const ageNumber = extractAgeNumber(analysis);
  
  if (ageNumber !== null) {
    if (ageNumber <= 12) return { group: 'child', age: ageNumber };
    if (ageNumber <= 19) return { group: 'teenager', age: ageNumber };
    if (ageNumber <= 35) return { group: 'young_adult', age: ageNumber };
    if (ageNumber <= 59) return { group: 'adult', age: ageNumber };
    return { group: 'elderly', age: ageNumber };
  }
  
  // 关键词匹配
  const lowerAnalysis = analysis.toLowerCase();
  
  if (AGE_KEYWORDS.elderly.keywords.some(k => lowerAnalysis.includes(k))) {
    return { group: 'elderly' };
  }
  if (AGE_KEYWORDS.child.keywords.some(k => lowerAnalysis.includes(k))) {
    return { group: 'child' };
  }
  if (AGE_KEYWORDS.teenager.keywords.some(k => lowerAnalysis.includes(k))) {
    return { group: 'teenager' };
  }
  if (AGE_KEYWORDS.young_adult.keywords.some(k => lowerAnalysis.includes(k))) {
    return { group: 'young_adult' };
  }
  if (AGE_KEYWORDS.adult.keywords.some(k => lowerAnalysis.includes(k))) {
    return { group: 'adult' };
  }
  
  // 默认为成年人
  return { group: 'adult' };
}

// ==================== 性别检测 ====================

export function detectGender(analysis: string): Gender {
  const lowerAnalysis = analysis.toLowerCase();
  
  const femaleKeywords = [
    'female', 'woman', 'girl', 'lady', 'women', 'she', 'her', 'mother', 'grandmother', 
    'wife', 'daughter', 'sister', '女孩', '女人', '女性', '女士', '妈妈', '奶奶', 
    '外婆', '妻子', '女儿', '姐妹'
  ];
  
  const maleKeywords = [
    'male', 'man', 'boy', 'men', 'he', 'him', 'father', 'grandfather', 'husband', 
    'son', 'brother', '男孩', '男人', '男性', '先生', '爸爸', '爷爷', '外公', 
    '丈夫', '儿子', '兄弟'
  ];
  
  const hasFemale = femaleKeywords.some(k => lowerAnalysis.includes(k));
  const hasMale = maleKeywords.some(k => lowerAnalysis.includes(k));
  
  if (hasFemale && !hasMale) return 'female';
  if (hasMale && !hasFemale) return 'male';
  return 'unknown';
}

// ==================== 族裔检测 ====================

export function detectEthnicity(analysis: string): Ethnicity {
  const lowerAnalysis = analysis.toLowerCase();
  
  const caucasianKeywords = [
    'caucasian', 'white', 'european', 'american', 'western', '外国人', '白人',
    '西方人', '高加索', '金发', '碧眼', '浅色眼睛', 'light eyes', 'blonde',
    'blue eyes', 'green eyes', 'gray eyes', 'fair hair'
  ];
  
  const africanKeywords = [
    'african', 'black', 'african american', '黑人', '非裔', '深色皮肤',
    'dark skin', 'brown skin', 'african american'
  ];
  
  const middleEasternKeywords = [
    'middle eastern', 'arabic', 'arab', '中东', '阿拉伯', '波斯'
  ];
  
  const asianKeywords = [
    'asian', 'chinese', 'japanese', 'korean', '东亚', '亚洲人', '中国人',
    '日本人', '韩国人', '亚裔', '黄种人'
  ];
  
  if (caucasianKeywords.some(k => lowerAnalysis.includes(k))) {
    return 'caucasian';
  }
  if (africanKeywords.some(k => lowerAnalysis.includes(k))) {
    return 'african';
  }
  if (middleEasternKeywords.some(k => lowerAnalysis.includes(k))) {
    return 'middle_eastern';
  }
  if (asianKeywords.some(k => lowerAnalysis.includes(k))) {
    return 'asian';
  }
  
  return 'unknown';
}

// ==================== 肤色检测 ====================

export function detectSkinTone(analysis: string): SkinTone {
  const lowerAnalysis = analysis.toLowerCase();
  
  const toneKeywords: Record<SkinTone, string[]> = {
    fair: ['fair skin', 'pale', '白皙', '苍白', 'white skin', '很白'],
    light: ['light skin', 'fair', '白', '偏白', '浅色皮肤'],
    medium: ['medium skin', '自然肤色', '中等肤色', '小麦色', 'tan'],
    olive: ['olive skin', 'olive tone', '橄榄色', '黄皮', 'yellow undertone'],
    tan: ['tan skin', 'tanned', '偏黄', '深黄', '棕色', 'brown skin'],
    dark: ['dark skin', 'deep skin', '黑', '深色皮肤', 'dark tone'],
    unknown: []
  };
  
  for (const [tone, keywords] of Object.entries(toneKeywords)) {
    if (tone !== 'unknown' && keywords.some(k => lowerAnalysis.includes(k))) {
      return tone as SkinTone;
    }
  }
  
  return 'unknown';
}

// ==================== 面部特征分析 ====================

export function analyzeFacialFeatures(analysis: string): FacialFeatures {
  const lowerAnalysis = analysis.toLowerCase();
  
  // 脸型检测
  const faceShapeKeywords: Record<FaceShape, string[]> = {
    oval: ['oval face', '鹅蛋脸', 'oval-shaped'],
    round: ['round face', '圆脸', 'full face', '胖脸'],
    square: ['square face', '方脸', 'square jaw', '国字脸'],
    heart: ['heart-shaped face', '心形脸', 'heart face', 'triangle face'],
    long: ['long face', '长脸', 'oval-long', 'oblong'],
    diamond: ['diamond face', '菱形脸', 'diamond-shaped'],
    unknown: []
  };
  
  let faceShape: FaceShape = 'unknown';
  for (const [shape, keywords] of Object.entries(faceShapeKeywords)) {
    if (shape !== 'unknown' && keywords.some(k => lowerAnalysis.includes(k))) {
      faceShape = shape as FaceShape;
      break;
    }
  }
  
  // 眼睛大小检测
  const eyeSizeKeywords = {
    small: ['small eyes', '小眼睛', 'narrow eyes'],
    large: ['big eyes', 'large eyes', '大眼睛', 'bright eyes'],
    medium: ['medium eyes']
  };
  
  let eyeSize: FacialFeatures['eyeSize'] = 'unknown';
  if (eyeSizeKeywords.small.some(k => lowerAnalysis.includes(k))) eyeSize = 'small';
  else if (eyeSizeKeywords.large.some(k => lowerAnalysis.includes(k))) eyeSize = 'large';
  else eyeSize = 'medium';
  
  // 皮肤问题检测
  const skinIssues: SkinIssue[] = [];
  const issueKeywords: Record<SkinIssue, string[]> = {
    acne: ['acne', 'pimple', '痘痘', '青春痘', '粉刺'],
    wrinkles: ['wrinkles', 'lines', '皱纹', '细纹', '法令纹', '鱼尾纹'],
    spots: ['spots', 'freckles', 'moles', '斑点', '雀斑', '痣'],
    dark_circles: ['dark circles', 'bags under eyes', '黑眼圈', '眼袋'],
    pores: ['large pores', 'pores', '毛孔粗大'],
    oily: ['oily skin', '油性皮肤', '油光'],
    dry: ['dry skin', '干性皮肤', '干燥']
  };
  
  for (const [issue, keywords] of Object.entries(issueKeywords)) {
    if (keywords.some(k => lowerAnalysis.includes(k))) {
      skinIssues.push(issue as SkinIssue);
    }
  }
  
  // 特殊特征
  const specialFeatures: string[] = [];
  if (lowerAnalysis.includes('glasses') || lowerAnalysis.includes('眼镜')) {
    specialFeatures.push('glasses');
  }
  if (lowerAnalysis.includes('beard') || lowerAnalysis.includes('胡子') || lowerAnalysis.includes('胡须')) {
    specialFeatures.push('beard');
  }
  if (lowerAnalysis.includes('dimples') || lowerAnalysis.includes('酒窝')) {
    specialFeatures.push('dimples');
  }
  if (lowerAnalysis.includes('mole') || lowerAnalysis.includes('痣')) {
    specialFeatures.push('mole');
  }
  if (lowerAnalysis.includes('scar') || lowerAnalysis.includes('疤痕')) {
    specialFeatures.push('scar');
  }
  
  return {
    faceShape,
    eyeSize,
    skinIssues,
    specialFeatures
  };
}

// ==================== 美颜策略生成 ====================

function getAgeStrategy(_ageGroup: AgeGroup): BeautifyStrategy {
  const strategies: Record<AgeGroup, BeautifyStrategy> = {
    child: {
      level: 'minimal',
      focus: ['soft lighting', 'healthy glow', 'natural innocence', 'rosy cheeks'],
      avoid: ['heavy retouching', 'adult features', 'over-smoothing'],
      prompt: `
        Gentle child-friendly enhancements:
        - Soft natural lighting, rosy healthy cheeks
        - Clear bright eyes full of innocence and wonder
        - Smooth baby-soft skin maintaining natural texture
        - Keep adorable childlike appearance and charm
        - Preserve all natural features and expressions
        - Healthy vibrant youthful glow
      `.trim()
    },
    
    teenager: {
      level: 'light',
      focus: ['clear skin', 'bright eyes', 'fresh look', 'energy'],
      avoid: ['heavy makeup', 'adult features', 'over-processing'],
      prompt: `
        Youthful natural enhancements:
        - Bright clear eyes with natural spark and vitality
        - Smooth skin reducing acne, blemishes, and imperfections
        - Fresh and energetic youthful appearance
        - Natural healthy glowing complexion
        - Preserve unique teenage characteristics
        - Clean and vibrant look without heavy processing
      `.trim()
    },
    
    young_adult: {
      level: 'moderate',
      focus: ['big eyes', 'slim face', 'smooth skin', 'perfect complexion'],
      avoid: ['over-smoothing', 'loss of identity', 'unnatural features'],
      prompt: `
        Beauty enhancement for young adult:
        - Big bright sparkling eyes with natural makeup effect
        - Slim V-shaped face with refined jawline
        - Smooth flawless skin, minimize fine lines and pores
        - Rosy healthy radiant complexion
        - Well-proportioned harmonious facial features
        - Camera-ready polished look while keeping natural beauty
        - Maintain recognizable identity and character
      `.trim()
    },
    
    adult: {
      level: 'strong',
      focus: ['wrinkle reduction', 'face lifting', 'youthful glow', 'confidence'],
      avoid: ['over-smoothing', 'loss of character', 'unnatural youth'],
      prompt: `
        Age-defying enhancement for adult:
        - Lifted brighter eye area, reduce crow's feet and under-eye lines
        - Slimmer defined face contour, reduce sagging and puffiness
        - Smooth skin minimizing age spots, wrinkles, and imperfections
        - Youthful radiant healthy glow
        - Refreshed energetic confident appearance
        - Maintain wisdom, maturity and natural character
        - Look 5-10 years younger while staying recognizable
      `.trim()
    },
    
    middle_aged: {
      level: 'strong',
      focus: ['wrinkle softening', 'skin tightening', 'color correction', 'dignity'],
      avoid: ['over-youthening', 'loss of dignity', 'plastic look'],
      prompt: `
        Mature elegance enhancement:
        - Gentle softening of deep wrinkles and expression lines
        - Subtle face lift reducing sagging while keeping character
        - Natural healthy color restoration, rosy dignified glow
        - Smooth skin maintaining natural texture
        - Refined elegant appearance reflecting inner confidence
        - Look rejuvenated while embracing mature beauty
        - Keep life experience and wisdom visible in the face
      `.trim()
    },
    
    elderly: {
      level: 'gentle',
      focus: ['gentle smoothing', 'color enhancement', 'dignified look', 'warmth'],
      avoid: ['aggressive retouching', 'over-youthening', 'loss of identity'],
      prompt: `
        Dignified graceful enhancement for senior:
        - Gentle softening of deep age lines while keeping character
        - Natural healthy warm color restoration
        - Subtle lift maintaining natural face shape
        - Dignified graceful wise appearance
        - Warm approachable friendly expression
        - Keep natural age marks with elegance and respect
        - Look well-maintained and healthy while honoring age
      `.trim()
    }
  };
   
  return strategies[_ageGroup];
 }

function getGenderAdjustment(gender: Gender): string {
  if (gender === 'female') {
    return `
      Feminine beauty touches:
      - Soft delicate graceful features
      - Natural subtle makeup effect (eyeliner, light lipstick)
      - Elegant refined feminine appearance
      - Gentle and approachable feminine charm
    `.trim();
  } else if (gender === 'male') {
    return `
      Masculine refinement:
      - Strong defined jawline and facial structure
      - Clean masculine features without softening
      - No makeup appearance, natural strong look
      - Confident masculine presence and character
    `.trim();
  }
  return '';
}

function getEthnicityAdjustment(ethnicity: Ethnicity): string {
  if (ethnicity === 'unknown') {
    return '';
  }
  
  const ethnicityProfiles: Record<Ethnicity, string> = {
    caucasian: `
      Caucasian skin optimization:
      - Preserve natural skin texture, minimal smoothing
      - Enhance natural rosy/golden undertones
      - Keep healthy skin pores visible for realism
      - Avoid over-whitening, maintain natural complexion
      - Enhance natural skin radiance and glow
      - Professional photo look with natural skin details
    `.trim(),
    
    african: `
      Rich melanin skin optimization:
      - Enhance deep rich skin tone, maintain warmth
      - Preserve natural skin texture and pores
      - Add luminous healthy glow without lighten tone
      - Keep natural melanin richness and depth
      - Avoid over-smoothing, maintain authentic texture
      - Vibrant healthy rich skin appearance
    `.trim(),
    
    middle_eastern: `
      Mediterranean skin optimization:
      - Enhance warm olive/golden undertones
      - Preserve natural skin character and texture
      - Add healthy radiant sun-kissed glow
      - Maintain authentic Mediterranean complexion
      - Avoid excessive smoothing, keep natural look
      - Warm rich vibrant skin appearance
    `.trim(),
    
    asian: `
      Asian skin optimization:
      - Enhance smooth porcelain skin quality
      - Even out skin tone with natural brightness
      - Subtle enhancement while keeping authenticity
      - Healthy luminous glow appropriate for Asian skin
      - Professional retouching with natural look
    `.trim(),
    
    mixed: `
      Mixed ethnicity skin optimization:
      - Blend and enhance natural skin features
      - Preserve unique mixed skin characteristics
      - Add healthy balanced glow and radiance
      - Maintain authentic natural skin texture
      - Professional natural looking enhancement
    `.trim(),
    
    unknown: ''
  };
  
  return ethnicityProfiles[ethnicity] || '';
}

function getSkinToneAdjustment(skinTone: SkinTone): string {
  const adjustments: Record<SkinTone, string> = {
    fair: '- Enhance natural rosy glow, avoid over-whitening, add healthy color',
    light: '- Even out skin tone, gentle brightening, natural healthy radiance',
    medium: '- Enhance warm golden undertones, add luminous glow',
    olive: '- Reduce yellow/green cast, brighten and even out tone',
    tan: '- Enhance warm healthy bronze glow, even out color',
    dark: '- Enhance deep rich skin tone, add luminous healthy glow',
    unknown: '- Natural skin tone enhancement, even out complexion'
  };
  return adjustments[skinTone];
}

function getFaceShapeAdjustment(faceShape: FaceShape): string {
  const adjustments: Record<FaceShape, string> = {
    round: '- Subtle V-line contouring, elongate face slightly, define jawline',
    square: '- Soften angular jaw, create oval balance, gentle contouring',
    long: '- Add width to cheeks, reduce vertical length, balance proportions',
    heart: '- Balance forehead and chin, soften pointed chin slightly',
    diamond: '- Soften cheekbone angles, balance forehead and jaw',
    oval: '- Maintain perfect oval shape, enhance natural balance',
    unknown: '- Natural face contouring, enhance best features'
  };
  return adjustments[faceShape];
}

function getSkinIssuesAdjustment(issues: SkinIssue[]): string {
  if (issues.length === 0) return '- Perfect skin maintenance, enhance natural glow';
  
  const issuePrompts: Record<SkinIssue, string> = {
    acne: 'reduce acne and blemishes',
    wrinkles: 'soften wrinkles while keeping natural expression',
    spots: 'even out skin tone, reduce spots',
    dark_circles: 'brighten under-eye area, reduce dark circles',
    pores: 'refine skin texture, minimize pore appearance',
    oily: 'matte finish, reduce shine',
    dry: 'add healthy glow and moisture'
  };
  
  return `- Address skin concerns: ${issues.map(i => issuePrompts[i]).join(', ')}`;
}

function getSpecialFeaturesNote(features: string[]): string {
  if (features.length === 0) return '';
  
  const notes: Record<string, string> = {
    glasses: 'Keep glasses style, reduce glare, enhance eyes behind frames',
    beard: 'Groom and shape beard naturally, keep masculine character',
    dimples: 'Preserve cute dimples when smiling',
    mole: 'Keep distinctive mole as identity feature',
    scar: 'Minimize visible scars while keeping natural'
  };
  
  const relevantNotes = features
    .map(f => notes[f])
    .filter(Boolean);
  
  if (relevantNotes.length === 0) return '';
  
  return `
    Preserve special features:
    ${relevantNotes.map(n => `- ${n}`).join('\n    ')}
  `.trim();
}

// ==================== 主美颜函数 ====================

export function analyzeForBeautify(analysis: string): BeautifyContext {
  const { group: ageGroup, age } = detectAgeGroup(analysis);
  const gender = detectGender(analysis);
  const skinTone = detectSkinTone(analysis);
  const ethnicity = detectEthnicity(analysis);
  const facialFeatures = analyzeFacialFeatures(analysis);
  
  return {
    ageGroup,
    age: age ?? undefined,
    gender,
    skinTone,
    ethnicity,
    facialFeatures,
    originalAnalysis: analysis
  };
}

export function generateBeautifyPrompt(context: BeautifyContext): string {
  const ageStrategy = getAgeStrategy(context.ageGroup);
  const genderAdjustment = getGenderAdjustment(context.gender);
  const skinToneAdjustment = getSkinToneAdjustment(context.skinTone);
  const ethnicityAdjustment = getEthnicityAdjustment(context.ethnicity);
  const faceShapeAdjustment = getFaceShapeAdjustment(context.facialFeatures.faceShape);
  const skinIssuesAdjustment = getSkinIssuesAdjustment(context.facialFeatures.skinIssues);
  const specialFeaturesNote = getSpecialFeaturesNote(context.facialFeatures.specialFeatures);
  
  const parts = [
    '// === Professional Photo Beautification ===',
    '',
    'Base enhancement:',
    ageStrategy.prompt,
    '',
    'Gender-specific adjustment:',
    genderAdjustment,
    '',
    'Ethnicity-specific optimization:',
    ethnicityAdjustment,
    '',
    'Skin tone optimization:',
    skinToneAdjustment,
    '',
    'Face shape enhancement:',
    faceShapeAdjustment,
    '',
    'Skin quality improvement:',
    skinIssuesAdjustment,
    ''
  ];
  
  if (specialFeaturesNote) {
    parts.push('', specialFeaturesNote);
  }
  
  parts.push(
    '',
    '// === Quality Guarantees ===',
    '- Maintain original identity: must be recognizable as the same person',
    '- Natural-looking results: no over-processing or artificial appearance',
    '- Preserve unique characteristics: moles, scars, and distinctive features',
    '- High-definition quality: professional photo retouching standard',
    `- Beautification level: ${ageStrategy.level} (age-appropriate)`
  );
  
  return parts.join('\n');
}

/**
 * 简化的美颜接口
 */
export function beautify(analysis: string): {
  context: BeautifyContext;
  prompt: string;
} {
  const context = analyzeForBeautify(analysis);
  const prompt = generateBeautifyPrompt(context);
  
  return {
    context,
    prompt
  };
}

/**
 * 生成简化的美颜提示（用于原有接口兼容）
 */
export function generateSimpleBeautifyPrompt(analysis: string): string {
  const result = beautify(analysis);
  return result.prompt;
}

// 兼容旧接口
export function getBeautifyLevel(ageGroup: AgeGroup): BeautifyLevel {
  const levelMap: Record<AgeGroup, BeautifyLevel> = {
    child: 'minimal',
    teenager: 'light',
    young_adult: 'moderate',
    adult: 'strong',
    middle_aged: 'strong',
    elderly: 'gentle'
  };
  return levelMap[ageGroup];
}

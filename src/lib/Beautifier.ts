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
  specialFeatures: string[];
  skinTexture: 'smooth' | 'moderate' | 'rough' | 'unknown';
  eyelidType: 'single' | 'double' | 'hooded' | 'unknown';
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
    oval: ['oval face', '鹅蛋脸', 'oval-shaped', '瓜子脸'],
    round: ['round face', '圆脸', 'full face', '胖脸', '娃娃脸'],
    square: ['square face', '方脸', 'square jaw', '国字脸', '骨骼感明显'],
    heart: ['heart-shaped face', '心形脸', 'heart face', 'triangle face', '上宽下窄'],
    long: ['long face', '长脸', 'oblong', '中庭偏长'],
    diamond: ['diamond face', '菱形脸', 'diamond-shaped', '颧骨突出'],
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
    small: ['small eyes', '小眼睛', 'narrow eyes', '眼睛偏小', '眼裂较小'],
    large: ['big eyes', 'large eyes', '大眼睛', 'bright eyes', '眼睛大而有神'],
    medium: ['medium eyes', 'normal eyes', '眼睛适中', 'normal size']
  };
  
  let eyeSize: FacialFeatures['eyeSize'] = 'unknown';
  if (eyeSizeKeywords.small.some(k => lowerAnalysis.includes(k))) eyeSize = 'small';
  else if (eyeSizeKeywords.large.some(k => lowerAnalysis.includes(k))) eyeSize = 'large';
  else eyeSize = 'medium';
  
  // 眼皮类型检测（针对亚洲女性）
  const eyelidKeywords = {
    single: ['单眼皮', 'single eyelid', '内双不明显'],
    double: ['双眼皮', 'double eyelid', '明显双眼褶'],
    hooded: ['肿眼泡', 'hooded eyes', '眼皮脂肪厚'],
    unknown: []
  };
  
  let eyelidType: FacialFeatures['eyelidType'] = 'unknown';
  for (const [type, keywords] of Object.entries(eyelidKeywords)) {
    if (type !== 'unknown' && keywords.some(k => lowerAnalysis.includes(k))) {
      eyelidType = type as FacialFeatures['eyelidType'];
      break;
    }
  }
  
  // 皮肤问题检测
  const skinIssues: SkinIssue[] = [];
  const issueKeywords: Record<SkinIssue, string[]> = {
    acne: ['acne', 'pimple', '痘痘', '青春痘', '粉刺', '痘印'],
    wrinkles: ['wrinkles', 'lines', '皱纹', '细纹', '法令纹', '鱼尾纹', '抬头纹', '颈纹', '初老'],
    spots: ['spots', 'freckles', 'moles', '斑点', '雀斑', '痣', '色斑', '晒斑'],
    dark_circles: ['dark circles', 'bags under eyes', '黑眼圈', '眼袋', '泪沟'],
    pores: ['large pores', 'pores', '毛孔粗大', '毛孔明显'],
    oily: ['oily skin', '油性皮肤', '油光', 't区出油'],
    dry: ['dry skin', '干性皮肤', '干燥', '起皮', '卡粉']
  };
  
  for (const [issue, keywords] of Object.entries(issueKeywords)) {
    if (keywords.some(k => lowerAnalysis.includes(k))) {
      skinIssues.push(issue as SkinIssue);
    }
  }
  
  // 皮肤质感检测
  let skinTexture: FacialFeatures['skinTexture'] = 'unknown';
  if (lowerAnalysis.includes('皮肤好') || lowerAnalysis.includes('肤质好') || lowerAnalysis.includes('细腻')) {
    skinTexture = 'smooth';
  } else if (lowerAnalysis.includes('毛孔') || lowerAnalysis.includes('粗糙') || lowerAnalysis.includes('痘')) {
    skinTexture = 'rough';
  } else if (lowerAnalysis.includes('一般') || lowerAnalysis.includes('普通')) {
    skinTexture = 'moderate';
  }
  
  // 特殊特征
  const specialFeatures: string[] = [];
  if (lowerAnalysis.includes('glasses') || lowerAnalysis.includes('眼镜') || lowerAnalysis.includes('戴眼镜')) {
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
  if (lowerAnalysis.includes('法令纹') || lowerAnalysis.includes('嘴角纹')) {
    specialFeatures.push('smile lines');
  }
  
  return {
    faceShape,
    eyeSize,
    eyelidType,
    skinIssues,
    skinTexture,
    specialFeatures
  };
}

// ==================== 美颜策略生成 ====================

// ==================== 亚洲女性专项美颜策略 ====================

interface AsianFemaleStrategy {
  level: BeautifyLevel;
  brightness: 'enhanced' | 'moderate' | 'subtle';
  faceSlimming: 'strong' | 'moderate' | 'subtle';
  eyeEnlargement: 'significant' | 'moderate' | 'subtle';
  skinSmoothing: 'aggressive' | 'moderate' | 'gentle';
  wrinkleRemoval: 'deep' | 'moderate' | 'gentle';
  youthFactor: number;
  prompt: string;
}

const ASIAN_FEMALE_STRATEGIES: Record<AgeGroup, AsianFemaleStrategy> = {
  child: {
    level: 'minimal',
    brightness: 'subtle',
    faceSlimming: 'subtle',
    eyeEnlargement: 'subtle',
    skinSmoothing: 'gentle',
    wrinkleRemoval: 'gentle',
    youthFactor: 0,
    prompt: `
      Gentle child beautification:
      - Natural soft lighting with healthy rosy glow
      - Bright innocent eyes full of wonder
      - Smooth baby skin maintaining natural texture
      - Keep adorable childlike charm
      - Preserve all natural features
    `.trim()
  },
  
  teenager: {
    level: 'light',
    brightness: 'enhanced',
    faceSlimming: 'subtle',
    eyeEnlargement: 'moderate',
    skinSmoothing: 'gentle',
    wrinkleRemoval: 'gentle',
    youthFactor: 0,
    prompt: `
      **Youthful Asian Female Portrait:**
      
      === PROFESSIONAL LIGHTING ===
      Flattering studio lighting for natural glow
      
      === SKIN ===
      - Clear bright skin with natural radiance
      - Reduced blemishes, healthy glow
      - Maintain natural teen texture
      
      === EYES ===
      - Expressive eyes with sparkle
      - Natural enlargement
      
      === FINAL EFFECT ===
      - Fresh energetic youthful look
      - Natural beauty preserved
    `.trim()
  },
  
  young_adult: {
    level: 'moderate',
    brightness: 'enhanced',
    faceSlimming: 'moderate',
    eyeEnlargement: 'moderate',
    skinSmoothing: 'aggressive',
    wrinkleRemoval: 'gentle',
    youthFactor: 0,
    prompt: `
      **Realistic iPhone Portrait - Naturally Beautiful:**
      
      === CORE PRINCIPLE: REALISM FIRST ===
      - MUST look like a REAL photo taken with iPhone 16 Pro Max
      - Keep natural skin TEXTURE and visible PORES (key to realism)
      - Keep natural skin TONE variations (not uniform)
      - NO plastic, anime, or 3D-rendered look
      - Allow MINOR imperfections (adds authenticity)
      - Person must be RECOGNIZABLE as the same person
      
      === PROFESSIONAL LIGHTING ===
      - Multi-light studio setup: Key + Fill + Rim
      - Even face illumination, no harsh shadows
      - Natural catchlights in eyes
      - Professional but natural-looking light
      
      === SKIN ENHANCEMENT (Natural) ===
      - Reduce noticeable acne, blemishes, large spots
      - Soften wrinkles but keep some skin texture (NOT baby-smooth)
      - Slightly even skin tone (not perfect uniformity)
      - Keep pores visible but refined
      - Natural healthy glow, NOT porcelain/plastic
      
      === FACE SLIMMING (Subtle) ===
      - Slight V-line jaw enhancement
      - Subtle contouring, NOT dramatic reshaping
      - Maintain natural face structure
      
      === EYE ENHANCEMENT ===
      - Eyes slightly brighter and more expressive
      - Reduce dark circles
      - Natural-looking enhancement (NOT artificial)
      
      === FINAL EFFECT ===
      - Look BETTER than original but 100% REAL
      - Like a professionally retouched iPhone photo
      - Naturally beautiful, not "filtered" or "AI-generated"
      - Someone seeing this would say "great photo" not "wow AI"
    `.trim()
  },
  
  adult: {
    level: 'strong',
    brightness: 'enhanced',
    faceSlimming: 'moderate',
    eyeEnlargement: 'moderate',
    skinSmoothing: 'moderate',
    wrinkleRemoval: 'moderate',
    youthFactor: 8,
    prompt: `
      **Realistic iPhone Portrait - 8 Years Younger, 100% Real:**
      
      === CORE PRINCIPLE: REALISM FIRST (Non-Negotiable) ===
      - MUST look like a REAL photo taken with iPhone 16 Pro Max
      - CRITICAL: Keep natural skin TEXTURE and visible PORES
      - CRITICAL: Keep natural skin tone variations
      - FORBIDDEN: Plastic skin, anime look, 3D-rendered appearance
      - ALLOWED: Minor imperfections add authenticity
      - REQUIRED: Person must be 100% RECOGNIZABLE
      
      === NATURAL WRINKLE REDUCTION ===
      - Soften deep wrinkles and expression lines
      - Keep SOME fine lines (shows real skin texture)
      - Reduce crow's feet and forehead lines
      - Natural appearance, NOT frozen or "stretched"
      
      === NATURAL SKIN ENHANCEMENT ===
      - Reduce obvious acne, blemishes, age spots
      - Soften skin but KEEP TEXTURE (key difference from AI)
      - Keep pores visible (sign of real skin)
      - Even tone but NOT perfect uniformity
      - Healthy glow, NOT plastic sheen
      
      === FACE SLIMMING (Moderate) ===
      - Moderate V-line jaw enhancement
      - Slight cheekbone definition
      - Maintain natural face structure
      
      === EYE ENHANCEMENT ===
      - Eyes brighter and more expressive
      - Reduce dark circles
      - Natural catchlights preserved
      
      === LIGHTING ===
      - Professional studio multi-light setup
      - Even illumination on face
      - Natural shadow transitions
      
      === FINAL EFFECT ===
      - Look 8 years younger BUT 100% REAL
      - Like a beautifully retouched professional photo
      - Real skin texture, real pores, real person
      - NOT: plastic, anime, 3D, AI-generated
    `.trim()
  },
  
  middle_aged: {
    level: 'strong',
    brightness: 'enhanced',
    faceSlimming: 'moderate',
    eyeEnlargement: 'moderate',
    skinSmoothing: 'moderate',
    wrinkleRemoval: 'moderate',
    youthFactor: 10,
    prompt: `
      **Realistic iPhone Portrait - 10 Years Younger, 100% Real:**
      
      === CORE PRINCIPLE: REALISM FIRST (Non-Negotiable) ===
      - MUST look like a REAL photo taken with iPhone 16 Pro Max
      - CRITICAL: Keep natural skin TEXTURE and visible PORES
      - CRITICAL: Keep natural skin tone variations
      - FORBIDDEN: Plastic skin, anime look, 3D-rendered appearance
      - ALLOWED: Minor imperfections add authenticity
      - REQUIRED: Person must be 100% RECOGNIZABLE
      
      === WRINKLE REDUCTION (Natural) ===
      - Soften deep wrinkles significantly
      - Keep SOME fine lines for authenticity
      - Natural reduction, NOT complete erasure
      - Face looks relaxed, NOT frozen
      
      === SKIN ENHANCEMENT ===
      - Reduce obvious age spots, blemishes
      - Soften skin but KEEP TEXTURE
      - Keep pores visible
      - Healthy natural glow
      
      === FACE SLIMMING ===
      - Moderate V-line enhancement
      - Slight facial contouring
      
      === EYE ENHANCEMENT ===
      - Brighter, more expressive eyes
      - Reduced dark circles
      
       === FINAL EFFECT ===
       - Look 10 years younger BUT completely real
       - Professional photo retouching quality
       - Real person, real skin, real texture
     `.trim()
  },
  
  elderly: {
    level: 'gentle',
    brightness: 'enhanced',
    faceSlimming: 'subtle',
    eyeEnlargement: 'moderate',
    skinSmoothing: 'gentle',
    wrinkleRemoval: 'gentle',
    youthFactor: 8,
    prompt: `
      **Elegant Realistic Portrait - 8 Years Younger, 100% Real:**
      
      === CORE PRINCIPLE: REALISM FIRST ===
      - MUST look like a REAL photo taken with iPhone 16 Pro Max
      - Keep natural skin TEXTURE and visible PORES
      - Keep natural skin tone variations
      - FORBIDDEN: Plastic skin, anime look
      - ALLOWED: Minor imperfections add authenticity
      - REQUIRED: Person must be 100% RECOGNIZABLE
      
      === NATURAL WRINKLE REDUCTION ===
      - Gently soften deep wrinkles
      - Keep fine lines (natural aging)
      - Face looks relaxed and natural
      
      === SKIN ENHANCEMENT ===
      - Reduce obvious spots, blemishes
      - Maintain skin texture (NOT smooth)
      - Keep pores visible
      - Healthy natural glow
      
      === FACE SLIMMING ===
      - Slight V-line enhancement
      - Natural face structure maintained
      
      === EYE ENHANCEMENT ===
      - Slightly brighter eyes
      - Reduced dark circles
      
      === FINAL EFFECT ===
      - Look 8 years younger BUT completely real
      - Elegant dignified beauty preserved
      - Natural aging charm maintained
    `.trim()
  }
};

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
    glasses: 'Keep glasses style, reduce glare, enhance eyes behind frames, make eyes appear larger',
    beard: 'Groom and shape beard naturally, keep masculine character',
    dimples: 'Preserve cute dimples when smiling',
    mole: 'Keep distinctive mole as identity feature',
    scar: 'Minimize visible scars while keeping natural',
    'smile lines': 'Gently soften smile lines (nasolabial folds) while preserving natural expression'
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
  const isAsianFemale = context.ethnicity === 'asian' && context.gender === 'female';
  const asianFemaleStrategy = isAsianFemale ? ASIAN_FEMALE_STRATEGIES[context.ageGroup] : null;
  
  const skinToneAdjustment = getSkinToneAdjustment(context.skinTone);
  const faceShapeAdjustment = getFaceShapeAdjustment(context.facialFeatures.faceShape);
  const skinIssuesAdjustment = getSkinIssuesAdjustment(context.facialFeatures.skinIssues);
  const specialFeaturesNote = getSpecialFeaturesNote(context.facialFeatures.specialFeatures);
  
  let parts: string[];
  
  if (asianFemaleStrategy) {
    parts = [
      '// === Asian Female Professional Beautification ===',
      '',
      asianFemaleStrategy.prompt,
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
      '// === iPhone Real Photo Quality Requirements ===',
      '- Must look like a real iPhone 16 Pro Max photo taken in natural lighting',
      '- Keep natural skin texture and visible pores (key to realism)',
      '- Preserve authentic skin tones with natural color transitions',
      '- Include natural catchlights in eyes (realistic eye sparkle)',
      '- Realistic shadow transitions, no artificial smoothness',
      '- No plastic or overly processed appearance',
      '- No excessive whitening or unrealistic skin',
      '- Natural looking enhancements only - look better but real',
      '',
      '// === Quality Guarantees ===',
      '- Maintain original identity: must be recognizable as the same person',
      '- Natural-looking results: no over-processing or artificial appearance',
      '- Preserve unique characteristics: moles, dimples, scars, distinctive features',
      `- Beautification level: ${isAsianFemale ? asianFemaleStrategy?.level : ASIAN_FEMALE_STRATEGIES[context.ageGroup].level}`
    );
  } else {
    parts = [
      '// === Professional Photo Beautification ===',
      '',
      ASIAN_FEMALE_STRATEGIES[context.ageGroup].prompt,
      '',
      'Gender adjustment:',
      context.gender === 'female' 
        ? 'Feminine beauty touches: soft delicate features, natural subtle makeup'
        : 'Masculine refinement: strong defined features, clean natural look',
      '',
      'Ethnicity optimization:',
      context.ethnicity === 'caucasian'
        ? 'Preserve natural skin texture, enhance rosy undertones'
        : context.ethnicity === 'african'
        ? 'Enhance rich skin tone, maintain warmth and depth'
        : 'Natural skin optimization maintaining authentic characteristics',
      '',
      'Skin tone:',
      skinToneAdjustment,
      '',
      'Face shape:',
      faceShapeAdjustment,
      '',
      'Skin quality:',
      skinIssuesAdjustment,
      ''
    ];
    
    if (specialFeaturesNote) {
      parts.push('', specialFeaturesNote);
    }
    
    parts.push(
      '',
      '// === iPhone Real Photo Quality Requirements ===',
      '- Must look like a real iPhone 16 Pro Max photo taken in natural lighting',
      '- Keep natural skin texture and visible pores (key to realism)',
      '- Preserve authentic skin tones with natural color transitions',
      '- Include natural catchlights in eyes (realistic eye sparkle)',
      '- Realistic shadow transitions, no artificial smoothness',
      '- No plastic or overly processed appearance',
      '- Natural looking enhancements only - look better but real',
      '',
      '// === Quality Guarantees ===',
      '- Maintain original identity: must be recognizable as the same person',
      `- Beautification level: ${ASIAN_FEMALE_STRATEGIES[context.ageGroup].level}`
    );
  }
  
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

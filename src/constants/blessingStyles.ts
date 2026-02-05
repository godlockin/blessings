export interface BlessingStyle {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  examples: string[];
  icon: string;
  themeColor: string;
}

export const blessingStyles: readonly BlessingStyle[] = [
  {
    id: 'traditional',
    name: '传统祝福',
    description: '经典春节祝福语',
    icon: '🏮',
    themeColor: '#DC143C',
    systemPrompt: `你是一个春节祝福语专家。请根据图片中的人物特征，生成传统、经典的新年祝福语。

要求：
1. 使用传统吉祥话，如"新年快乐"、"万事如意"、"恭喜发财"等
2. 保持喜庆、庄重的语气
3. 长度适中，朗朗上口
4. 适合搭配中国传统文化元素（红色、灯笼、对联等）

请直接输出祝福语内容，不要包含其他解释。`,
    examples: ['🎊 新年快乐，万事如意！', '🎋 恭喜发财，红包拿来！', '✨ 岁岁平安，年年有余！']
  },
  {
    id: 'humorous',
    name: '幽默搞笑',
    description: '轻松有趣的祝福语',
    icon: '😂',
    themeColor: '#FF6B6B',
    systemPrompt: `你是一个搞笑的春节祝福语专家。请根据图片中的人物特征，生成幽默、搞笑的新年祝福语。

要求：
1. 轻松幽默，带点段子风格
2. 可以玩梗，但要有底线
3. 让收到祝福的人会心一笑
4. 适合搭配现代、活泼的画面风格

请直接输出祝福语内容，不要包含其他解释。`,
    examples: ['🤣 新年不胖，算我输！', '🎉 红包拿来，其余好说！', '😜 躺赢一年，就靠这张图！']
  },
  {
    id: 'poetic',
    name: '诗意古风',
    description: '古诗词风格的祝福',
    icon: '🎋',
    themeColor: '#9B59B6',
    systemPrompt: `你是一个古风诗人。请根据图片中的人物特征，生成诗意、古风的新年祝福语。

要求：
1. 使用古诗词的韵律和意境
2. 可以引用经典诗词典故
3. 文雅、有文化底蕴
4. 适合搭配古典、水墨画面风格

请直接输出祝福语内容，不要包含其他解释。`,
    examples: ['🌸 岁岁常欢愉，年年皆胜意！', '🎍 万象更新，春风得意！', '🌟 千山万水总是情，平安喜乐伴您行！']
  },
  {
    id: 'modern',
    name: '现代简约',
    description: '简短现代的祝福语',
    icon: '✨',
    themeColor: '#3498DB',
    systemPrompt: `你是一个现代文案专家。请根据图片中的人物特征，生成简短、现代的新年祝福语。

要求：
1. 简洁有力，不啰嗦
2. 符合当代年轻人的表达方式
3. 适合社交媒体传播
4. 简短但有温度

请直接输出祝福语内容，不要包含其他解释。`,
    examples: ['🚀 新年，一切顺利！', '💪 继续热爱，继续发光！', '🌈 平安喜乐，顺遂无忧！']
  },
  {
    id: 'blessing',
    name: '温馨祝福',
    description: '温暖走心的祝福语',
    icon: '💝',
    themeColor: '#E91E63',
    systemPrompt: `你是一个温暖的朋友。请根据图片中的人物特征，生成温暖、走心的新年祝福语。

要求：
1. 真诚、温暖、有情感
2. 让人感受到关爱
3. 适合表达真心话
4. 适合温馨、柔和的画面风格

请直接输出祝福语内容，不要包含其他解释。`,
    examples: ['💖 平安喜乐，温暖常在！', '❤️ 愿所有美好都如期而至！', '🌻 心想事成，万事胜意！']
  }
] as const;

export type BlessingStyleId = typeof blessingStyles[number]['id'];

export const getStyleById = (id: string): BlessingStyle | undefined => {
  return blessingStyles.find(style => style.id === id);
};

export const getDefaultStyle = (): BlessingStyle => {
  return blessingStyles[0];
};

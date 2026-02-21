// Global type definitions for the application

export interface ProcessingState {
  file: File | null;
  preview: string | null;
  result: string | null;
  isProcessing: boolean;
  steps: Step[];
  logs: string[];
  errorMessage: string | null;
  fileError: string | null; // Client-side file validation errors
}

export type StepStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

export interface ApiResponse<T = unknown> {
  error?: string;
  message?: string;
  data?: T;
}

export interface SSEEvent<T = unknown> {
  event: string;
  data: T;
}

export type DeityOption = 'none' | 'wealth' | 'love' | 'mercy' | 'career' | 'blessing';

export interface DeityConfig {
  id: DeityOption;
  name: string;
  icon: string;
  description: string;
  costume: string;
  pose: string;
  prompt: string;
}

export const DEITY_CONFIGS: Record<DeityOption, DeityConfig> = {
  none: {
    id: 'none',
    name: '不选神仙',
    icon: '🧧',
    description: '单独拍摄新年祝福照',
    costume: '喜庆的新年服饰',
    pose: '双手抱拳作揖',
    prompt: ''
  },
  wealth: {
    id: 'wealth',
    name: '武财神关羽',
    icon: '💰',
    description: '与武财神一起招财进宝',
    costume: '红色喜庆服饰，象征红红火火',
    pose: '与关羽并排站立，两人同时双手抱拳作揖拜年',
    prompt: `在人物身旁绘制武财神关羽，与人物并排站立：
      - 关羽形象：红脸长须（标志性美髯）、丹凤眼、头戴绿巾或武官帽、身穿绿色战袍或锦袍、手持青龙偃月刀
      - 关羽动作：双手抱拳作揖，与人物一起拜年
      - 两人一起拱手作揖，展现"文武财神同贺新春"的喜庆场景
      - 关羽表情威严而慈祥，带有节日喜气
      - 人物穿着：红色或金色的喜庆新年服饰，象征财运亨通`
  },
  love: {
    id: 'love',
    name: '月老',
    icon: '💕',
    description: '与月老一起祈求姻缘美满',
    costume: '粉色或红色系的温婉服饰',
    pose: '与月老相对而立，双手合十或抱拳，表达虔诚祈愿',
    prompt: `在人物身旁绘制月老，与人物相对而立：
      - 月老形象：白发长须、面容慈祥、手持红线团和姻缘簿、身穿红色或粉色长袍
      - 月老动作：一手持红线，一手轻抚胡须，微笑注视人物
      - 两人之间可有红色姻缘线轻轻相连
      - 人物穿着：粉色或红色系的温婉服饰，象征爱情甜蜜
      - 背景可增加桃花、鸳鸯等爱情元素`
  },
  mercy: {
    id: 'mercy',
    name: '观音菩萨',
    icon: '🙏',
    description: '与观音一起祈求平安健康',
    costume: '素雅端庄的白色或淡蓝色服饰',
    pose: '双手合十虔诚礼拜，或一手持莲一手合十',
    prompt: `在人物身旁绘制观音菩萨，与人物并肩或略前：
      - 观音形象：面容慈悲庄严、头戴宝冠、手持净瓶杨柳或莲花、身穿白色或淡蓝色飘逸长裙
      - 观音动作：手持净瓶洒下甘露，或手持莲花慈悲注视
      - 人物动作：双手合十虔诚礼拜
      - 人物穿着：素雅端庄的白色或淡蓝色服饰
      - 背景可增加祥云、莲花、佛光等圣洁元素`
  },
  career: {
    id: 'career',
    name: '文曲星',
    icon: '📚',
    description: '与文曲星一起祈求学业事业',
    costume: '书卷气的蓝色或青色长衫',
    pose: '与文曲星并肩，手持书卷或笔，作揖或拱手',
    prompt: `在人物身旁绘制文曲星君，与人物并肩而立：
      - 文曲星形象：面容儒雅、头戴官帽或书生巾、手持毛笔或书卷、身穿蓝色或青色官服或长衫
      - 文曲星动作：手持毛笔指点江山，或手持书卷微笑
      - 两人并肩而立，可共同探讨书卷
      - 人物穿着：书卷气的蓝色或青色长衫，象征文运昌隆
      - 背景可增加书卷、笔墨、文昌塔等文运元素`
  },
  blessing: {
    id: 'blessing',
    name: '福神',
    icon: '✨',
    description: '与福神一起祈求福气满满',
    costume: '大红色喜庆服饰，可带金色装饰',
    pose: '与福神同向站立，一起伸手送福或同时作揖',
    prompt: `在人物身旁绘制福神，与人物同向站立：
      - 福神形象：面容圆润喜庆、笑容可掬、手持"福"字或如意、身穿大红色锦袍、头戴福字帽
      - 福神动作：手持大福字，或双手捧如意，笑容满面
      - 两人一起向镜头送福，或同时作揖拜年
      - 人物穿着：大红色喜庆服饰，可带金色装饰，象征福气满满
      - 背景可增加蝙蝠（福）、如意、金元宝等福运元素`
  }
};

export interface ProcessImageRequest {
  image: string;
  inviteCode: string;
  selectedDeity?: DeityOption;
}

export interface StepEvent extends SSEEvent {
  event: 'step';
  data: {
    id: string;
    status: StepStatus;
  };
}

export interface ImageChunkEvent extends SSEEvent {
  event: 'image_chunk';
  data: {
    chunk: string;
  };
}

export interface ErrorEvent extends SSEEvent {
  event: 'error';
  data: {
    message: string;
  };
}

export interface CompleteEvent extends SSEEvent {
  event: 'complete';
  data: {
    status: string;
  };
}

// Cloudflare Functions environment
export interface Env {
  INVITE_CODE: string;
  GEMINI_API_KEY: string;
  OSS_REGION: string;
  OSS_ACCESS_KEY_ID: string;
  OSS_ACCESS_KEY_SECRET: string;
  OSS_BUCKET: string;
  OSS_ENDPOINT?: string;
  OSS_PREFIX?: string;
  ENVIRONMENT?: string;
}

// File validation types
export interface FileValidationRule {
  maxSize: number;
  allowedTypes: string[];
  maxDimensions?: {
    width: number;
    height: number;
  };
}

// Error handling types
export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;
}

export type RetryableFunction<T> = () => Promise<T>;

// Configuration constants
export const APP_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
  CHUNK_SIZE: 8192,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  REQUEST_TIMEOUT: 300000, // 5 minutes
  MEMORY_CLEANUP_INTERVAL: 5000,
  BASE64_CHUNK_SIZE: 8000,
} as const;

export const STEP_CONFIG: Step[] = [
  { id: 'audit', label: '图片审核', status: 'pending' },
  { id: 'analysis', label: '特征分析', status: 'pending' },
  { id: 'prompt', label: 'Prompt生成', status: 'pending' },
  { id: 'generation', label: '图片生成', status: 'pending' },
  { id: 'review', label: '质量复核', status: 'pending' },
] as const;
// Global type definitions for the application

export interface ProcessingState {
  file: File | null;
  preview: string | null;
  result: string | null;
  isProcessing: boolean;
  steps: Step[];
  logs: string[];
  errorMessage: string | null;
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

export interface ProcessImageRequest {
  image: string;
  inviteCode: string;
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
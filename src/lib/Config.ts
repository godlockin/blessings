export const AI_CONFIG = {
  MODEL_NAME: 'gemini-3-pro-preview',
  IMAGE_MODEL_NAME: 'gemini-3-pro-image-preview',
  IMAGE_SIZE: '1K',
  ASPECT_RATIO: '9:16',
  RESPONSE_MODALITIES: ['IMAGE'] as const,
} as const;

export const PROCESS_CONFIG = {
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  BASE64_CHUNK_SIZE: 8000,
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  REQUEST_TIMEOUT: 300000, // 5 minutes
  MEMORY_CLEANUP_INTERVAL: 5000,
} as const;

export const OSS_CONFIG = {
  CONTENT_TYPE: 'image/png',
  USER_AGENT: 'blessings-img/1.0',
  UPLOAD_TIMEOUT: 60000, // 60 seconds
} as const;

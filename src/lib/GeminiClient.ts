import { GoogleGenAI, Part } from '@google/genai';
import { AI_CONFIG } from './Config';

/**
 * Custom error for Gemini API failures with enhanced error information
 */
export class GeminiClientError extends Error {
  constructor(
    message: string,
    public originalError?: unknown,
    public code?: string
  ) {
    super(message);
    this.name = 'GeminiClientError';
  }
}

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export class GeminiClient {
  private client: GoogleGenAI;
  private model: string;
  private retryConfig: RetryConfig;

  constructor(
    apiKey: string,
    retryConfig?: Partial<RetryConfig>
  ) {
    if (!apiKey) {
      throw new GeminiClientError('API key is required');
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = AI_CONFIG.MODEL_NAME;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Execute operation with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if error is retriable
        const isRetriable = this.isRetriableError(error);
        if (!isRetriable || attempt === this.retryConfig.maxRetries) {
          throw new GeminiClientError(
            `${context} failed after ${attempt + 1} attempt(s)`,
            error,
            this.extractErrorCode(error)
          );
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, attempt),
          this.retryConfig.maxDelayMs
        );

        console.warn(
          `[GeminiClient] Retry attempt ${attempt + 1}/${this.retryConfig.maxRetries} ` +
          `after ${delay}ms for: ${context}`
        );

        await sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new GeminiClientError(`${context} failed`, lastError);
  }

  /**
   * Determine if an error is retriable
   */
  private isRetriableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const err = error as Record<string, unknown>;

    // Check for specific error codes/messages
    const errorCode = String(err.code || err.status || '');
    const errorMessage = String(err.message || '');

    // Retriable errors
    const retriableCodes = ['429', '429000', '503', '503000', '500', '500000'];
    const retriableMessages = [
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal server error',
      'timeout',
      'temporarily unavailable'
    ];

    const codeMatch = retriableCodes.some(code => errorCode.includes(code));
    const messageMatch = retriableMessages.some(msg =>
      errorMessage.toLowerCase().includes(msg)
    );

    return codeMatch || messageMatch;
  }

  /**
   * Extract error code from various error formats
   */
  private extractErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const err = error as Record<string, unknown>;
    const nestedError = err.error as Record<string, unknown> | undefined;
    return String(err.code || err.status || nestedError?.code || '');
  }

  async generateContent(
    prompt: string,
    imagePart?: Part,
    options?: {
      model?: string;
      responseModalities?: string[];
      imageSize?: string;
      aspectRatio?: string;
    }
  ): Promise<string> {
    const model = options?.model || this.model;
    const contents = imagePart
      ? [{ role: 'user' as const, parts: [{ text: prompt }, imagePart] }]
      : [{ role: 'user' as const, parts: [{ text: prompt }] }];

    const config: Record<string, unknown> = {};
    if (options?.responseModalities) {
      config.responseModalities = [...options.responseModalities];
    }
    if (options?.imageSize) {
      config.imageSize = options.imageSize;
    }
    if (options?.aspectRatio) {
      config.aspectRatio = options.aspectRatio;
    }

    const generateConfig = Object.keys(config).length > 0 ? config : {};

    return this.executeWithRetry(async () => {
      const response = await this.client.models.generateContent({
        model,
        contents,
        config: generateConfig,
      });

      if (!response.text) {
        throw new GeminiClientError('Empty response from Gemini API');
      }

      return response.text;
    }, 'generateContent');
  }

  async generateImage(prompt: string, imagePart: Part): Promise<string> {
    return this.generateContent(prompt, imagePart, {
      model: AI_CONFIG.IMAGE_MODEL_NAME,
      responseModalities: ['IMAGE'] as string[],
      imageSize: AI_CONFIG.IMAGE_SIZE,
      aspectRatio: AI_CONFIG.ASPECT_RATIO,
    });
  }

  /**
   * 分析两张图片（原图和生成图）进行对比评估
   * 用于美颜专家组的端到端审核
   */
  async analyzeImagePair(
    originalImageBase64: string,
    generatedImageBase64: string,
    analysisPrompt: string
  ): Promise<string> {
    const originalPart: Part = {
      inlineData: {
        data: originalImageBase64,
        mimeType: 'image/jpeg'
      }
    };

    const generatedPart: Part = {
      inlineData: {
        data: generatedImageBase64,
        mimeType: 'image/png'
      }
    };

    return this.executeWithRetry(async () => {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: analysisPrompt },
              { text: '\n\n【原图 (Original Image)】:\n' },
              originalPart,
              { text: '\n\n【生成图 (Generated Image)】:\n' },
              generatedPart
            ]
          }
        ]
      });

      if (!response.text) {
        throw new GeminiClientError('Empty response from Gemini API during image pair analysis');
      }

      return response.text;
    }, 'analyzeImagePair');
  }
}

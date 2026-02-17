/**
 * 极速重度美颜工作流
 * Heavy Beautify Workflow - Maximum Beauty Mode
 *
 *  bypass 复杂专家讨论，直接生成强美颜效果
 */

import { GeminiClient } from './GeminiClient';
import { OSSService, UploadResult } from './OSSService';

export interface HeavyBeautifyResult {
  success: boolean;
  imageUrl: string;
  prompt: string;
  ossResult?: UploadResult | undefined;
}

export class HeavyBeautifyWorkflow {
  private client: GeminiClient;
  private ossService: OSSService | null;
  private saveToOSS: boolean;

  constructor(
    client: GeminiClient,
    options?: { ossService?: OSSService; saveToOSS?: boolean }
  ) {
    this.client = client;
    this.ossService = options?.ossService || null;
    this.saveToOSS = options?.saveToOSS ?? true;
  }

  /**
   * 极速处理 - 直接生成重度美颜效果
   */
  async process(
    _imageBase64: string,
    analysisText: string,
    generateImageFn: (prompt: string) => Promise<string>
  ): Promise<HeavyBeautifyResult> {
    console.log('[HeavyBeautify] Starting maximum beauty mode...');
    void this.client; // Reference to silence unused warning

    // 直接构建强美颜 prompt，跳过所有专家讨论
    const prompt = this.buildHeavyBeautifyPrompt(analysisText);

    console.log('[HeavyBeautify] Generated heavy beautify prompt:', prompt.substring(0, 200) + '...');

    // 直接生成图像
    const imageUrl = await generateImageFn(prompt);

    // 上传 OSS
    let ossResult: UploadResult | undefined;
    if (this.saveToOSS && this.ossService) {
      const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
      const filename = `blessing-heavy-${Date.now()}.png`;
      ossResult = await this.ossService.uploadBase64(base64Data, filename);
    }

    return {
      success: true,
      imageUrl,
      prompt,
      ossResult
    };
  }

  /**
   * 构建重度美颜 Prompt - 美颜优先，真实感其次
   */
  private buildHeavyBeautifyPrompt(analysisText: string): string {
    return `Professional heavy beauty portrait photo for Chinese New Year, aggressive beautification applied:

**SUBJECT - MAXIMUM BEAUTY ENHANCEMENT:**
${analysisText}

**AGGRESSIVE BEAUTIFICATION (Priority #1):**
- DRAMATIC brightening: overall image 50-70% brighter, glowing luminous effect
- HEAVY skin smoothing: porcelain doll-like skin, zero pores, zero texture, flawless finish
- EXTREME eye enlargement: eyes 1.5-2x larger, bright sparkling eyes with catchlights
- SIGNIFICANT face slimming: small V-line face, narrow jawline, delicate chin
- COMPLETE wrinkle removal: zero wrinkles, zero lines, smooth youthful skin
- HEAVY anti-aging: person looks 15-20 years younger
- Skin whitening: fair porcelain skin tone, glowing from within
- Teeth whitening: bright white teeth
- Lip enhancement: pink glossy lips
- Cheek blush: rosy healthy flush

**TECHNICAL QUALITY:**
- Professional studio lighting with beauty dish and ring light
- Soft focus effect for dreamy look
- Shallow depth of field, blurred background
- High-key lighting for bright cheerful atmosphere
- Photo-realistic style (NOT anime/3D/cartoon)

**CHINESE NEW YEAR THEME:**
- Wearing elegant traditional Chinese clothing (Qipao for women, Tang suit for men)
- Red and gold festive colors
- Chinese New Year background with lanterns, decorations
- Warm festive lighting
- Traditional "gongxi" hand gesture

**CRITICAL - IDENTITY PRESERVATION:**
- Must be recognizable as the same person
- Keep key facial features (nose shape, face shape, expression)
- Just make them much more beautiful and younger

Style: High-end beauty retouching, magazine cover quality, glamorous attractive look.`;
  }

  /**
   * 带 retry 的处理
   */
  async processWithRetry(
    imageBase64: string,
    analysisText: string,
    generateImageFn: (prompt: string) => Promise<string>,
    maxRetries: number = 2
  ): Promise<HeavyBeautifyResult> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.process(imageBase64, analysisText, generateImageFn);
        return result;
      } catch (error) {
        console.error(`[HeavyBeautify] Attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) throw error;
      }
    }
    throw new Error('All retry attempts failed');
  }
}

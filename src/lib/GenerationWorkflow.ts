import { GeminiClient } from './GeminiClient';
import { PromptGenerator } from './PromptGenerator';
import { ImageReviewer, GenerationContext, ReviewResult } from './ImageReviewer';

export interface GenerationConfig {
  maxRetries: number;
  passingScore: number;
  verboseLogging: boolean;
}

export interface GenerationResult {
  success: boolean;
  imageUrl: string;
  prompt: string;
  reviewHistory: ReviewResult[];
  analysis: string;
  context: GenerationContext;
}

export class GenerationWorkflow {
  private promptGenerator: PromptGenerator;
  private imageReviewer: ImageReviewer;
  private config: GenerationConfig;

  constructor(client: GeminiClient, config?: Partial<GenerationConfig>) {
    this.promptGenerator = new PromptGenerator(client);
    this.imageReviewer = new ImageReviewer(client);
    
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      passingScore: config?.passingScore ?? 8.0,
      verboseLogging: config?.verboseLogging ?? true
    };

    this.imageReviewer.setMaxIterations(this.config.maxRetries);
    this.imageReviewer.setPassingScore(this.config.passingScore);
  }

  async process(
    analysisText: string,
    generateImageFn: (prompt: string) => Promise<string>
  ): Promise<GenerationResult> {
    if (this.config.verboseLogging) {
      console.log('[Workflow] Starting generation workflow...');
      console.log('[Workflow] Input analysis:', analysisText);
    }

    const { context, prompt } = await this.promptGenerator.buildFullPrompt(analysisText);

    if (this.config.verboseLogging) {
      console.log('[Workflow] Generated prompt length:', prompt.length);
      console.log('[Workflow] Is Asian Female:', context.isAsianFemale);
      console.log('[Workflow] Age Group:', context.ageGroup);
    }

    const result = await this.imageReviewer.reviewWithRetry(
      context,
      generateImageFn
    );

    return {
      success: result.success,
      imageUrl: result.finalImageUrl,
      prompt: result.finalPrompt,
      reviewHistory: result.reviewHistory,
      analysis: analysisText,
      context
    };
  }

  getFinalReviewSummary(result: GenerationResult): string {
    if (result.success) {
      return `Generation SUCCEEDED after ${result.reviewHistory.length} attempt(s)
Final Score: ${result.reviewHistory[result.reviewHistory.length - 1].score.overallScore}/10

Score Breakdown:
- Realism: ${result.reviewHistory[result.reviewHistory.length - 1].score.realism}/10
- Skin Quality: ${result.reviewHistory[result.reviewHistory.length - 1].score.skinQuality}/10
- Face Slimming: ${result.reviewHistory[result.reviewHistory.length - 1].score.faceSlimming}/10
- Wrinkle Removal: ${result.reviewHistory[result.reviewHistory.length - 1].score.wrinkleRemoval}/10
- Eye Enhancement: ${result.reviewHistory[result.reviewHistory.length - 1].score.eyeEnhancement}/10
- Brightness: ${result.reviewHistory[result.reviewHistory.length - 1].score.brightness}/10
- Identity Preservation: ${result.reviewHistory[result.reviewHistory.length - 1].score.identityPreservation}/10`;
    } else {
      return `Generation FAILED after ${result.reviewHistory.length} attempt(s)
Best Score: ${result.reviewHistory[result.reviewHistory.length - 1].score.overallScore}/10
Issues: ${result.reviewHistory[result.reviewHistory.length - 1].issues.join(', ')}`;
    }
  }
}

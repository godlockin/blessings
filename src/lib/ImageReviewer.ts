import { GeminiClient } from './GeminiClient';

/**
 * Default score values used when review fails or cannot parse response
 * Represents a neutral/unknown quality assessment
 */
const DEFAULT_SCORES: ReviewCriteria = {
  realism: 5,
  skinQuality: 5,
  faceSlimming: 5,
  wrinkleRemoval: 5,
  eyeEnhancement: 5,
  brightness: 5,
  identityPreservation: 5,
  overallScore: 5
} as const;

export interface ReviewCriteria {
  realism: number;
  skinQuality: number;
  faceSlimming: number;
  wrinkleRemoval: number;
  eyeEnhancement: number;
  brightness: number;
  identityPreservation: number;
  overallScore: number;
}

export interface ReviewResult {
  passed: boolean;
  score: ReviewCriteria;
  issues: string[];
  suggestions: string[];
  iteration: number;
}

export interface GenerationContext {
  originalAnalysis: string;
  prompt: string;
  imageUrl?: string;
  ageGroup: string;
  isAsianFemale: boolean;
}

export class ImageReviewer {
  private client: GeminiClient;
  private maxIterations: number = 3;
  private passingScore: number = 8.0;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  setMaxIterations(iterations: number): void {
    this.maxIterations = iterations;
  }

  setPassingScore(score: number): void {
    this.passingScore = score;
  }

  async reviewGeneratedImage(
    context: GenerationContext
  ): Promise<ReviewResult> {
    const reviewPrompt = this.buildReviewPrompt(context);
    const response = await this.client.generateContent(reviewPrompt);
    
    return this.parseReviewResponse(response, 1);
  }

  private buildReviewPrompt(context: GenerationContext): string {
    return `You are a professional image quality reviewer. Please review this generated image against the quality standards.

Original Person Description:
${context.originalAnalysis}

Prompt Used:
${context.prompt}

Review Criteria:

1. Realism - Does it look like iPhone real photo?
   - 10: Completely natural, like real photo
   - 7: Mostly realistic with minor AI traces
   - 4: Noticeable plastic/AI look
   - 1: Not realistic at all

2. Skin Quality - Skin smoothing, acne removal
   - 10: Perfect porcelain skin, all issues removed
   - 7: Noticeable skin improvement
   - 4: Minor improvement
   - 1: Issues still visible

3. Face Slimming - V-line small face effect
   - 10: Very obvious V-line slimming effect
   - 7: Noticeable slimming effect
   - 4: Minor effect
   - 1: No effect

4. Wrinkle Removal - Complete wrinkle erasure
   - 10: All wrinkles completely removed
   - 7: Most wrinkles removed
   - 4: Some wrinkles removed
   - 1: Wrinkles still visible

5. Eye Enhancement - Eye enlargement and brightness
   - 10: Eyes significantly enlarged and bright
   - 7: Noticeable improvement
   - 4: Minor improvement
   - 1: No improvement

6. Brightness - Face illumination
   - 10: Perfect studio lighting, even brightness
   - 7: Noticeable brightness improvement
   - 4: Minor improvement
   - 1: Face still dull

7. Identity Preservation - Can recognize as same person
   - 10: Completely recognizable
   - 7: Mostly recognizable
   - 4: Somewhat different
   - 1: Not recognizable

8. Overall Score

Special Requirements:
${context.isAsianFemale ? `For Chinese/Asian women:
- Need to look 12-15 years younger
- Strong face slimming effect required
- Deep wrinkle removal required
- Professional studio lighting required
- Big eyes effect required` : ''}

Please reply in the following JSON format only:
{
  "passed": true/false,
  "realism": 1-10,
  "skinQuality": 1-10,
  "faceSlimming": 1-10,
  "wrinkleRemoval": 1-10,
  "eyeEnhancement": 1-10,
  "brightness": 1-10,
  "identityPreservation": 1-10,
  "overallScore": 1-10,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;
  }

  private parseReviewResponse(response: string, iteration: number): ReviewResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createFailedResult('Cannot parse review result', iteration);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const criteria: ReviewCriteria = {
        realism: Math.min(10, Math.max(1, parsed.realism || 5)),
        skinQuality: Math.min(10, Math.max(1, parsed.skinQuality || 5)),
        faceSlimming: Math.min(10, Math.max(1, parsed.faceSlimming || 5)),
        wrinkleRemoval: Math.min(10, Math.max(1, parsed.wrinkleRemoval || 5)),
        eyeEnhancement: Math.min(10, Math.max(1, parsed.eyeEnhancement || 5)),
        brightness: Math.min(10, Math.max(1, parsed.brightness || 5)),
        identityPreservation: Math.min(10, Math.max(1, parsed.identityPreservation || 5)),
        overallScore: Math.min(10, Math.max(1, parsed.overallScore || 5))
      };

      const passed = criteria.overallScore >= this.passingScore;

      return {
        passed,
        score: criteria,
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        iteration
      };
    } catch (error) {
      return this.createFailedResult(`Parse error: ${error}`, iteration);
    }
  }

  private createFailedResult(error: string, iteration: number): ReviewResult {
    return {
      passed: false,
      score: { ...DEFAULT_SCORES },
      issues: [error],
      suggestions: ['Please regenerate'],
      iteration
    };
  }

  async generateImprovedPrompt(
    originalPrompt: string,
    issues: string[],
    suggestions: string[],
    context: GenerationContext
  ): Promise<string> {
    const improvePrompt = `You are a Prompt optimization expert. Please optimize the prompt based on the review feedback.

Original Prompt:
${originalPrompt}

Issues Found:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Suggestions:
${suggestions.map((sug, i) => `${i + 1}. ${sug}`).join('\n')}

Person Info:
- Age Group: ${context.ageGroup}
- Asian Female: ${context.isAsianFemale ? 'Yes' : 'No'}
- Original Description: ${context.originalAnalysis}

Please generate an optimized English prompt that addresses all issues and meets quality standards.
Output only the optimized prompt, no explanations.`;

    return this.client.generateContent(improvePrompt);
  }

  async reviewWithRetry(
    context: GenerationContext,
    generateImageFn: (prompt: string) => Promise<string>
  ): Promise<{
    success: boolean;
    finalImageUrl: string;
    finalPrompt: string;
    reviewHistory: ReviewResult[];
  }> {
    const reviewHistory: ReviewResult[] = [];
    let currentPrompt = context.prompt;
    let finalImageUrl = '';
    let success = false;

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      console.log(`[Review] Iteration ${iteration}...`);

      const imageUrlResult = await generateImageFn(currentPrompt);
      finalImageUrl = imageUrlResult;

      const reviewResult = await this.reviewGeneratedImage(context);
      reviewResult.iteration = iteration;
      reviewHistory.push(reviewResult);

      console.log(`[Review] Overall Score: ${reviewResult.score.overallScore}/10`);

      if (reviewResult.passed) {
        console.log(`[Review] Iteration ${iteration} PASSED!`);
        success = true;
        break;
      } else {
        console.log(`[Review] Iteration ${iteration} FAILED`);
        console.log(`[Review] Issues: ${reviewResult.issues.join(', ')}`);

        if (iteration < this.maxIterations) {
          console.log(`[Review] Optimizing prompt...`);
          currentPrompt = await this.generateImprovedPrompt(
            currentPrompt,
            reviewResult.issues,
            reviewResult.suggestions,
            context
          );
          console.log(`[Review] Ready for iteration ${iteration + 1}`);
        }
      }
    }

    if (!success) {
      console.log(`[Review] After ${this.maxIterations} attempts, final score: ${reviewHistory[reviewHistory.length - 1].score.overallScore}/10`);
    }

    return {
      success,
      finalImageUrl,
      finalPrompt: currentPrompt,
      reviewHistory
    };
  }
}

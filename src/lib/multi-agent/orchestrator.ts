import { GeminiClient } from '../GeminiClient';
import { 
  ExpertRole, 
  ExpertOpinion, 
  QualityScores, 
  WorkflowState, 
  WorkflowConfig,
  DEFAULT_CONFIG 
} from './types';
import { EXPERT_PROMPTS, GROUP_DISCUSSION_PROMPT, PROMPT_GENERATION_PROMPT, FINAL_REVIEW_PROMPT } from './expertPrompts';

export class MultiExpertOrchestrator {
  private client: GeminiClient;
  private config: WorkflowConfig;
  private activeExperts: ExpertRole[];

  constructor(client: GeminiClient, config?: Partial<WorkflowConfig>) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.activeExperts = [
      'portrait_photographer',
      'story_director',
      'senior_makeup_artist',
      'senior_costume_designer',
      'senior_retoucher',
      'beauty_expert',
      'final_reviewer'
    ];
  }

  setActiveExperts(experts: ExpertRole[]): void {
    this.activeExperts = experts;
  }

  async analyzeIndividually(
    originalAnalysis: string,
    _imageBase64?: string
  ): Promise<Map<ExpertRole, ExpertOpinion>> {
    console.log('[Multi-Expert] Starting individual expert analysis...');
    
    const analyses = new Map<ExpertRole, ExpertOpinion>();
    
    for (const expert of this.activeExperts) {
      if (expert === 'final_reviewer') continue;
      
      try {
        const prompt = EXPERT_PROMPTS[expert];
        const response = await this.queryExpert(prompt, originalAnalysis);
        const opinion = this.parseExpertResponse(expert, response);
        analyses.set(expert, opinion);
        
        console.log(`[Multi-Expert] ${expert}: Score ${opinion.score}/10, Approved: ${opinion.approved}`);
      } catch (error) {
        console.error(`[Multi-Expert] Error analyzing with ${expert}:`, error);
      }
    }
    
    return analyses;
  }

  async facilitateDiscussion(
    originalAnalysis: string,
    analyses: Map<ExpertRole, ExpertOpinion>,
    isAsianFemale: boolean,
    ageGroup: string,
    targetYouthYears: number
  ): Promise<{
    consensus: string;
    agreedRequirements: WorkflowState['agreedRequirements'];
    remainingDisagreements: string[];
  }> {
    console.log('[Multi-Expert] Facilitating group discussion...');
    
    const expertOpinionsText = Array.from(analyses.entries())
      .map(([role, opinion]) => `${role}: ${opinion.analysis}`)
      .join('\n\n');
    
    const promptTemplate = GROUP_DISCUSSION_PROMPT
      .replace('{{originalAnalysis}}', originalAnalysis)
      .replace('{{isAsianFemale}}', String(isAsianFemale))
      .replace('{{ageGroup}}', ageGroup)
      .replace('{{targetYouthYears}}', String(targetYouthYears))
      .replace('{{expertOpinions}}', expertOpinionsText);
    
    const response = await this.client.generateContent(promptTemplate);
    
    try {
      const parsed = JSON.parse(response);
      return {
        consensus: parsed.consensus || 'Consensus reached',
        agreedRequirements: {
          lighting: parsed.agreed_requirements?.lighting || [],
          makeup: parsed.agreed_requirements?.makeup || [],
          costume: parsed.agreed_requirements?.costume || [],
          pose: parsed.agreed_requirements?.pose || [],
          background: parsed.agreed_requirements?.background || [],
          beautification: parsed.agreed_requirements?.beautification || [],
          technical: parsed.agreed_requirements?.technical || []
        },
        remainingDisagreements: parsed.remaining_disagreements || []
      };
    } catch {
      return this.createDefaultConsensus(originalAnalysis, isAsianFemale);
    }
  }

  async generateUnifiedPrompt(
    originalAnalysis: string,
    agreedRequirements: WorkflowState['agreedRequirements'],
    analyses: Map<ExpertRole, ExpertOpinion>
  ): Promise<string> {
    console.log('[Multi-Expert] Generating unified prompt from expert consensus...');
    
    const expertInputs = Array.from(analyses.entries())
      .map(([role, opinion]) => {
        const keyRecommendations = opinion.recommendations.slice(0, 3).join('; ');
        return `${role}: ${keyRecommendations}`;
      })
      .join('\n');
    
    const promptTemplate = PROMPT_GENERATION_PROMPT
      .replace('{{originalAnalysis}}', originalAnalysis)
      .replace('{{agreedRequirements}}', JSON.stringify(agreedRequirements, null, 2))
      .replace('{{expertInputs}}', expertInputs);
    
    const response = await this.client.generateContent(promptTemplate);
    
    try {
      const parsed = JSON.parse(response);
      return parsed.prompt || response;
    } catch {
      return response;
    }
  }

  async conductFinalReview(
    originalAnalysis: string,
    _generatedImage: string,
    agreedRequirements: WorkflowState['agreedRequirements'],
    expertScores: Map<ExpertRole, number>
  ): Promise<{
    approved: boolean;
    scores: QualityScores;
    decision: 'approved' | 'rejected' | 'needs_revision';
    issues: string[];
    suggestions: string[];
  }> {
    console.log('[Multi-Expert] Conducting final quality review...');
    
    const photographerScore = expertScores.get('portrait_photographer') || 5;
    const makeupScore = expertScores.get('senior_makeup_artist') || 5;
    const costumeScore = expertScores.get('senior_costume_designer') || 5;
    const retoucherScore = expertScores.get('senior_retoucher') || 5;
    const storyScore = expertScores.get('story_director') || 5;
    const beautyScore = expertScores.get('beauty_expert') || 5;
    
    const prompt = FINAL_REVIEW_PROMPT
      .replace('{{agreedRequirements}}', JSON.stringify(agreedRequirements, null, 2))
      .replace('{{originalAnalysis}}', originalAnalysis)
      .replace('{{photographerScore}}', String(photographerScore))
      .replace('{{makeupScore}}', String(makeupScore))
      .replace('{{costumeScore}}', String(costumeScore))
      .replace('{{retoucherScore}}', String(retoucherScore))
      .replace('{{storyScore}}', String(storyScore))
      .replace('{{beautyScore}}', String(beautyScore));
    
    const response = await this.client.generateContent(prompt);
    
    try {
      const parsed = JSON.parse(response);
      const overall = parsed.detailed_scores?.overall || 
        (photographerScore + makeupScore + costumeScore + retoucherScore + storyScore + beautyScore) / 6;
      
      return {
        approved: parsed.approved || overall >= this.config.passingScore,
        scores: {
          realism: parsed.detailed_scores?.realism || photographerScore,
          skinQuality: parsed.detailed_scores?.skinQuality || makeupScore,
          faceSlimming: parsed.detailed_scores?.faceSlimming || beautyScore * 0.8,
          wrinkleRemoval: parsed.detailed_scores?.wrinkleRemoval || beautyScore * 0.9,
          eyeEnhancement: parsed.detailed_scores?.eyeEnhancement || makeupScore * 0.9,
          brightness: parsed.detailed_scores?.brightness || photographerScore * 0.9,
          identityPreservation: parsed.detailed_scores?.identityPreservation || 7,
          composition: parsed.detailed_scores?.composition || storyScore * 0.8,
          lighting: parsed.detailed_scores?.lighting || photographerScore * 0.9,
          overall
        },
        decision: parsed.final_decision || (overall >= this.config.passingScore ? 'approved' : 'needs_revision'),
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || []
      };
    } catch {
      const overall = (photographerScore + makeupScore + costumeScore + retoucherScore + storyScore + beautyScore) / 6;
      return {
        approved: overall >= this.config.passingScore,
        scores: {
          realism: photographerScore,
          skinQuality: makeupScore,
          faceSlimming: beautyScore * 0.8,
          wrinkleRemoval: beautyScore * 0.9,
          eyeEnhancement: makeupScore * 0.9,
          brightness: photographerScore * 0.9,
          identityPreservation: 7,
          composition: storyScore * 0.8,
          lighting: photographerScore * 0.9,
          overall
        },
        decision: overall >= this.config.passingScore ? 'approved' : 'needs_revision',
        issues: [],
        suggestions: overall < this.config.passingScore ? ['Score below threshold, consider regeneration'] : []
      };
    }
  }

  async optimizePromptBasedOnReview(
    currentPrompt: string,
    issues: string[],
    suggestions: string[],
    originalAnalysis: string
  ): Promise<string> {
    console.log('[Multi-Expert] Optimizing prompt based on review feedback...');
    
    const optimizePrompt = `You are a Prompt Optimization Expert. Based on the review feedback, optimize the current prompt.

Current Prompt:
${currentPrompt}

Issues Found:
${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Suggestions for Improvement:
${suggestions.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

Original Analysis:
${originalAnalysis}

Please generate an optimized prompt that addresses all issues while maintaining quality in other areas.
Output only the optimized prompt, no explanations.`;

    return this.client.generateContent(optimizePrompt);
  }

  private async queryExpert(
    systemPrompt: string,
    context: string
  ): Promise<string> {
    const fullPrompt = `${systemPrompt}

Context/Input to analyze:
${context}

Please provide your analysis in the specified JSON format.`;

    return this.client.generateContent(fullPrompt);
  }

  private parseExpertResponse(role: ExpertRole, response: string): ExpertOpinion {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          role,
          name: parsed.name || role,
          analysis: parsed.analysis || '',
          recommendations: parsed.recommendations || [],
          score: Math.min(10, Math.max(1, parsed.score || 5)),
          approved: parsed.approved !== false,
          concerns: parsed.concerns || []
        };
      }
    } catch {
      // Fallback parsing
    }
    
    return {
      role,
      name: role,
      analysis: response.substring(0, 500),
      recommendations: [],
      score: 5,
      approved: true
    };
  }

  private createDefaultConsensus(
    _originalAnalysis: string,
    isAsianFemale: boolean
  ): {
    consensus: string;
    agreedRequirements: WorkflowState['agreedRequirements'];
    remainingDisagreements: string[];
  } {
    const baseRequirements = {
      lighting: [
        'Professional studio multi-light setup',
        'Key light + fill light + rim light',
        'Even face illumination',
        'Natural catchlights in eyes'
      ],
      makeup: [
        'Natural makeup look',
        'Even skin tone',
        'Subtle eye enhancement'
      ],
      costume: [
        'Traditional Chinese festive attire',
        'Red/gold color scheme',
        'Professional appearance'
      ],
      pose: [
        'Traditional Chinese greeting pose',
        'Full body composition',
        'Friendly expression'
      ],
      background: [
        'Chinese New Year theme',
        'Red decorations',
        'Festive atmosphere'
      ],
      beautification: isAsianFemale ? [
        'Face slimming (V-line)',
        'Skin perfection',
        'Youth enhancement'
      ] : [
        'Natural skin improvement',
        'Brightening',
        'Quality enhancement'
      ],
      technical: [
        'iPhone 16 Pro Max realistic style',
        'Natural skin texture',
        'High quality output'
      ]
    };

    return {
      consensus: 'Experts reached consensus on basic requirements',
      agreedRequirements: baseRequirements,
      remainingDisagreements: []
    };
  }

  calculateOverallScore(scores: Map<ExpertRole, number>): number {
    const relevantScores = Array.from(scores.values());
    if (relevantScores.length === 0) return 5;
    return relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length;
  }
}

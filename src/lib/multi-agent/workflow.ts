import { GeminiClient } from '../GeminiClient';
import { MultiExpertOrchestrator } from './orchestrator';
import { 
  ExpertRole, 
  ExpertOpinion, 
  QualityScores, 
  WorkflowState, 
  WorkflowConfig,
  DEFAULT_CONFIG 
} from './types';
import type { ImageAnalyzer } from '../ImageAnalyzer';

export interface MultiAgentResult {
  success: boolean;
  imageUrl: string;
  prompt: string;
  iteration: number;
  qualityScores: QualityScores;
  expertOpinions: Map<ExpertRole, ExpertOpinion>;
  discussionHistory: WorkflowState['discussionHistory'];
  finalDecision: 'approved' | 'rejected' | 'needs_revision';
  issues: string[];
  fullAuditTrail: AuditEntry[];
}

export interface AuditEntry {
  timestamp: string;
  phase: string;
  action: string;
  details: string;
  expert?: string | null;
}

export class MultiAgentWorkflow {
  private orchestrator: MultiExpertOrchestrator;
  private client: GeminiClient;
  private config: WorkflowConfig;
  private auditTrail: AuditEntry[];
  private imageAnalyzer: ImageAnalyzer;

  constructor(
    client: GeminiClient,
    imageAnalyzer: ImageAnalyzer,
    config?: Partial<WorkflowConfig>
  ) {
    this.client = client;
    this.orchestrator = new MultiExpertOrchestrator(client, config);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.auditTrail = [];
    this.imageAnalyzer = imageAnalyzer;
  }

  async process(
    imageBase64: string,
    generateImageFn: (prompt: string) => Promise<string>
  ): Promise<MultiAgentResult> {
    this.auditTrail = [];
    void this.client; // Reference to silence unused warning
    console.log('[Multi-Agent] Starting multi-expert workflow...');
    
    this.log('analysis', 'start', 'Analyzing original image...');
    
    const originalAnalysis = await this.imageAnalyzer.analyze({ 
      inlineData: { data: imageBase64, mimeType: 'image/png' } 
    });
    
    this.log('analysis', 'complete', `Analysis complete`);
    
    const isAsianFemale = this.detectAsianFemale(originalAnalysis);
    const ageGroup = this.detectAgeGroup(originalAnalysis);
    const targetYouthYears = this.getTargetYouthYears(ageGroup, isAsianFemale);
    
    let currentPrompt = '';
    let bestImageUrl = '';
    let bestScore: QualityScores = this.createEmptyScores();
    let expertOpinions = new Map<ExpertRole, ExpertOpinion>();
    let discussionHistory: WorkflowState['discussionHistory'] = [];
    let finalDecision: 'approved' | 'rejected' | 'needs_revision' = 'needs_revision';
    let issues: string[] = [];
    
    for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
      console.log(`[Multi-Agent] Iteration ${iteration}/${this.config.maxIterations}`);
      this.log('prompt_generation', 'start', `Iteration ${iteration}`);
      
      this.log('expert_individual_analysis', 'start', 'All experts analyzing...');
      expertOpinions = await this.orchestrator.analyzeIndividually(originalAnalysis);
      this.log('expert_individual_analysis', 'complete', `All ${expertOpinions.size} experts completed`);
      
      this.log('group_discussion', 'start', 'Facilitating expert discussion...');
      const { consensus, agreedRequirements, remainingDisagreements: _disagreements } = 
        await this.orchestrator.facilitateDiscussion(
          originalAnalysis,
          expertOpinions,
          isAsianFemale,
          ageGroup,
          targetYouthYears
        );
      
      discussionHistory.push({
        round: iteration,
        topic: 'consensus_building',
        opinions: Array.from(expertOpinions.values()),
        consensus
      });
      
      this.log('group_discussion', 'complete', `Consensus: ${consensus.substring(0, 50)}...`);
      
      currentPrompt = await this.orchestrator.generateUnifiedPrompt(
        originalAnalysis,
        agreedRequirements,
        expertOpinions
      );
      
      this.log('prompt_generation', 'complete', `Prompt generated (${currentPrompt.length} chars)`);
      
      this.log('image_generation', 'start', 'Generating image...');
      const imageUrl = await generateImageFn(currentPrompt);
      bestImageUrl = imageUrl;
      this.log('image_generation', 'complete', 'Image generated');
      
      this.log('final_review', 'start', 'Conducting final quality review...');
      const expertScores = this.calculateExpertScores(expertOpinions);
      
      const reviewResult = await this.orchestrator.conductFinalReview(
        originalAnalysis,
        imageUrl,
        agreedRequirements,
        expertScores
      );
      
      bestScore = reviewResult.scores;
      finalDecision = reviewResult.decision;
      issues = reviewResult.issues;
      
      this.log('final_review', 'complete', 
        `Decision: ${finalDecision}, Score: ${reviewResult.scores.overall.toFixed(1)}/10`);
      
      if (finalDecision === 'approved' && reviewResult.scores.overall >= this.config.passingScore) {
        console.log(`[Multi-Agent] Iteration ${iteration} PASSED!`);
        break;
      } else {
        console.log(`[Multi-Agent] Iteration ${iteration} needs improvement`);
        
        if (iteration < this.config.maxIterations) {
          this.log('prompt_optimization', 'start', 'Optimizing prompt...');
          currentPrompt = await this.orchestrator.optimizePromptBasedOnReview(
            currentPrompt,
            reviewResult.issues,
            reviewResult.suggestions,
            originalAnalysis
          );
          this.log('prompt_optimization', 'complete', 'Prompt optimized');
        }
      }
    }
    
    return {
      success: finalDecision === 'approved',
      imageUrl: bestImageUrl,
      prompt: currentPrompt,
      iteration: this.auditTrail.filter(e => e.phase === 'image_generation').length,
      qualityScores: bestScore,
      expertOpinions,
      discussionHistory,
      finalDecision,
      issues,
      fullAuditTrail: this.auditTrail
    };
  }

  private log(
    phase: string, 
    action: string, 
    details: string, 
    expert: string | null = null
  ): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      phase,
      action,
      details,
      expert
    };
    this.auditTrail.push(entry);
    console.log(`[Audit] ${phase}/${action}: ${details}`);
  }

  private detectAsianFemale(analysis: string): boolean {
    const lower = analysis.toLowerCase();
    const isAsian = lower.includes('asian') || lower.includes('chinese') || lower.includes('east asian');
    const isFemale = lower.includes('woman') || lower.includes('female') || lower.includes('girl');
    return isAsian && isFemale && !lower.includes('male') && !lower.includes('man');
  }

  private detectAgeGroup(analysis: string): string {
    const lower = analysis.toLowerCase();
    const numberMatch = analysis.match(/\b(\d{1,3})\s*(year|岁)/i);
    const age = numberMatch ? parseInt(numberMatch[1], 10) : null;
    
    if (age !== null) {
      if (age <= 12) return 'child';
      if (age <= 19) return 'teenager';
      if (age <= 35) return 'young_adult';
      if (age <= 50) return 'adult';
      return 'elderly';
    }
    
    if (lower.includes('middle') || lower.includes('40') || lower.includes('50')) return 'middle_aged';
    if (lower.includes('elderly') || lower.includes('60') || lower.includes('senior')) return 'elderly';
    if (lower.includes('teen')) return 'teenager';
    return 'adult';
  }

  private getTargetYouthYears(ageGroup: string, isAsianFemale: boolean): number {
    if (!isAsianFemale) return 0;
    
    const targets: Record<string, number> = {
      child: 0,
      teenager: 0,
      young_adult: 0,
      adult: 12,
      middle_aged: 15,
      elderly: 10
    };
    
    return targets[ageGroup] || 8;
  }

  private calculateExpertScores(analyses: Map<ExpertRole, ExpertOpinion>): Map<ExpertRole, number> {
    const scores = new Map<ExpertRole, number>();
    for (const [role, opinion] of analyses) {
      scores.set(role, opinion.score);
    }
    return scores;
  }

  private createEmptyScores(): QualityScores {
    return {
      realism: 0, skinQuality: 0, faceSlimming: 0, wrinkleRemoval: 0,
      eyeEnhancement: 0, brightness: 0, identityPreservation: 0,
      composition: 0, lighting: 0, overall: 0
    };
  }

  getAuditTrail(): AuditEntry[] {
    return this.auditTrail;
  }

  generateReport(result: MultiAgentResult): string {
    const status = result.success ? 'SUCCESS' : 'FAILED';
    const decision = result.finalDecision.toUpperCase();
    
    return `
╔══════════════════════════════════════════════════════════════╗
║           MULTI-EXPERT WORKFLOW FINAL REPORT               ║
╠══════════════════════════════════════════════════════════════╣
║ Status: ${status}                                              ║
║ Iterations: ${result.iteration}/${this.config.maxIterations}                                        ║
║ Final Decision: ${decision}                                      ║
╠══════════════════════════════════════════════════════════════╣
║ QUALITY SCORES (Target: ${this.config.passingScore}/10)                    ║
║ ------------------------------------------------------------ ║
║ Realism:              ${result.qualityScores.realism.toFixed(1)}/10                          ║
║ Skin Quality:         ${result.qualityScores.skinQuality.toFixed(1)}/10                          ║
║ Face Slimming:       ${result.qualityScores.faceSlimming.toFixed(1)}/10                         ║
║ Wrinkle Removal:     ${result.qualityScores.wrinkleRemoval.toFixed(1)}/10                          ║
║ Eye Enhancement:     ${result.qualityScores.eyeEnhancement.toFixed(1)}/10                          ║
║ Brightness:          ${result.qualityScores.brightness.toFixed(1)}/10                          ║
║ Identity Preservation: ${result.qualityScores.identityPreservation.toFixed(1)}/10                       ║
║ OVERALL:             ${result.qualityScores.overall.toFixed(1)}/10                          ║
╠══════════════════════════════════════════════════════════════╣
${result.issues.length > 0 ? `║ ISSUES: ${result.issues[0]}                              ║\n` : ''}
╚══════════════════════════════════════════════════════════════╝
`.trim();
  }
}

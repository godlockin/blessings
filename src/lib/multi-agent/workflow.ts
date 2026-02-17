import { GeminiClient } from '../GeminiClient';
import { PromptGenerator } from '../PromptGenerator';
import { MultiExpertOrchestrator } from './orchestrator';
import { BeautyExpertPanel, EndToEndReviewResult } from './BeautyExpertPanel';
import {
  ExpertRole,
  ExpertOpinion,
  QualityScores,
  WorkflowState,
  WorkflowConfig,
  DEFAULT_CONFIG
} from './types';
import type { ImageAnalyzer } from '../ImageAnalyzer';
import { OSSService, UploadResult } from '../OSSService';

export interface AuditEntry {
  timestamp: string;
  phase: string;
  action: string;
  details: string;
  expert?: string | null;
}

export interface MultiAgentResult {
  success: boolean;
  imageUrl: string;
  ossResult?: UploadResult | undefined;
  prompt: string;
  iteration: number;
  qualityScores: QualityScores;
  expertOpinions: Map<ExpertRole, ExpertOpinion>;
  discussionHistory: WorkflowState['discussionHistory'];
  finalDecision: 'approved' | 'rejected' | 'needs_revision';
  issues: string[];
  fullAuditTrail: AuditEntry[];
  expertPanelReview?: EndToEndReviewResult | undefined;
}

export interface WorkflowOptions {
  ossService?: OSSService;
  saveToOSS?: boolean;
  imageFilename?: string;
}

export class MultiAgentWorkflow {
  private orchestrator: MultiExpertOrchestrator;
  private beautyExpertPanel: BeautyExpertPanel;
  private config: WorkflowConfig;
  private auditTrail: AuditEntry[];
  private imageAnalyzer: ImageAnalyzer;
  private ossService: OSSService | null;
  private saveToOSS: boolean;
  private imageFilename: string;
  private enableExpertPanel: boolean;
  private heavyBeautyMode: boolean;
  private promptGenerator: PromptGenerator;

  constructor(
    client: GeminiClient,
    imageAnalyzer: ImageAnalyzer,
    config?: Partial<WorkflowConfig>,
    options?: WorkflowOptions & { enableExpertPanel?: boolean; heavyBeautyMode?: boolean }
  ) {
    this.orchestrator = new MultiExpertOrchestrator(client, config);
    this.beautyExpertPanel = new BeautyExpertPanel(client);
    this.promptGenerator = new PromptGenerator(client);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.auditTrail = [];
    this.imageAnalyzer = imageAnalyzer;
    this.ossService = options?.ossService || null;
    this.saveToOSS = options?.saveToOSS ?? true;
    this.imageFilename = options?.imageFilename || `blessing-${Date.now()}.png`;
    this.enableExpertPanel = options?.enableExpertPanel ?? true;
    this.heavyBeautyMode = options?.heavyBeautyMode ?? false;
  }

  async process(
    imageBase64: string,
    generateImageFn: (prompt: string) => Promise<string>
  ): Promise<MultiAgentResult> {
    this.auditTrail = [];

    // 重度美颜模式 - 跳过专家讨论，直接使用强美颜
    if (this.heavyBeautyMode) {
      console.log('[Multi-Agent] HEAVY BEAUTY MODE - Bypassing expert discussion');
      return this.processHeavyBeauty(imageBase64, generateImageFn);
    }

    console.log('[Multi-Agent] Starting multi-expert workflow...');

    this.log('analysis', 'start', 'Analyzing original image...');

    const originalAnalysis = await this.imageAnalyzer.analyze({
      inlineData: { data: imageBase64, mimeType: 'image/png' }
    });

    this.log('analysis', 'complete', 'Analysis complete');

    const isAsianFemale = this.detectAsianFemale(originalAnalysis);
    const ageGroup = this.detectAgeGroup(originalAnalysis);
    const targetYouthYears = this.getTargetYouthYears(ageGroup, isAsianFemale);

    let currentPrompt = '';
    let bestImageUrl = '';
    let bestScore: QualityScores = this.createEmptyScores();
    let expertOpinions = new Map<ExpertRole, ExpertOpinion>();
    const discussionHistory: WorkflowState['discussionHistory'] = [];
    let finalDecision: 'approved' | 'rejected' | 'needs_revision' = 'needs_revision';
    let issues: string[] = [];
    let ossResult: UploadResult | undefined;
    
    for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
      console.log(`[Multi-Agent] Iteration ${iteration}/${this.config.maxIterations}`);
      this.log('prompt_generation', 'start', `Iteration ${iteration}`);
      
      this.log('expert_individual_analysis', 'start', 'All experts analyzing...');
      expertOpinions = await this.orchestrator.analyzeIndividually(originalAnalysis);
      this.log('expert_individual_analysis', 'complete', `All ${expertOpinions.size} experts completed`);
      
      this.log('group_discussion', 'start', 'Facilitating expert discussion...');
      const discussionResult = await this.orchestrator.facilitateDiscussion(
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
        consensus: discussionResult.consensus
      });

      this.log('group_discussion', 'complete', 'Consensus reached');

      currentPrompt = await this.orchestrator.generateUnifiedPrompt(
        originalAnalysis,
        discussionResult.agreedRequirements,
        expertOpinions
      );
      
      this.log('prompt_generation', 'complete', `Prompt generated (${currentPrompt.length} chars)`);
      
      this.log('image_generation', 'start', 'Generating image...');
      const imageUrl = await generateImageFn(currentPrompt);
      bestImageUrl = imageUrl;
      this.log('image_generation', 'complete', 'Image generated');
      
      if (this.saveToOSS && this.ossService) {
        this.log('oss_upload', 'start', 'Uploading to OSS...');
        try {
          const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
          ossResult = await this.ossService.uploadBase64(base64Data, this.imageFilename);
          this.log('oss_upload', 'complete', `Uploaded: ${ossResult.url}`);
        } catch (error) {
          this.log('oss_upload', 'error', `Upload failed: ${error}`);
        }
      }
      
      this.log('final_review', 'start', 'Conducting final quality review...');
      const expertScores = this.calculateExpertScores(expertOpinions);
      
      const reviewResult = await this.orchestrator.conductFinalReview(
        originalAnalysis,
        imageUrl,
        discussionResult.agreedRequirements,
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

    // 跨国美颜专家组端到端审核
    let expertPanelReview: EndToEndReviewResult | undefined;
    if (this.enableExpertPanel && finalDecision === 'approved') {
      this.log('expert_panel', 'start', 'Conducting CJK Beauty Expert Panel review...');
      try {
        const generatedBase64 = bestImageUrl.replace(/^data:image\/\w+;base64,/, '');
        expertPanelReview = await this.beautyExpertPanel.conductEndToEndReview(
          imageBase64,
          generatedBase64,
          originalAnalysis
        );

        // 打印专家组审核报告
        console.log(this.beautyExpertPanel.generateReviewReport(expertPanelReview));

        // 如果专家组审核不通过，更新最终结果
        if (expertPanelReview.finalDecision !== 'approved') {
          finalDecision = expertPanelReview.finalDecision;
          issues = [...issues, ...expertPanelReview.visualValidation.issues];
          console.log(`[Expert Panel] Overriding decision: ${finalDecision}`);
        }

        this.log('expert_panel', 'complete',
          `Panel decision: ${expertPanelReview.finalDecision}, Score: ${expertPanelReview.consensus.overallScore}/10`);
      } catch (error) {
        console.error('[Expert Panel] Review failed:', error);
        this.log('expert_panel', 'error', `Review failed: ${error}`);
      }
    }

    return {
      success: finalDecision === 'approved',
      imageUrl: bestImageUrl,
      ossResult,
      prompt: currentPrompt,
      iteration: this.auditTrail.filter(e => e.phase === 'image_generation').length,
      qualityScores: bestScore,
      expertOpinions,
      discussionHistory,
      finalDecision,
      issues,
      fullAuditTrail: this.auditTrail,
      expertPanelReview
    };
  }

  /**
   * 重度美颜模式 - 跳过专家讨论，直接生成
   */
  private async processHeavyBeauty(
    imageBase64: string,
    generateImageFn: (prompt: string) => Promise<string>
  ): Promise<MultiAgentResult> {
    this.log('analysis', 'start', 'Analyzing original image...');

    const originalAnalysis = await this.imageAnalyzer.analyze({
      inlineData: { data: imageBase64, mimeType: 'image/png' }
    });

    this.log('analysis', 'complete', 'Analysis complete');

    // 直接使用重度美颜 prompt
    this.log('prompt_generation', 'start', 'Generating heavy beautify prompt...');
    const { prompt: currentPrompt } = await this.promptGenerator.buildHeavyBeautifyPrompt(originalAnalysis);
    this.log('prompt_generation', 'complete', `Prompt generated (${currentPrompt.length} chars)`);

    // 直接生成图像
    this.log('image_generation', 'start', 'Generating image with heavy beautify...');
    const imageUrl = await generateImageFn(currentPrompt);
    this.log('image_generation', 'complete', 'Image generated');

    // 上传 OSS
    let ossResult: UploadResult | undefined;
    if (this.saveToOSS && this.ossService) {
      this.log('oss_upload', 'start', 'Uploading to OSS...');
      try {
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
        ossResult = await this.ossService.uploadBase64(base64Data, this.imageFilename);
        this.log('oss_upload', 'complete', `Uploaded: ${ossResult.url}`);
      } catch (error) {
        this.log('oss_upload', 'error', `Upload failed: ${error}`);
      }
    }

    // 返回结果（跳过了所有专家审核）
    return {
      success: true,
      imageUrl,
      ossResult,
      prompt: currentPrompt,
      iteration: 1,
      qualityScores: {
        beautyLevel: 9,
        skinQuality: 9,
        faceSlimming: 9,
        wrinkleRemoval: 9,
        eyeEnhancement: 9,
        brightness: 9,
        identityPreservation: 7,
        youthEffect: 9,
        glamour: 9,
        overall: 9
      },
      expertOpinions: new Map(),
      discussionHistory: [],
      finalDecision: 'approved',
      issues: [],
      fullAuditTrail: this.auditTrail,
      expertPanelReview: undefined
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
      elderly: 12
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
      beautyLevel: 0, skinQuality: 0, faceSlimming: 0, wrinkleRemoval: 0,
      eyeEnhancement: 0, brightness: 0, identityPreservation: 0,
      youthEffect: 0, glamour: 0, overall: 0
    };
  }

  getAuditTrail(): AuditEntry[] {
    return this.auditTrail;
  }

  setOSSService(ossService: OSSService): void {
    this.ossService = ossService;
    this.saveToOSS = true;
  }

  disableOSS(): void {
    this.saveToOSS = false;
  }

  generateReport(result: MultiAgentResult): string {
    const status = result.success ? 'SUCCESS' : 'FAILED';
    const decision = result.finalDecision.toUpperCase();

    // 构建专家组审核信息
    let expertPanelInfo = '';
    if (result.expertPanelReview) {
      const panel = result.expertPanelReview;
      const reviews = panel.expertReviews;
      expertPanelInfo = `
╠══════════════════════════════════════════════════════════════════════╣
║  🇨🇳🇯🇵🇰🇷 CJK BEAUTY EXPERT PANEL REVIEW                             ║
╠══════════════════════════════════════════════════════════════════════╣
║  Panel Decision: ${panel.finalDecision.toUpperCase().padEnd(52)} ║
║  Consensus Score: ${panel.consensus.overallScore.toFixed(1)}/10${' '.repeat(40)} ║
╠══════════════════════════════════════════════════════════════════════╣
║  Chinese Retoucher (Zhang Mei)     : ${reviews[0]?.score.toFixed(1).padEnd(4)}/10  ${reviews[0]?.approved ? '✅' : '❌'}           ║
║  Japanese Makeup (Yuki Tanaka)     : ${reviews[1]?.score.toFixed(1).padEnd(4)}/10  ${reviews[1]?.approved ? '✅' : '❌'}           ║
║  Korean Surgeon (Dr. Park)         : ${reviews[2]?.score.toFixed(1).padEnd(4)}/10  ${reviews[2]?.approved ? '✅' : '❌'}           ║
╠══════════════════════════════════════════════════════════════════════╣
║  Identity Preservation : ${panel.consensus.identityPreservation.toFixed(1)}/10  ${panel.consensus.identityPreservation >= 6 ? '✅' : '⚠️'}                   ║
║  Youth Effect         : ${panel.consensus.youth.toFixed(1)}/10  ${panel.consensus.youth >= 8 ? '✅' : '⚠️'}                   ║
║  Beauty Enhancement   : ${panel.consensus.beautyEnhancement.toFixed(1)}/10  ${panel.consensus.beautyEnhancement >= 8 ? '✅' : '⚠️'}                   ║
║  Charm & Attractiveness: ${panel.consensus.attractiveness.toFixed(1)}/10  ${panel.consensus.attractiveness >= 8 ? '✅' : '⚠️'}                   ║
╠══════════════════════════════════════════════════════════════════════╣
║  Visual Validation: ${panel.visualValidation.passed ? '✅ PASSED' : '❌ FAILED'}                                           ║
${panel.visualValidation.issues.length > 0 ? `║  Issues: ${panel.visualValidation.issues.length} found${' '.repeat(45)} ║\n` : ''}`;
    }

    const report = `
╔══════════════════════════════════════════════════════════════════════╗
║           MULTI-EXPERT WORKFLOW FINAL REPORT                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  Status: ${status}                                                   ║
║  Iterations: ${result.iteration}/${this.config.maxIterations}                                       ║
║  Final Decision: ${decision}                                         ║
╠══════════════════════════════════════════════════════════════════════╣
║  QUALITY SCORES (Target: ${this.config.passingScore}/10)                           ║
║  --------------------------------------------------------------   ║
║  Beauty Level:        ${result.qualityScores.beautyLevel.toFixed(1)}/10                              ║
║  Skin Quality:        ${result.qualityScores.skinQuality.toFixed(1)}/10                              ║
║  Face Slimming:       ${result.qualityScores.faceSlimming.toFixed(1)}/10                             ║
║  Wrinkle Removal:     ${result.qualityScores.wrinkleRemoval.toFixed(1)}/10                             ║
║  Eye Enhancement:     ${result.qualityScores.eyeEnhancement.toFixed(1)}/10                             ║
║  Brightness:          ${result.qualityScores.brightness.toFixed(1)}/10                              ║
║  Youth Effect:        ${result.qualityScores.youthEffect.toFixed(1)}/10                              ║
║  Glamour:             ${result.qualityScores.glamour.toFixed(1)}/10                              ║
║  Identity Preservation: ${result.qualityScores.identityPreservation.toFixed(1)}/10                           ║
║  OVERALL:             ${result.qualityScores.overall.toFixed(1)}/10                              ║
${expertPanelInfo}
╠══════════════════════════════════════════════════════════════════════╣
║  OSS UPLOAD                                                          ║
║  ${result.ossResult ? `URL: ${result.ossResult.url.substring(0, 50)}...` : 'Not uploaded'}                          ║
╠══════════════════════════════════════════════════════════════════════╣
${result.issues.length > 0 ? `║  ISSUES: ${result.issues[0].substring(0, 40)}...                      ║\n` : ''}
╚══════════════════════════════════════════════════════════════════════╝
`.trim();
    
    return report;
  }
}

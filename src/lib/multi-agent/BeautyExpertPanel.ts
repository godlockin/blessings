/**
 * 跨国美颜专家组审核系统
 * Chinese-Japanese-Korean Beauty Expert Panel
 *
 * 由中国美颜修图师、日本化妆师、韩国整容师组成的专家组
 * 进行端到端的严格审核，确保画面真实自然但更具魅力
 */

import { GeminiClient } from '../GeminiClient';

export interface ExpertReviewResult {
  expert: string;
  role: string;
  score: number;
  approved: boolean;
  analysis: string;
  specificScores: Record<string, number>;
  recommendations: string[];
  concerns: string[];
}

export interface EndToEndReviewResult {
  originalImage: string;
  generatedImage: string;
  expertReviews: ExpertReviewResult[];
  consensus: {
    overallScore: number;
    identityPreservation: number;
    youth: number;
    beautyEnhancement: number;
    charm: number;
    attractiveness: number;
  };
  finalDecision: 'approved' | 'rejected' | 'needs_revision';
  improvementPrompt: string;
  visualValidation: {
    passed: boolean;
    issues: string[];
  };
}

export class BeautyExpertPanel {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  /**
   * 端到端专家组审核流程
   * 三位专家同时审核原图和生成图，给出专业意见
   */
  async conductEndToEndReview(
    originalImageBase64: string,
    generatedImageBase64: string,
    originalAnalysis: string
  ): Promise<EndToEndReviewResult> {
    console.log('[BeautyExpertPanel] Starting end-to-end expert review...');

    // 三位专家并行审核
    const [chineseReview, japaneseReview, koreanReview] = await Promise.all([
      this.chineseRetoucherReview(originalImageBase64, generatedImageBase64, originalAnalysis),
      this.japaneseMakeupArtistReview(originalImageBase64, generatedImageBase64, originalAnalysis),
      this.koreanSurgeonReview(originalImageBase64, generatedImageBase64, originalAnalysis)
    ]);

    const expertReviews = [chineseReview, japaneseReview, koreanReview];

    // 专家组讨论达成共识
    const consensus = await this.expertConsensusBuilding(expertReviews);

    // 视觉验证
    const visualValidation = await this.visualValidation(
      originalImageBase64,
      generatedImageBase64,
      expertReviews
    );

    // 生成改进prompt（如果需要）
    const improvementPrompt = await this.generateImprovementPrompt(
      expertReviews,
      consensus,
      visualValidation
    );

    // 最终决策
    const finalDecision = this.makeFinalDecision(expertReviews, consensus, visualValidation);

    return {
      originalImage: originalImageBase64,
      generatedImage: generatedImageBase64,
      expertReviews,
      consensus,
      finalDecision,
      improvementPrompt,
      visualValidation
    };
  }

  /**
   * 中国美颜修图师审核
   * 专注：美图风格、美颜效果、皮肤提亮、大眼瘦脸
   */
  private async chineseRetoucherReview(
    originalImage: string,
    generatedImage: string,
    originalAnalysis: string
  ): Promise<ExpertReviewResult> {
    const prompt = `你是中国顶级美颜修图师张美，专研美图秀秀、醒图等软件的重度美颜效果。

请对比分析原图和生成图，评估美颜效果（不要求真实，要求好看）。

原图分析：${originalAnalysis}

审核重点（重度美颜模式）：
1. 美图效果 - 是否像高品质美图修图后的照片（重度美颜）
2. 皮肤 - 是否白皙、光滑、磨皮效果好（不需要纹理）
3. 眼睛 - 是否明显放大、明亮有神
4. 脸型 - 是否明显瘦脸、小V脸
5. 气色 - 是否红润、精神、年轻
6. 减龄 - 是否看起来比原图年轻10-15岁
7. 只要不像3D/动画即可

评分标准（美颜优先）：
- 9-10分：完美 - 明显美白、大眼、瘦脸、年轻、 glamorous
- 7-8分：良好美颜效果，小瑕疵
- 5-6分：一般，美颜不够明显
- 3-4分：较差，美颜效果弱
- 1-2分：失败，或像3D/动画

请输出JSON格式：
{
  "score": 1-10,
  "specificScores": {
    "beauty_level": 1-10,
    "skin_brightness": 1-10,
    "eye_enlargement": 1-10,
    "face_slimming": 1-10,
    "youth_effect": 1-10,
    "overall_beauty": 1-10
  },
  "analysis": "详细分析...",
  "recommendations": ["建议1", "建议2"],
  "concerns": ["问题1", "问题2"],
  "approved": true/false
}`;

    try {
      const response = await this.client.analyzeImagePair(originalImage, generatedImage, prompt);
      const parsed = this.parseExpertResponse(response);

      return {
        expert: 'Zhang Mei',
        role: 'Chinese Beauty Retoucher',
        score: parsed.score,
        approved: parsed.approved,
        analysis: parsed.analysis,
        specificScores: parsed.specificScores,
        recommendations: parsed.recommendations,
        concerns: parsed.concerns
      };
    } catch (error) {
      console.error('[ChineseRetoucher] Review failed:', error);
      return this.getDefaultReview('Zhang Mei', 'Chinese Beauty Retoucher');
    }
  }

  /**
   * 日本化妆师审核
   * 专注：透明感、光泽感、魅力妆容
   */
  private async japaneseMakeupArtistReview(
    originalImage: string,
    generatedImage: string,
    originalAnalysis: string
  ): Promise<ExpertReviewResult> {
    const prompt = `你是日本顶级化妆师田中雪，专研日系魅力妆容（透明感・輝きメイク）。

请对比分析原图和生成图，评估美颜效果（不要求自然，要求好看）。

原图分析：${originalAnalysis}

审核重点（魅力美颜模式）：
1. 透明感 - 皮肤是否透亮、有光泽、白皙
2. 光泽感 - 是否水润明亮（ツヤ肌）
3. 眼睛 - 是否放大、明亮、有神
4. 魅力 - 整体是否吸引人、有气质
5. 年轻感 - 是否看起来比原图更年轻
6. 只要不像3D/动画即可

评分标准（美颜优先）：
- 9-10分：完美 - 透亮光泽、大眼、明亮、有魅力
- 7-8分：良好美颜效果，小瑕疵
- 5-6分：一般，美颜不够明显
- 3-4分：较差，美颜效果弱
- 1-2分：失败，或像3D/动画

请输出JSON格式：
{
  "score": 1-10,
  "specificScores": {
    "radiance": 1-10,
    "brightness": 1-10,
    "eye_beauty": 1-10,
    "charm": 1-10,
    "youth": 1-10,
    "overall_glow": 1-10
  },
  "analysis": "详细分析...",
  "recommendations": ["建议1", "建议2"],
  "concerns": ["问题1", "问题2"],
  "approved": true/false
}`;

    try {
      const response = await this.client.analyzeImagePair(originalImage, generatedImage, prompt);
      const parsed = this.parseExpertResponse(response);

      return {
        expert: 'Yuki Tanaka',
        role: 'Japanese Makeup Artist',
        score: parsed.score,
        approved: parsed.approved,
        analysis: parsed.analysis,
        specificScores: parsed.specificScores,
        recommendations: parsed.recommendations,
        concerns: parsed.concerns
      };
    } catch (error) {
      console.error('[JapaneseMakeup] Review failed:', error);
      return this.getDefaultReview('Yuki Tanaka', 'Japanese Makeup Artist');
    }
  }

  /**
   * 韩国整容师审核
   * 专注：黄金比例、V脸轮廓、美颜效果
   */
  private async koreanSurgeonReview(
    originalImage: string,
    generatedImage: string,
    originalAnalysis: string
  ): Promise<ExpertReviewResult> {
    const prompt = `你是韩国江南区顶级整容顾问朴智勋医生，专研美颜级面部轮廓优化。

请对比分析原图和生成图，评估美颜效果（不要求自然，要求好看）。

原图分析：${originalAnalysis}

审核重点（美颜整容标准）：
1. 黄金比例 - 面部比例是否更美观（不要太在意自然）
2. 面部轮廓 - 是否明显瘦脸、小V脸
3. 眼睛 - 是否明显放大、有神
4. 鼻子 - 是否更精致、美观
5. 五官协调 - 整体是否更和谐、好看
6. 身份保持 - 必须能认出是同一个人
7. 只要不像3D/动画即可

评分标准（美颜优先）：
- 9-10分：完美 - 明显瘦脸、大眼、精致、年轻10-15岁
- 7-8分：良好美颜效果，小瑕疵
- 5-6分：一般，美颜不够明显
- 3-4分：较差，美颜效果弱
- 1-2分：失败，或像3D/动画

请输出JSON格式：
{
  "score": 1-10,
  "specificScores": {
    "beauty_ratio": 1-10,
    "v_line": 1-10,
    "eye_size": 1-10,
    "refinement": 1-10,
    "harmony": 1-10,
    "identity": 1-10,
    "youth": 1-10
  },
  "analysis": "详细分析...",
  "recommendations": ["建议1", "建议2"],
  "concerns": ["问题1", "问题2"],
  "approved": true/false
}`;

    try {
      const response = await this.client.analyzeImagePair(originalImage, generatedImage, prompt);
      const parsed = this.parseExpertResponse(response);

      return {
        expert: 'Dr. Park Ji-hoon',
        role: 'Korean Plastic Surgery Consultant',
        score: parsed.score,
        approved: parsed.approved,
        analysis: parsed.analysis,
        specificScores: parsed.specificScores,
        recommendations: parsed.recommendations,
        concerns: parsed.concerns
      };
    } catch (error) {
      console.error('[KoreanSurgeon] Review failed:', error);
      return this.getDefaultReview('Dr. Park Ji-hoon', 'Korean Plastic Surgery Consultant');
    }
  }

  /**
   * 专家组讨论达成共识
   */
  private async expertConsensusBuilding(
    reviews: ExpertReviewResult[]
  ): Promise<EndToEndReviewResult['consensus']> {
    const scores = reviews.map(r => r.score);
    const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // 提取特定维度的平均分
    const identityPreservation = this.averageSpecificScore(reviews, 'identity') ||
                                  this.averageSpecificScore(reviews, 'identity_preservation');

    // 计算魅力和吸引力（综合各专家的关键指标）
    const beautyEnhancement = this.averageSpecificScore(reviews, 'beauty_level') ||
                               this.averageSpecificScore(reviews, 'overall_beauty') ||
                               this.averageSpecificScore(reviews, 'radiance') ||
                               this.averageSpecificScore(reviews, 'beauty_ratio') ||
                               overallScore;

    const youth = this.averageSpecificScore(reviews, 'youth') ||
                  this.averageSpecificScore(reviews, 'youth_effect');

    const charm = this.averageSpecificScore(reviews, 'charm') ||
                  this.averageSpecificScore(reviews, 'eye_beauty') ||
                  overallScore;

    // 吸引力 = 美颜效果 + 年轻感 + 魅力
    const attractiveness = (beautyEnhancement + youth + charm) / 3;

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      identityPreservation: Math.round(identityPreservation * 10) / 10 || 7,
      youth: Math.round(youth * 10) / 10 || 7,
      beautyEnhancement: Math.round(beautyEnhancement * 10) / 10,
      charm: Math.round(charm * 10) / 10,
      attractiveness: Math.round(attractiveness * 10) / 10
    };
  }

  /**
   * 视觉验证 - 检查图像质量和技术问题
   */
  private async visualValidation(
    _originalImage: string,
    _generatedImage: string,
    reviews: ExpertReviewResult[]
  ): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];

    // 汇总三位专家发现的所有问题
    reviews.forEach(review => {
      review.concerns.forEach(concern => {
        if (!issues.includes(concern)) {
          issues.push(concern);
        }
      });
    });

    // 关键指标检查
    const criticalIssues = issues.filter(issue =>
      issue.includes('plastic') ||
      issue.includes('unnatural') ||
      issue.includes('identity') ||
      issue.includes('失真') ||
      issue.includes('整容')
    );

    // 如果有严重问题，验证不通过
    const passed = criticalIssues.length === 0 && issues.length <= 3;

    return { passed, issues };
  }

  /**
   * 生成改进Prompt（当审核不通过时）
   */
  private async generateImprovementPrompt(
    reviews: ExpertReviewResult[],
    _consensus: EndToEndReviewResult['consensus'],
    visualValidation: { passed: boolean; issues: string[] }
  ): Promise<string> {
    const allRecommendations = reviews.flatMap(r => r.recommendations);
    const allConcerns = [...visualValidation.issues, ...reviews.flatMap(r => r.concerns)];

    const uniqueConcerns = [...new Set(allConcerns)].slice(0, 5);
    const keyRecommendations = [...new Set(allRecommendations)].slice(0, 5);

    const improvementGuide = `
基于中国美颜修图师、日本化妆师、韩国整容师的联合审核，需要以下改进：

**必须修复的问题**：
${uniqueConcerns.map((c, i) => `${i + 1}. ${c}`).join('\n')}

**专家建议**：
${keyRecommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**美颜优化方向（优先级从高到低）**：
1. 大幅提亮整体画面 - 皮肤白皙透亮
2. 明显放大眼睛 - 大眼有神
3. 明显瘦脸 - 小V脸效果
4. 完全去除皱纹 - 磨皮美肤
5. 减龄10-15岁 - 年轻有活力
6. 提升整体气质和吸引力

**基本要求**：
1. 必须能认出是同一个人（身份保持）
2. 不能看起来像3D建模或动画
3. 照片风格，但有明显的美颜效果
`;

    return improvementGuide;
  }

  /**
   * 做出最终决策
   */
  private makeFinalDecision(
    reviews: ExpertReviewResult[],
    consensus: EndToEndReviewResult['consensus'],
    visualValidation: { passed: boolean; issues: string[] }
  ): 'approved' | 'rejected' | 'needs_revision' {
    const allApproved = reviews.every(r => r.approved);
    const averageScore = consensus.overallScore;
    const minScore = Math.min(...reviews.map(r => r.score));

    // 严格标准：必须所有专家都认可
    if (allApproved && averageScore >= 8.0 && minScore >= 7 && visualValidation.passed) {
      return 'approved';
    }

    // 如果有严重问题，拒绝
    if (minScore < 5 || visualValidation.issues.length > 5) {
      return 'rejected';
    }

    // 需要改进
    return 'needs_revision';
  }

  /**
   * 解析专家响应
   */
  private parseExpertResponse(response: string): {
    score: number;
    approved: boolean;
    analysis: string;
    specificScores: Record<string, number>;
    recommendations: string[];
    concerns: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(10, Math.max(1, parsed.score || 5)),
          approved: parsed.approved !== false,
          analysis: parsed.analysis || '',
          specificScores: parsed.specificScores || {},
          recommendations: parsed.recommendations || [],
          concerns: parsed.concerns || []
        };
      }
    } catch {
      // Fallback
    }

    return {
      score: 5,
      approved: false,
      analysis: response.substring(0, 500),
      specificScores: {},
      recommendations: [],
      concerns: ['Parsing failed']
    };
  }

  /**
   * 获取默认审核结果（失败时）
   */
  private getDefaultReview(expert: string, role: string): ExpertReviewResult {
    return {
      expert,
      role,
      score: 5,
      approved: false,
      analysis: 'Review failed, using default assessment',
      specificScores: {},
      recommendations: ['Retry review'],
      concerns: ['Review process failed']
    };
  }

  /**
   * 计算特定维度的平均分
   */
  private averageSpecificScore(reviews: ExpertReviewResult[], key: string): number {
    const scores = reviews
      .map(r => r.specificScores[key])
      .filter((s): s is number => typeof s === 'number');

    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * 生成审核报告
   */
  generateReviewReport(result: EndToEndReviewResult): string {
    const decision = result.finalDecision.toUpperCase();
    const reviews = result.expertReviews;

    const report = `
╔══════════════════════════════════════════════════════════════════╗
║     跨国美颜专家组审核报告 (CJK Beauty Expert Panel Report)      ║
╠══════════════════════════════════════════════════════════════════╣
║ 最终决策: ${decision.padEnd(50)} ║
║ 综合评分: ${result.consensus.overallScore.toFixed(1)}/10${' '.repeat(38)} ║
╠══════════════════════════════════════════════════════════════════╣
║ 专家评分详情                                                     ║
╠══════════════════════════════════════════════════════════════════╣
║ 🇨🇳 中国美颜修图师 (张美)     : ${reviews[0]?.score.toFixed(1).padEnd(5)}/10  ${reviews[0]?.approved ? '✅通过' : '❌未通过'}           ║
║ 🇯🇵 日本化妆师 (田中雪)       : ${reviews[1]?.score.toFixed(1).padEnd(5)}/10  ${reviews[1]?.approved ? '✅通过' : '❌未通过'}           ║
║ 🇰🇷 韩国整容师 (朴智勋医生)   : ${reviews[2]?.score.toFixed(1).padEnd(5)}/10  ${reviews[2]?.approved ? '✅通过' : '❌未通过'}           ║
╠══════════════════════════════════════════════════════════════════╣
║ 综合评估指标                                                     ║
╠══════════════════════════════════════════════════════════════════╣
║ 身份保持度     : ${result.consensus.identityPreservation.toFixed(1)}/10  ${result.consensus.identityPreservation >= 6 ? '✅' : '⚠️'}                   ║
║ 年轻感         : ${result.consensus.youth.toFixed(1)}/10  ${result.consensus.youth >= 8 ? '✅' : '⚠️'}                   ║
║ 美颜提升度     : ${result.consensus.beautyEnhancement.toFixed(1)}/10  ${result.consensus.beautyEnhancement >= 8 ? '✅' : '⚠️'}                   ║
║ 魅力指数       : ${result.consensus.charm.toFixed(1)}/10  ${result.consensus.charm >= 8 ? '✅' : '⚠️'}                   ║
║ 吸引力评分     : ${result.consensus.attractiveness.toFixed(1)}/10  ${result.consensus.attractiveness >= 8 ? '✅' : '⚠️'}                   ║
╠══════════════════════════════════════════════════════════════════╣
║ 视觉验证: ${result.visualValidation.passed ? '✅ 通过' : '❌ 未通过'}                                           ║
║ 发现问题: ${result.visualValidation.issues.length} 项                                          ║
╚══════════════════════════════════════════════════════════════════╝

${result.visualValidation.issues.length > 0 ? `
【待修复问题】
${result.visualValidation.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}
` : ''}

${result.finalDecision !== 'approved' ? `
【改进建议】
${result.improvementPrompt.substring(0, 500)}...
` : ''}
`;

    return report;
  }
}

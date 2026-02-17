/**
 * 跨国美颜专家组使用示例
 * CJK Beauty Expert Panel Usage Example
 *
 * 展示如何使用中国美颜修图师、日本化妆师、韩国整容师组成的专家组
 * 进行端到端的图片质量审核
 */

import { GeminiClient } from '../GeminiClient';
import { ImageAnalyzer } from '../ImageAnalyzer';
import { MultiAgentWorkflow } from './workflow';
import { BeautyExpertPanel } from './BeautyExpertPanel';

/**
 * 示例1: 完整工作流 + 专家组审核
 */
export async function exampleWithExpertPanel() {
  // 初始化客户端
  const client = new GeminiClient(process.env.GEMINI_API_KEY || '');
  const imageAnalyzer = new ImageAnalyzer(client);

  // 创建工作流，启用专家组审核
  const workflow = new MultiAgentWorkflow(client, imageAnalyzer, {
    maxIterations: 3,
    passingScore: 8.0
  }, {
    enableExpertPanel: true,  // 启用跨国专家组
    saveToOSS: false
  });

  // 假设这是用户上传的原图（base64）
  const originalImageBase64 = '...'; // 用户原图

  // 定义生成图片的函数（实际实现中调用Gemini API）
  const generateImage = async (_prompt: string): Promise<string> => {
    // 调用图像生成API
    // 这里返回生成的图片base64
    return 'data:image/png;base64,...';
  };

  // 执行完整工作流
  const result = await workflow.process(originalImageBase64, generateImage);

  // 输出结果
  console.log(workflow.generateReport(result));

  // 检查专家组审核结果
  if (result.expertPanelReview) {
    const panel = result.expertPanelReview;

    console.log('\n=== 跨国美颜专家组审核详情 ===');

    // 查看每位专家的评分
    panel.expertReviews.forEach(review => {
      console.log(`\n${review.expert} (${review.role}):`);
      console.log(`  总分: ${review.score}/10`);
      console.log(`  审核: ${review.approved ? '✅ 通过' : '❌ 未通过'}`);
      console.log(`  分析: ${review.analysis.substring(0, 100)}...`);

      // 查看具体维度评分
      console.log('  详细评分:');
      Object.entries(review.specificScores).forEach(([key, score]) => {
        console.log(`    - ${key}: ${score}/10`);
      });
    });

    // 查看专家组共识
    console.log('\n=== 专家组共识 ===');
    console.log(`综合评分: ${panel.consensus.overallScore}/10`);
    console.log(`身份保持度: ${panel.consensus.identityPreservation}/10`);
    console.log(`年轻感: ${panel.consensus.youth}/10`);
    console.log(`美颜提升度: ${panel.consensus.beautyEnhancement}/10`);
    console.log(`魅力指数: ${panel.consensus.charm}/10`);
    console.log(`吸引力评分: ${panel.consensus.attractiveness}/10`);

    // 查看视觉验证结果
    console.log('\n=== 视觉验证 ===');
    console.log(`验证结果: ${panel.visualValidation.passed ? '✅ 通过' : '❌ 未通过'}`);
    if (panel.visualValidation.issues.length > 0) {
      console.log('发现问题:');
      panel.visualValidation.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }

    // 如果审核不通过，查看改进建议
    if (panel.finalDecision !== 'approved') {
      console.log('\n=== 改进建议 ===');
      console.log(panel.improvementPrompt);
    }
  }

  return result;
}

/**
 * 示例2: 仅使用专家组进行审核（已有生成图片）
 */
export async function exampleStandaloneReview() {
  const client = new GeminiClient(process.env.GEMINI_API_KEY || '');
  const imageAnalyzer = new ImageAnalyzer(client);

  // 创建专家组
  const expertPanel = new BeautyExpertPanel(client);

  // 原图和生成图（都是base64）
  const originalImage = '...'; // 原图
  const generatedImage = '...'; // 生成图

  // 分析原图获取特征描述
  const originalAnalysis = await imageAnalyzer.analyze({
    inlineData: { data: originalImage, mimeType: 'image/jpeg' }
  });

  // 专家组端到端审核
  const reviewResult = await expertPanel.conductEndToEndReview(
    originalImage,
    generatedImage,
    originalAnalysis
  );

  // 打印审核报告
  console.log(expertPanel.generateReviewReport(reviewResult));

  return reviewResult;
}

/**
 * 示例3: 结合专家组审核的迭代优化
 */
export async function exampleIterativeOptimization() {
  const client = new GeminiClient(process.env.GEMINI_API_KEY || '');
  const imageAnalyzer = new ImageAnalyzer(client);

  const expertPanel = new BeautyExpertPanel(client);

  const originalImage = '...';
  let currentPrompt = '初始prompt...';

  // 最多尝试3次
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`\n=== 优化迭代 ${attempt}/3 ===`);

    // 生成图片（实际调用Gemini API）
    // const generatedImage = await generateImage(currentPrompt);
    const generatedImage = '...';

    // 获取原图分析
    const originalAnalysis = await imageAnalyzer.analyze({
      inlineData: { data: originalImage, mimeType: 'image/jpeg' }
    });

    // 专家组审核
    const review = await expertPanel.conductEndToEndReview(
      originalImage,
      generatedImage,
      originalAnalysis
    );

    console.log(expertPanel.generateReviewReport(review));

    // 如果通过，结束迭代
    if (review.finalDecision === 'approved') {
      console.log('✅ 专家组审核通过！');
      break;
    }

    // 如果没通过，使用改进建议优化prompt
    if (attempt < 3) {
      console.log('🔄 根据专家组建议优化...');
      currentPrompt = `${currentPrompt}\n\n${review.improvementPrompt}`;
    } else {
      console.log('❌ 已达最大迭代次数，专家组仍未通过');
    }
  }

  return currentPrompt;
}

/**
 * 专家组评分权重配置示例
 */
export const EXPERT_WEIGHTS = {
  // 中国美颜修图师权重
  chineseRetoucher: {
    meituQuality: 0.25,      // 美图风格质量
    skinTexture: 0.20,       // 皮肤质感
    eyeEnhancement: 0.20,    // 眼睛美化
    faceContour: 0.20,       // 脸型轮廓
    complexion: 0.15         // 气色
  },

  // 日本化妆师权重
  japaneseMakeupArtist: {
    transparency: 0.30,      // 透明感
    naturalGlow: 0.25,       // 自然光泽
    eyeMakeup: 0.20,         // 眼妆
    lipGradient: 0.15,       // 唇妆渐变
    elegance: 0.10           // 优雅度
  },

  // 韩国整容师权重
  koreanSurgeon: {
    goldenRatio: 0.25,       // 黄金比例
    facialContour: 0.25,     // 面部轮廓
    eyeShape: 0.20,          // 眼型
    noseShape: 0.15,         // 鼻型
    harmony: 0.10,           // 和谐度
    identityPreservation: 0.05 // 身份保持
  }
};

/**
 * 通过标准配置
 */
export const APPROVAL_CRITERIA = {
  // 最低总分
  minOverallScore: 8.0,

  // 单项最低分
  minIndividualScore: 7.0,

  // 必须所有专家通过
  requireAllExpertsApprove: true,

  // 身份保持最低分
  minIdentityPreservation: 8.0,

  // 自然度最低分
  minNaturalness: 7.5,

  // 视觉验证必须通过
  requireVisualValidation: true
};

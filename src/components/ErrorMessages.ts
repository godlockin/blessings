export interface ErrorDisplayConfig {
  title: string;
  message: string;
  suggestion?: string;
  severity: 'info' | 'warning' | 'error';
}

export const ERROR_MESSAGES: Record<string, ErrorDisplayConfig> = {
  // 网络错误
  NETWORK_ERROR: {
    title: '网络连接异常',
    message: '无法连接到服务器，请检查您的网络连接。',
    suggestion: '请尝试刷新页面或稍后重试。',
    severity: 'error',
  },
  TIMEOUT_ERROR: {
    title: '请求超时',
    message: '服务器响应时间过长，可能是因为图片处理需要较长时间。',
    suggestion: '请耐心等待或稍后重试。如果问题持续，请尝试上传较小的图片。',
    severity: 'warning',
  },

  // 认证错误
  INVALID_INVITE_CODE: {
    title: '邀请码无效',
    message: '您输入的邀请码不正确，请重新输入。',
    suggestion: '请确认邀请码是否正确，或联系管理员获取正确的邀请码。',
    severity: 'error',
  },
  MISSING_INVITE_CODE: {
    title: '缺少邀请码',
    message: '请输入邀请码以继续使用。',
    suggestion: '',
    severity: 'error',
  },

  // 文件错误
  FILE_TOO_LARGE: {
    title: '文件过大',
    message: '上传的图片超过了大小限制。',
    suggestion: '请上传小于 10MB 的图片。',
    severity: 'error',
  },
  INVALID_FILE_TYPE: {
    title: '不支持的文件格式',
    message: '仅支持 JPG、PNG 和 WebP 格式的图片。',
    suggestion: '请转换图片格式后重新上传。',
    severity: 'error',
  },
  FILE_READ_ERROR: {
    title: '文件读取失败',
    message: '无法读取您上传的图片文件。',
    suggestion: '请尝试重新选择图片或使用其他图片。',
    severity: 'error',
  },

  // 图片审核错误
  AUDIT_FAILED: {
    title: '图片审核未通过',
    message: '上传的图片不符合要求。',
    suggestion: '请上传包含清晰人物且适合生成祝福照片的图片。',
    severity: 'warning',
  },
  AUDIT_NO_PERSON: {
    title: '未检测到人物',
    message: '图片中未识别到清晰的人物特征。',
    suggestion: '请上传包含人物的正面照片，确保面部清晰可见。',
    severity: 'warning',
  },

  // AI 处理错误
  AI_SERVICE_ERROR: {
    title: 'AI 服务异常',
    message: 'AI 图片生成服务暂时不可用。',
    suggestion: '请稍后重试，或联系管理员检查 API 配置。',
    severity: 'error',
  },
  AI_GENERATION_FAILED: {
    title: '图片生成失败',
    message: 'AI 未能成功生成祝福图片。',
    suggestion: '请尝试更换原图后重试。',
    severity: 'warning',
  },
  AI_REVIEW_FAILED: {
    title: '质量审核未通过',
    message: '生成的图片未能通过质量审核。',
    suggestion: '请尝试更换原图或调整上传图片的质量。',
    severity: 'warning',
  },

  // OSS 上传错误
  OSS_UPLOAD_FAILED: {
    title: '图片上传失败',
    message: '生成的图片未能成功保存到云端。',
    suggestion: '请尝试重新生成或稍后重试。图片仍可直接下载使用。',
    severity: 'warning',
  },

  // 通用错误
  UNKNOWN_ERROR: {
    title: '未知错误',
    message: '发生了意外的错误，请稍后重试。',
    suggestion: '如果问题持续，请联系技术支持并提供错误详情。',
    severity: 'error',
  },
  PROCESSING_CANCELLED: {
    title: '处理已取消',
    message: '图片处理已被取消。',
    suggestion: '您可以重新上传图片开始新的处理。',
    severity: 'info',
  },
};

export function getErrorConfig(error: Error | string): ErrorDisplayConfig {
  const errorMessage = error instanceof Error ? error.message : error;

  // 精确匹配
  if (ERROR_MESSAGES[errorMessage]) {
    return ERROR_MESSAGES[errorMessage];
  }

  // 模式匹配
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return ERROR_MESSAGES.TIMEOUT_ERROR;
  }
  if (errorMessage.includes('network') || errorMessage.includes('Network')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  if (errorMessage.includes('invite') || errorMessage.includes('Invite')) {
    return ERROR_MESSAGES.INVALID_INVITE_CODE;
  }
  if (errorMessage.includes('size') || errorMessage.includes('Size') || errorMessage.includes('large') || errorMessage.includes('Large')) {
    return ERROR_MESSAGES.FILE_TOO_LARGE;
  }
  if (errorMessage.includes('format') || errorMessage.includes('Format')) {
    return ERROR_MESSAGES.INVALID_FILE_TYPE;
  }
  if (errorMessage.includes('audit') || errorMessage.includes('Audit')) {
    return ERROR_MESSAGES.AUDIT_FAILED;
  }
  if (errorMessage.includes('AI') || errorMessage.includes('ai')) {
    return ERROR_MESSAGES.AI_SERVICE_ERROR;
  }
  if (errorMessage.includes('OSS') || errorMessage.includes('oss')) {
    return ERROR_MESSAGES.OSS_UPLOAD_FAILED;
  }
  if (errorMessage.includes('cancel') || errorMessage.includes('Cancel')) {
    return ERROR_MESSAGES.PROCESSING_CANCELLED;
  }

  // 默认返回未知错误，但附加原始消息
  return {
    ...ERROR_MESSAGES.UNKNOWN_ERROR,
    message: `${ERROR_MESSAGES.UNKNOWN_ERROR.message} (${errorMessage})`,
  };
}

export function formatErrorForUser(error: Error | string): string {
  const config = getErrorConfig(error);
  return `${config.title}\n${config.message}${config.suggestion ? `\n\n建议: ${config.suggestion}` : ''}`;
}

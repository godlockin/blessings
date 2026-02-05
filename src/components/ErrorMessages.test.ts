import { describe, it, expect } from 'vitest';
import { getErrorConfig, formatErrorForUser, ERROR_MESSAGES } from './ErrorMessages';

describe('ErrorMessages', () => {
  describe('getErrorConfig', () => {
    it('should return exact match for known errors', () => {
      const config = getErrorConfig('INVALID_INVITE_CODE');
      expect(config.title).toBe('邀请码无效');
      expect(config.severity).toBe('error');
    });

    it('should return default for unknown errors', () => {
      const config = getErrorConfig('UNKNOWN_ERROR_CODE');
      expect(config.title).toBe('未知错误');
      expect(config.severity).toBe('error');
    });

    it('should match timeout errors by content', () => {
      const config = getErrorConfig('Request timeout');
      expect(config.title).toBe('请求超时');
    });

    it('should match network errors by content', () => {
      const config = getErrorConfig('Network connection failed');
      expect(config.title).toBe('网络连接异常');
    });

    it('should match file size errors', () => {
      const config = getErrorConfig('File too large');
      expect(config.title).toBe('文件过大');
    });

    it('should match AI service errors', () => {
      const config = getErrorConfig('AI service unavailable');
      expect(config.title).toBe('AI 服务异常');
    });
  });

  describe('formatErrorForUser', () => {
    it('should format error with title and message', () => {
      const formatted = formatErrorForUser('INVALID_INVITE_CODE');
      expect(formatted).toContain('邀请码无效');
      expect(formatted).toContain('您输入的邀请码不正确');
    });

    it('should include suggestion when available', () => {
      const formatted = formatErrorForUser('TIMEOUT_ERROR');
      expect(formatted).toContain('建议');
    });
  });

  describe('ERROR_MESSAGES object', () => {
    it('should have all required error categories', () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR).toBeDefined();
      expect(ERROR_MESSAGES.INVALID_INVITE_CODE).toBeDefined();
      expect(ERROR_MESSAGES.FILE_TOO_LARGE).toBeDefined();
      expect(ERROR_MESSAGES.AI_SERVICE_ERROR).toBeDefined();
    });

    it('should have proper severity levels', () => {
      const severities = Object.values(ERROR_MESSAGES).map(e => e.severity);
      expect(severities).toContain('info');
      expect(severities).toContain('warning');
      expect(severities).toContain('error');
    });
  });
});

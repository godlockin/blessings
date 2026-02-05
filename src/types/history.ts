export interface HistoryItem {
  id: string;
  timestamp: number;
  originalImage: string;
  resultImage: string;
  blessingText: string;
  styleId: string;
  styleName: string;
  status: 'success' | 'failed';
  error?: string;
  fileName?: string;
  fileSize?: number;
}

export interface HistoryStats {
  total: number;
  totalSize: number;
  lastGenerated?: number;
}

export const MAX_HISTORY_ITEMS = 100;
export const MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB

export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return formatTimestamp(timestamp);
};

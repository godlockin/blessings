export interface BatchItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  progress: number;
}

export interface BatchState {
  items: BatchItem[];
  isProcessing: boolean;
  currentIndex: number;
  totalProgress: number;
  results: BatchResultSummary;
}

export interface BatchResultSummary {
  total: number;
  success: number;
  failed: number;
  totalSize: number;
}

export const createBatchItem = (file: File, preview: string): BatchItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  file,
  preview,
  status: 'pending',
  progress: 0,
});

export const calculateBatchProgress = (items: BatchItem[]): number => {
  if (items.length === 0) return 0;
  const total = items.reduce((acc, item) => acc + (item.status === 'completed' ? 100 : item.progress), 0);
  return Math.round(total / items.length);
};

export const getBatchResultSummary = (items: BatchItem[]): BatchResultSummary => ({
  total: items.length,
  success: items.filter(i => i.status === 'completed').length,
  failed: items.filter(i => i.status === 'failed').length,
  totalSize: items.reduce((acc, i) => acc + (i.file?.size || 0), 0),
});

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

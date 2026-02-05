import { useState, useEffect } from 'react';
import { X, FileArchive } from 'lucide-react';
import type { BatchItem, BatchResultSummary } from '@/types/batch';

interface BatchProgressProps {
  items: BatchItem[];
  currentIndex: number;
  isProcessing: boolean;
  results: BatchResultSummary;
  onCancel: () => void;
  onDownloadAll: () => void;
}

export function BatchProgress({
  items,
  currentIndex,
  isProcessing,
  results,
  onCancel,
  onDownloadAll,
}: BatchProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (items.length > 0) {
      const completed = items.filter(i => i.status === 'completed').length;
      const failed = items.filter(i => i.status === 'failed').length;
      const current = items.find(i => i.status === 'processing');
      const currentProgress = current?.progress || 0;
      const totalProgress = ((completed + failed) * 100 + currentProgress) / items.length;
      setProgress(Math.round(totalProgress));
    }
  }, [items]);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <div className="bg-white dark:bg-dark-bgSecondary rounded-xl p-6 border border-gray-200 dark:border-dark-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          批量处理中
        </h3>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              <X className="w-4 h-4" />
              取消
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">
            {results.success} 成功 / {results.failed} 失败 / {results.total} 总计
          </span>
          <span className="text-china-red font-medium">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-dark-bgTertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-china-red to-red-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentItem && isProcessing && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-bgTertiary rounded-lg">
          <img
            src={currentItem.preview}
            alt="Current"
            className="w-12 h-12 object-cover rounded"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {currentItem.file.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              正在处理...
            </div>
          </div>
          <div className="w-6 h-6 border-2 border-china-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {results.success > 0 && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={onDownloadAll}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-china-red text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
          >
            <FileArchive className="w-4 h-4" />
            下载全部 ZIP
          </button>
        </div>
      )}
    </div>
  );
}

export default BatchProgress;

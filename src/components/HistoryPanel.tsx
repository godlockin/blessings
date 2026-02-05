import { useState, useEffect, useCallback } from 'react';
import { Clock, Trash2, Download, RefreshCw, History, Search } from 'lucide-react';
import type { HistoryItem } from '@/types/history';
import { formatRelativeTime, formatTimestamp } from '@/types/history';
import { deleteHistoryItem, getAllHistory } from '@/lib/historyStorage';
import { downloadSingleImage } from '@/lib/batchDownload';
import { cn } from '@/lib/utils';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
}

export function HistoryPanel({ isOpen, onClose, onSelect }: HistoryPanelProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const history = await getAllHistory();
      setItems(history);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteHistoryItem(id);
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDownload = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const fileName = `blessing_${item.id.slice(0, 8)}.png`;
    downloadSingleImage(item.resultImage, fileName);
  };

  const handleSelect = (item: HistoryItem) => {
    setSelectedItem(item);
  };

  const filteredItems = items.filter(item =>
    item.blessingText.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.styleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-dark-bgSecondary shadow-2xl z-50 flex flex-col animate-slide-in">
        <div className="p-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <History className="w-5 h-5" />
              历史记录
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bgTertiary rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索祝福语..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg bg-gray-50 dark:bg-dark-bgTertiary text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-china-red border-t-transparent rounded-full" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{searchQuery ? '未找到匹配的记录' : '暂无历史记录'}</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={cn(
                  'p-4 border rounded-xl cursor-pointer transition-all hover:shadow-md',
                  'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bgTertiary',
                  selectedItem?.id === item.id && 'ring-2 ring-china-red border-transparent'
                )}
              >
                <div className="flex gap-4">
                  <img
                    src={item.resultImage}
                    alt="Result"
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        {item.styleName}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
                      {item.blessingText}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {item.status === 'success' ? (
                        <span className="text-xs text-green-600 dark:text-green-400">成功</span>
                      ) : (
                        <span className="text-xs text-red-600 dark:text-red-400">失败</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-dark-border">
                  <button
                    onClick={(e) => handleDownload(item, e)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-lg text-gray-500 dark:text-gray-400"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedItem && (
          <DetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onSelect={() => onSelect(selectedItem)}
            onDelete={async () => {
              await deleteHistoryItem(selectedItem.id);
              setItems(prev => prev.filter(i => i.id !== selectedItem.id));
              setSelectedItem(null);
            }}
          />
        )}
      </div>
    </>
  );
}

interface DetailModalProps {
  item: HistoryItem;
  onClose: () => void;
  onSelect: () => void;
  onDelete: () => void;
}

function DetailModal({ item, onClose, onSelect, onDelete }: DetailModalProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(item.blessingText);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-bgSecondary rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">生成详情</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bgTertiary rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">原图</div>
              <img src={item.originalImage} alt="Original" className="w-full rounded-lg border border-gray-200 dark:border-dark-border" />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">生成结果</div>
              <img src={item.resultImage} alt="Result" className="w-full rounded-lg border border-gray-200 dark:border-dark-border" />
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">祝福语</div>
            <div className="p-3 bg-gray-50 dark:bg-dark-bgTertiary rounded-lg text-sm">
              {item.blessingText}
            </div>
            <button
              onClick={handleCopy}
              className="mt-2 text-sm text-china-red hover:text-red-600"
            >
              复制祝福语
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            <div>风格: {item.styleName}</div>
            <div>生成时间: {formatTimestamp(item.timestamp)}</div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onSelect}
              className="flex-1 py-2 px-4 bg-china-red text-white rounded-lg font-medium hover:bg-red-600 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              使用此设置重新生成
            </button>
            <button
              onClick={onDelete}
              className="py-2 px-4 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;

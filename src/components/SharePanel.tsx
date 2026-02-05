import { useState } from 'react';
import { Share2, Link2, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { downloadSingleImage } from '@/lib/batchDownload';
import { cn } from '@/lib/utils';

interface SharePanelProps {
  resultImage: string;
  blessingText: string;
  onClose: () => void;
}

export function SharePanel({ resultImage, blessingText, onClose }: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/share/${Date.now()}`
    : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    downloadSingleImage(resultImage, `blessing_${Date.now()}.png`);
  };

  const handleShareWeibo = () => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(`${blessingText} ✨ 新年祝福生成器`);
    window.open(`https://service.weibo.com/share/share.php?url=${url}&title=${text}`, '_blank');
  };

  const WeiboIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.5 3.5h-15A1.5 1.5 0 003 5v15a1.5 1.5 0 001.5 1.5h15a1.5 1.5 0 001.5-1.5V5a1.5 1.5 0 00-1.5-1.5zm-5.5 15c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1zm-3-10.5c0-.5.5-1 1-1s1 .5 1 1-1 1-1 1-1-.5-1-1-1zm7 10.5c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1zm-3.5-9c0-.5.5-1 1-1s1 .5 1 1-1 1-1 1-1-.5-1-1-1z"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-bgSecondary rounded-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            分享祝福
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bgTertiary rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <img src={resultImage} alt="Result" className="w-full rounded-lg mb-4" />

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
          {blessingText}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={handleCopyLink}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors",
              copied
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
                : "border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bgTertiary"
            )}
          >
            <Link2 className="w-4 h-4" />
            {copied ? '已复制' : '复制链接'}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bgTertiary"
          >
            <Download className="w-4 h-4" />
            下载图片
          </button>

          <button
            onClick={() => setShowQR(!showQR)}
            className="flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bgTertiary"
          >
            <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
            </div>
            {showQR ? '隐藏' : '二维码'}
          </button>

          <button
            onClick={handleShareWeibo}
            className="flex items-center justify-center gap-2 py-3 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
          >
            <WeiboIcon className="w-4 h-4" />
            分享微博
          </button>
        </div>

        {showQR && (
          <div className="text-center p-4 bg-gray-50 dark:bg-dark-bgTertiary rounded-lg">
            <QRCodeSVG value={shareUrl} size={200} />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              扫码查看分享页
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          关闭
        </button>
      </div>
    </div>
  );
}

export default SharePanel;

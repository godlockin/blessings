import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, RefreshCw } from 'lucide-react';
import { downloadSingleImage } from '@/lib/batchDownload';

interface ShareData {
  resultImage: string;
  blessingText: string;
  timestamp: number;
}

export default function SharePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/share/${id}`);
        if (!response.ok) {
          throw new Error('分享链接已过期或不存在');
        }
        const shareData = await response.json();
        setData(shareData);
      } catch {
        setError('无法加载分享内容');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-china-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-md">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-xl font-bold mb-2">分享链接无效</h1>
          <p className="text-gray-500 mb-6">{error || '该分享可能已过期'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-china-red text-white rounded-lg font-medium hover:bg-red-600"
          >
            我也要生成
          </button>
        </div>
      </div>
    );
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100">
      <header className="bg-white/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            返回首页
          </button>
          <h1 className="font-bold">新年祝福分享</h1>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-china-red text-white rounded-lg text-sm hover:bg-red-600"
          >
            <RefreshCw className="w-4 h-4" />
            我也要生成
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-24 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="relative">
              <img src={data.resultImage} alt="Blessing" className="w-full" />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-lg font-medium">
                  {data.blessingText}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={() => downloadSingleImage(data.resultImage, 'blessing.png')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-china-red text-white rounded-lg font-medium hover:bg-red-600"
                >
                  <Download className="w-4 h-4" />
                  下载图片
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    alert('链接已复制');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  <Share2 className="w-4 h-4" />
                  复制链接
                </button>
              </div>

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-500 mb-3">分享到社交媒体</p>
                <div className="flex justify-center gap-4">
                  <a
                    href={`https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(data.blessingText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.5 3.5h-15A1.5 1.5 0 003 5v15a1.5 1.5 0 001.5 1.5h15a1.5 1.5 0 001.5-1.5V5a1.5 1.5 0 00-1.5-1.5zm-5.5 15c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1zm-3-10.5c0-.5.5-1 1-1s1 .5 1 1-1 1-1 1-1-.5-1-1-1zm7 10.5c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1zm-3.5-9c0-.5.5-1 1-1s1 .5 1 1-1 1-1 1-1-.5-1-1-1z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            生成于 {new Date(data.timestamp).toLocaleDateString()}
          </p>
        </div>
      </main>
    </div>
  );
}

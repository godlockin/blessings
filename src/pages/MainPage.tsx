import { useCallback, useRef, useMemo } from 'react';
import { Upload, Download, RefreshCw, LogOut, Image as ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '@/types';
import { compressImage, isValidImageFile } from '@/lib/imageCompression';
import { useImageProcessor } from '@/hooks/useImageProcessor';

const { MAX_FILE_SIZE } = APP_CONFIG;

export default function MainPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  
  // Use the new hook
  const {
    state,
    setFile,
    setFileError,
    startProcessing,
    cancelProcessing,
    resetState
  } = useImageProcessor();

  const { preview, result, isProcessing, steps, logs, errorMessage, fileError } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = useCallback(() => {
    cancelProcessing();
    logout();
    navigate('/');
  }, [logout, navigate, cancelProcessing]);

  const processFile = useCallback(async (fileToProcess: File) => {
    if (!isValidImageFile(fileToProcess)) {
      setFileError('不支持的文件格式，请使用 JPG、PNG 或 WebP');
      return;
    }

    if (fileToProcess.size > MAX_FILE_SIZE) {
      setFileError(`文件大小超过限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      return;
    }

    try {
      const compressed = await compressImage(fileToProcess, {
        maxSize: 1920,
        quality: 0.8,
      });

      setFile(fileToProcess, compressed.dataUrl);
    } catch (error) {
      console.error('File processing error:', error);
      setFileError('文件读取失败');
    }
  }, [setFile, setFileError]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        await processFile(selectedFile);
        // Reset input so the same file can be selected again if needed
        e.target.value = '';
    }
  }, [processFile]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Optimized: Use useMemo to avoid recalculation on every render
  const progress = useMemo(() => {
    if (steps.length === 0) return 0;
    const completedCount = steps.filter(s => s.status === 'completed').length;
    return (completedCount / steps.length) * 100;
  }, [steps]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <header className="bg-white dark:bg-dark-bgSecondary border-b border-gray-200 dark:border-dark-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-china-red rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              福
            </div>
            <span className="font-bold text-gray-900 dark:text-dark-text">新年祝福生成器</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 dark:text-dark-textMuted hover:text-china-red dark:hover:text-china-red flex items-center gap-2 text-sm transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Input & Controls */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-dark-bgSecondary p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-dark-text">
                <Upload className="w-5 h-5 text-china-red" />
                上传照片
              </h2>

              {!preview ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleUploadClick}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleUploadClick()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="group border-2 border-dashed border-gray-300 dark:border-dark-border rounded-xl h-80 flex flex-col items-center justify-center cursor-pointer hover:border-china-red hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-all focus:outline-none focus:ring-2 focus:ring-china-red focus:ring-offset-2"
                  aria-label="上传照片区域，点击或拖拽文件到此处"
                >
                  <div className="p-4 bg-gray-50 dark:bg-dark-bgTertiary rounded-full mb-4 group-hover:scale-110 transition-transform">
                     <Upload className="w-8 h-8 text-gray-400 dark:text-dark-textMuted group-hover:text-china-red" />
                  </div>
                  <span className="text-gray-600 dark:text-dark-text font-medium group-hover:text-china-red transition-colors">点击或拖拽上传照片</span>
                  <span className="text-gray-400 dark:text-dark-textMuted text-sm mt-2">支持 JPG, PNG, WebP</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden h-80 bg-gray-900 flex items-center justify-center group">
                  <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  {!isProcessing && (
                    <button
                      onClick={resetState}
                      className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label="重置图片"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6">
                 {preview && !isProcessing && !result && (
                    <button
                      onClick={startProcessing}
                      className="w-full py-3 bg-china-red text-white rounded-xl font-bold hover:bg-red-600 active:scale-[0.98] transition-all shadow-lg shadow-china-red/20"
                    >
                      开始生成祝福
                    </button>
                 )}

                 {isProcessing && (
                    <button
                        onClick={cancelProcessing}
                        className="w-full py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        取消处理
                    </button>
                 )}

                 {result && !isProcessing && (
                     <button
                       onClick={startProcessing}
                       className="w-full py-3 border-2 border-china-red text-china-red rounded-xl font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2"
                     >
                       <RefreshCw className="w-4 h-4" />
                       再来一张
                     </button>
                 )}
              </div>
            </div>

            {/* Progress Section */}
            {(isProcessing || result || errorMessage) && (
                <div className="bg-white dark:bg-dark-bgSecondary p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-semibold mb-4 dark:text-dark-text flex justify-between items-center">
                    <span>生成进度</span>
                    <span className="text-sm font-normal text-gray-500">{Math.round(progress)}%</span>
                </h3>

                <div className="w-full bg-gray-100 dark:bg-dark-bgTertiary rounded-full h-2 mb-6 overflow-hidden">
                    <div
                    className="bg-china-red h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="space-y-3">
                    {steps.map((step) => (
                    <div key={step.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                                ${step.status === 'completed' ? 'bg-green-100 text-green-600' : 
                                  step.status === 'processing' ? 'bg-red-100 text-china-red animate-pulse' :
                                  step.status === 'failed' ? 'bg-red-100 text-red-600' :
                                  'bg-gray-100 text-gray-400'}`}>
                                {step.status === 'completed' ? '✓' : step.status === 'failed' ? '!' : ''}
                            </div>
                            <span className={`font-medium transition-colors
                                ${step.status === 'completed' ? 'text-gray-900 dark:text-gray-100' : 
                                  step.status === 'processing' ? 'text-china-red' :
                                  'text-gray-500'}`}>
                                {step.label}
                            </span>
                        </div>
                        {step.status === 'processing' && <span className="text-xs text-china-red animate-pulse">处理中...</span>}
                    </div>
                    ))}
                </div>

                {errorMessage && (
                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-3">
                        <span className="text-lg">⚠️</span>
                        <div>
                            <p className="font-bold mb-1">生成失败</p>
                            <p>{errorMessage}</p>
                        </div>
                    </div>
                )}
                {fileError && (
                    <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-xl text-sm text-amber-600 dark:text-amber-400 flex items-start gap-3">
                        <span className="text-lg">⚠️</span>
                        <div className="flex-1">
                            <p className="font-bold mb-1">文件错误</p>
                            <p>{fileError}</p>
                        </div>
                        <button
                            onClick={() => setFileError(null)}
                            className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300"
                            aria-label="关闭错误"
                        >
                            ×
                        </button>
                    </div>
                )}
                </div>
            )}
          </div>

          {/* Right Column: Result & Logs */}
          <div className="space-y-6 h-full flex flex-col">
            <div className="bg-white dark:bg-dark-bgSecondary p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border flex-1 flex flex-col min-h-[500px]">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-dark-text">
                <ImageIcon className="w-5 h-5 text-china-gold" />
                生成结果
              </h2>

              <div className="flex-1 rounded-xl bg-gray-50 dark:bg-dark-bgTertiary border-2 border-dashed border-gray-200 dark:border-dark-border flex items-center justify-center overflow-hidden relative group">
                {result ? (
                  <>
                    <img src={result} alt="Generated Blessing" className="max-h-full max-w-full object-contain shadow-2xl" />
                    <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                      <a
                        href={result}
                        download={`new-year-blessing-${Date.now()}.png`}
                        className="flex items-center gap-2 px-8 py-3 bg-white text-china-red rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
                      >
                        <Download className="w-5 h-5" />
                        保存图片
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-400 dark:text-dark-textMuted p-8">
                    <div className="text-7xl mb-6 opacity-20">🧧</div>
                    <p className="font-medium text-lg">生成的新年祝福照片将显示在这里</p>
                    <p className="text-sm mt-2 opacity-60">AI 将为您定制独一无二的新年形象</p>
                  </div>
                )}
              </div>
            </div>

            {/* Developer Logs (Collapsible or always visible based on preference, keeping simpler for now) */}
            {logs.length > 0 && (
                <div className="bg-gray-900 text-gray-400 p-4 rounded-xl font-mono text-xs h-48 overflow-auto border border-gray-800 shadow-inner">
                <div className="sticky top-0 bg-gray-900 pb-2 mb-2 border-b border-gray-800 flex justify-between items-center">
                    <span className="font-bold text-gray-200">Processing Logs</span>
                    <span className="text-gray-600">{logs.length} entries</span>
                </div>
                {logs.map((l, i) => (
                    <div key={i} className="mb-1 break-all hover:text-gray-200 transition-colors">
                        <span className="text-gray-600 mr-2">{l.split(']')[0]}]</span>
                        <span>{l.split(']')[1]}</span>
                    </div>
                ))}
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

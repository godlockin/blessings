import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Upload, Download, RefreshCw, LogOut, Image as ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import type {
  ProcessingState,
  StepStatus,
  Step,
  ApiResponse
} from '@/types';
import {
  APP_CONFIG,
  STEP_CONFIG
} from '@/types';
import { compressImage, isValidImageFile } from '@/lib/imageCompression';

const { MAX_FILE_SIZE } = APP_CONFIG;

interface SSELineResult {
  eventType: string | null;
  data: string;
}

export default function MainPage() {
  const navigate = useNavigate();
  const { logout, inviteCode } = useAuthStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<ProcessingState>({
    file: null,
    preview: null,
    result: null,
    isProcessing: false,
    steps: STEP_CONFIG.map(s => ({ ...s })),
    logs: [],
    errorMessage: null,
  });

  const { file, preview, result, isProcessing, steps, logs, errorMessage } = state;

  const canProcess = useMemo(() =>
    file && preview && !isProcessing && !result && !errorMessage,
    [file, preview, isProcessing, result, errorMessage]
  );

  const log = useCallback((msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1];
    const logEntry = `${timestamp} ${msg}`;
    console.log(logEntry);
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, logEntry].slice(-100)
    }));
  }, []);

  const updateState = useCallback((updates: Partial<ProcessingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const updateStepStatus = useCallback((stepId: string, status: StepStatus) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status } : s)
    }));
  }, []);

  const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      log(`Retrying operation, ${retries} attempts left...`);
      await sleep(delay * (3 - retries + 1));
      return retryWithBackoff(fn, retries - 1, delay);
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleLogout = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    logout();
    navigate('/');
  }, [logout, navigate]);

  const handleReset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    updateState({
      file: null,
      preview: null,
      result: null,
      errorMessage: null,
      steps: STEP_CONFIG.map((s: Step) => ({ ...s, status: 'pending' })),
      logs: []
    });
  }, [updateState]);

  const processFile = useCallback(async (fileToProcess: File) => {
    if (!isValidImageFile(fileToProcess)) {
      updateState({
        errorMessage: '不支持的文件格式，请使用 JPG、PNG 或 WebP'
      });
      return;
    }

    if (fileToProcess.size > MAX_FILE_SIZE) {
      updateState({
        errorMessage: `文件大小超过限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)`
      });
      return;
    }

    try {
      log('开始压缩图片...');
      const compressed = await compressImage(fileToProcess, {
        maxSize: 1920,
        quality: 0.8,
      });

      log(`图片压缩完成: ${compressed.compressedSize} bytes (原始: ${compressed.originalSize} bytes)`);

      updateState({
        file: fileToProcess,
        preview: compressed.dataUrl,
        result: null,
        errorMessage: null,
        steps: STEP_CONFIG.map((s: Step) => ({ ...s, status: 'pending' })),
        logs: []
      });
      log('文件加载成功');
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件读取失败';
      updateState({ errorMessage: message });
      log(`文件处理错误: ${message}`);
    }
  }, [updateState, log]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
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

  const processImage = useCallback(async () => {
    if (!file || !preview || !inviteCode) {
      updateState({ errorMessage: '缺少必要参数' });
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    updateState({
      isProcessing: true,
      logs: [],
      errorMessage: null,
      steps: STEP_CONFIG.map((s: Step) => ({ ...s, status: 'pending' }))
    });

    log('开始安全的图片处理...');

    try {
      const base64Data = preview.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid image data format');
      }

      const makeRequest = async (): Promise<Response> => {
        const requestInit: RequestInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            image: base64Data,
            inviteCode: inviteCode.trim()
          })
        };
        if (abortControllerRef.current) {
          requestInit.signal = abortControllerRef.current.signal;
        }
        const response = await fetch('/api/process-image', requestInit);
        return response;
      };

      const response = await retryWithBackoff(makeRequest);
      log(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorData: ApiResponse = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream reader not available');
      }

      await processServerSentEvents(reader, log, updateStepStatus, updateState, abortControllerRef.current.signal);

      log('处理完成');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        log('处理已取消');
        updateState({ errorMessage: '处理已取消', isProcessing: false });
        return;
      }
      const message = error instanceof Error ? error.message : '处理过程中发生未知错误';
      log(`处理错误: ${message}`);
      updateState({ errorMessage: message });
      setState(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.status === 'processing' ? { ...s, status: 'failed' } : s
        )
      }));
    } finally {
      updateState({ isProcessing: false });
      abortControllerRef.current = null;
    }
  }, [file, preview, inviteCode, updateState, log, updateStepStatus, retryWithBackoff]);

  const processServerSentEvents = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    log: (msg: string) => void,
    updateStepStatus: (id: string, status: StepStatus) => void,
    updateState: (updates: Partial<ProcessingState>) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    const decoder = new TextDecoder();
    let buffer = '';
    const base64Parts: string[] = [];

    const parseSSELine = (line: string): SSELineResult => {
      if (line.startsWith('event: ')) {
        return { eventType: line.slice(7), data: '' };
      }
      if (line.startsWith('data: ')) {
        return { eventType: null, data: line.slice(6) };
      }
      return { eventType: null, data: '' };
    };

    let currentEvent = { type: null as string | null, data: '' };

    try {
      while (true) {
        if (signal?.aborted) {
          throw new Error('AbortError');
        }

        const { done, value } = await reader.read();
        if (done) {
          log('流处理完成');
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;

        const lines = buffer.split(/\r\n|\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (signal?.aborted) {
            throw new Error('AbortError');
          }

          const result = parseSSELine(line);

          if (result.eventType !== null) {
            currentEvent.type = result.eventType;
          }
          if (result.data) {
            currentEvent.data += result.data;
          }

          if (line.trim() === '' && currentEvent.type && currentEvent.data) {
            try {
              if (currentEvent.data.trim() === '[DONE]') {
                currentEvent = { type: null, data: '' };
                continue;
              }

              log(`处理事件: ${currentEvent.type}`);
              const parsedData = JSON.parse(currentEvent.data);

              switch (currentEvent.type) {
                case 'step':
                  updateStepStatus(parsedData.id, parsedData.status);
                  break;
                case 'image_chunk':
                  if (parsedData.chunk) {
                    base64Parts.push(parsedData.chunk);
                  }
                  break;
                case 'complete': {
                  const fullBase64 = base64Parts.join('').replace(/\s/g, '');
                  if (!fullBase64) {
                    throw new Error('Received empty image data');
                  }
                  const imageUrl = `data:image/png;base64,${fullBase64}`;
                  updateState({ result: imageUrl });
                  break;
                }
                case 'error':
                  throw new Error(parsedData.message || 'Unknown processing error');
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'SSE parsing error';
              log(`SSE Error: ${message}`);
              throw new Error(message);
            }

            currentEvent = { type: null, data: '' };
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'AbortError') {
        log('SSE 流已取消');
        throw error;
      }
      throw error;
    }
  };

  const getCompletedStepsCount = () => steps.filter(s => s.status === 'completed').length;
  const progress = steps.length > 0 ? (getCompletedStepsCount() / steps.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <header className="bg-white dark:bg-dark-bgSecondary border-b border-gray-200 dark:border-dark-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-china-red rounded-lg flex items-center justify-center text-white font-bold">
              福
            </div>
            <span className="font-bold text-gray-900 dark:text-dark-text">新年祝福生成器</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 dark:text-dark-textMuted hover:text-gray-700 dark:hover:text-dark-text flex items-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white dark:bg-dark-bgSecondary p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-dark-text">
                <Upload className="w-5 h-5 text-china-red" />
                上传照片
              </h2>

              {!preview ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-xl h-80 flex flex-col items-center justify-center cursor-pointer hover:border-china-red hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"
                >
                  <Upload className="w-12 h-12 text-gray-400 dark:text-dark-textMuted mb-4" />
                  <span className="text-gray-600 dark:text-dark-text font-medium">点击或拖拽上传照片</span>
                  <span className="text-gray-400 dark:text-dark-textMuted text-sm mt-2">支持 JPG, PNG, WebP</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden h-80 bg-gray-100 dark:bg-dark-bgTertiary flex items-center justify-center">
                  <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  {!isProcessing && (
                    <button
                      onClick={handleReset}
                      className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-dark-bg/80 hover:bg-white dark:hover:bg-dark-bgTertiary rounded-full shadow-lg backdrop-blur-sm transition-all"
                      aria-label="重置图片"
                    >
                      <RefreshCw className="w-5 h-5 text-gray-600 dark:text-dark-text" />
                    </button>
                  )}
                </div>
              )}

              {canProcess && (
                <button
                  onClick={processImage}
                  disabled={isProcessing}
                  className="w-full mt-6 py-3 bg-china-red text-white rounded-lg font-medium hover:bg-red-600 transition-colors shadow-lg shadow-china-red/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="开始生成图片"
                >
                  开始生成
                </button>
              )}

              {preview && !isProcessing && (result || errorMessage) && (
                <button
                  onClick={processImage}
                  disabled={isProcessing}
                  className="w-full mt-6 py-3 border-2 border-china-red text-china-red rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="重新生成图片"
                >
                  <RefreshCw className="w-4 h-4" />
                  重新生成
                </button>
              )}
            </div>

            <div className="bg-white dark:bg-dark-bgSecondary p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
              <h3 className="font-semibold mb-4 dark:text-dark-text">生成进度</h3>

              <div className="w-full bg-gray-200 dark:bg-dark-bgTertiary rounded-full h-2.5 mb-4">
                <div
                  className="bg-china-red h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between items-center w-full px-2">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex flex-col items-center gap-2 relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all duration-300
                      ${step.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700 scale-110' :
                        step.status === 'processing' ? 'bg-china-red text-white border-china-red scale-110 shadow-lg shadow-china-red/30' :
                          step.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700 scale-110' :
                            'bg-gray-50 dark:bg-dark-bgTertiary text-gray-400 dark:text-dark-textMuted border-gray-200 dark:border-dark-border'}
                    `}>
                      {step.status === 'completed' ? '✓' : step.status === 'failed' ? '!' : index + 1}
                    </div>
                    <span className={`text-xs whitespace-nowrap font-medium transition-colors duration-300 ${step.status === 'processing' ? 'text-china-red' :
                      step.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                        step.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-dark-textMuted'
                      }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {(steps.some(s => s.status === 'failed') || errorMessage) && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 animate-fade-in">
                  <div className="flex items-center font-bold mb-1">
                    <span className="mr-2">⚠️ 生成失败</span>
                  </div>
                  <div className="break-words">
                    {errorMessage || '处理过程中出现未知错误，请重试。'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-dark-bgSecondary p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-full min-h-[500px] flex flex-col">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-dark-text">
                <ImageIcon className="w-5 h-5 text-china-gold" />
                生成结果
              </h2>

              <div className="flex-1 rounded-xl bg-gray-50 dark:bg-dark-bgTertiary border-2 border-dashed border-gray-200 dark:border-dark-border flex items-center justify-center overflow-hidden relative">
                {result ? (
                  <>
                    <img src={result} alt="Generated" className="max-h-full max-w-full object-contain" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent flex justify-center">
                      <a
                        href={result}
                        download="new-year-blessing.png"
                        className="flex items-center gap-2 px-6 py-2 bg-white text-china-red rounded-full font-medium hover:bg-gray-50 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        下载照片
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-400 dark:text-dark-textMuted">
                    <div className="text-6xl mb-4">🧧</div>
                    <p>生成的新年祝福照片将显示在这里</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-900 dark:bg-dark-bgTertiary text-green-400 dark:text-green-500 p-4 rounded-xl font-mono text-xs overflow-auto h-48">
              {logs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

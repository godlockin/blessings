import { useState } from 'react';
import { Upload, Download, RefreshCw, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

// Types
type StepStatus = 'pending' | 'processing' | 'completed' | 'failed';
interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

export default function MainPage() {
  const { logout, inviteCode } = useAuthStore();
  const navigate = useNavigate();
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<Step[]>([
    { id: 'audit', label: '图片审核', status: 'pending' },
    { id: 'analysis', label: '照片分析', status: 'pending' },
    { id: 'prompt', label: 'Prompt生成', status: 'pending' },
    { id: 'generation', label: '图片生成', status: 'pending' },
    { id: 'review', label: '结果审核', status: 'pending' },
  ]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      // Reset state
      setResult(null);
      setSteps(steps.map(s => ({ ...s, status: 'pending' })));
    }
  };

  const processImage = async () => {
    if (!file || !preview) return;
    
    setIsProcessing(true);
    // Reset steps
    setSteps(steps.map(s => ({ ...s, status: 'pending' })));

    try {
      const response = await fetch('/api/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: preview.split(',')[1], // Remove data:image/xxx;base64, prefix
          inviteCode 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // Keep the last partial line in buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const parts = line.split('\n');
            const eventType = parts[0].replace('event: ', '');
            const dataStr = parts[1]?.replace('data: ', '');
            
            if (!dataStr) continue;
            
            try {
              if (dataStr.trim() === "[DONE]") continue;
              
              const data = JSON.parse(dataStr);
              
              if (eventType === 'step') {
                setSteps(prev => prev.map(s => 
                  s.id === data.id ? { ...s, status: data.status } : s
                ));
              } else if (eventType === 'complete') {
                setResult(`data:image/png;base64,${data.result}`);
                setSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
              } else if (eventType === 'error') {
                throw new Error(data.message);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || '处理出错');
      setSteps(prev => prev.map(s => s.status === 'processing' ? { ...s, status: 'failed' } : s));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-china-red rounded-lg flex items-center justify-center text-white font-bold">
              福
            </div>
            <span className="font-bold text-gray-900">新年祝福生成器</span>
          </div>
          <button 
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Upload & Preview */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-china-red" />
                上传照片
              </h2>
              
              {!preview ? (
                <label className="border-2 border-dashed border-gray-300 rounded-xl h-80 flex flex-col items-center justify-center cursor-pointer hover:border-china-red hover:bg-red-50/50 transition-colors">
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <span className="text-gray-600 font-medium">点击或拖拽上传照片</span>
                  <span className="text-gray-400 text-sm mt-2">支持 JPG, PNG</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              ) : (
                <div className="relative rounded-xl overflow-hidden h-80 bg-gray-100 flex items-center justify-center">
                  <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  {!isProcessing && (
                    <button 
                      onClick={() => { setPreview(null); setFile(null); setResult(null); }}
                      className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg backdrop-blur-sm transition-all"
                    >
                      <RefreshCw className="w-5 h-5 text-gray-600" />
                    </button>
                  )}
                </div>
              )}

              {preview && !isProcessing && !result && (
                <button
                  onClick={processImage}
                  className="w-full mt-6 py-3 bg-china-red text-white rounded-lg font-medium hover:bg-red-600 transition-colors shadow-lg shadow-china-red/20"
                >
                  开始生成
                </button>
              )}
            </div>

            {/* Steps Progress */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-4">生成进度</h3>
              <div className="flex justify-between items-center w-full px-2">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex flex-col items-center gap-2 relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all duration-300
                      ${step.status === 'completed' ? 'bg-green-100 text-green-600 border-green-200 scale-110' : 
                        step.status === 'processing' ? 'bg-china-red text-white border-china-red scale-110 shadow-lg shadow-china-red/30' :
                        'bg-gray-50 text-gray-400 border-gray-200'}
                    `}>
                      {step.status === 'completed' ? '✓' : index + 1}
                    </div>
                    <span className={`text-xs whitespace-nowrap font-medium transition-colors duration-300 ${
                      step.status === 'processing' ? 'text-china-red' :
                      step.status === 'completed' ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                    
                    {/* Progress Bar Line */}
                    {index < steps.length - 1 && (
                      <div className="absolute top-4 left-[50%] w-[calc(100vw/5)] lg:w-[calc(100%/1*5)] h-[2px] -z-10 bg-gray-100" 
                           style={{ width: 'calc(100% + 2rem)', transform: 'translateX(50%)' }}>
                        <div className={`h-full transition-all duration-500 ease-out ${
                          step.status === 'completed' ? 'bg-green-200' : 'bg-transparent'
                        }`} style={{ width: '100%' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Result */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full min-h-[500px] flex flex-col">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="w-5 h-5 text-china-gold">✨</div>
                生成结果
              </h2>

              <div className="flex-1 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative">
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
                  <div className="text-center text-gray-400">
                    <div className="text-6xl mb-4">🧧</div>
                    <p>生成的新年祝福照片将显示在这里</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

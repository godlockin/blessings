import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Lock } from 'lucide-react';
import clsx from 'clsx';

export default function InvitePage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setInviteCode, setAuthenticated } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // TODO: Call actual API
      const response = await fetch('/api/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
      });
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error('Server response was not valid JSON');
      }

      if (data.valid) {
        setInviteCode(code);
        setAuthenticated(true);
        navigate('/app');
      } else {
        setError(data.message || '无效的邀请码');
      }
    } catch (err) {
      console.error('Verify Error:', err);
      setError((err as Error).message || '验证失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-2 border-china-red/20">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-china-red/10 rounded-full">
            <Lock className="w-8 h-8 text-china-red" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          新年祝福生成器
        </h1>
        <p className="text-center text-gray-500 mb-8">
          请输入邀请码以继续
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="请输入邀请码"
              className={clsx(
                "w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-colors",
                error 
                  ? "border-red-500 focus:ring-red-200" 
                  : "border-gray-200 focus:border-china-red focus:ring-china-red/20"
              )}
            />
            {error && (
              <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !code}
            className={clsx(
              "w-full py-3 rounded-lg font-medium text-white transition-all",
              "bg-gradient-to-r from-china-red to-red-600 hover:shadow-lg hover:shadow-china-red/30",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {loading ? '验证中...' : '开始生成'}
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Droplets, Eye, EyeOff } from 'lucide-react';
import api, { USE_API } from '@/services/api';
import { MOCK_ADMIN, type AdminUser } from '@/services/mockData';

interface LoginPageProps {
  onLogin: (user: AdminUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('admin@roboss.co.th');
  const [password, setPassword] = useState('admin1234');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (USE_API) {
      try {
        const user = await api.login(email, password);
        onLogin(user);
      } catch (err: any) {
        setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
        setLoading(false);
      }
    } else {
      setTimeout(() => {
        setLoading(false);
        onLogin(MOCK_ADMIN);
      }, 1200);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-500/3 blur-[100px] pointer-events-none" />
      
      <div className="relative w-full max-w-md mx-4">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">ROBOSS</h1>
          <p className="text-gray-500 text-sm mt-1">Franchise Management System</p>
        </div>

        {/* Login Card */}
        <div className="gradient-card rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">เข้าสู่ระบบ</h2>
          <p className="text-gray-500 text-sm mb-6">กรุณาใส่อีเมลและรหัสผ่านของคุณ</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all text-sm"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all text-sm"
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-600 bg-gray-800" defaultChecked />
                จดจำฉัน
              </label>
              <button type="button" className="text-red-400 hover:text-red-300 text-xs">ลืมรหัสผ่าน?</button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold text-sm hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/20 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-800/50 text-center">
            <p className="text-[11px] text-gray-600">
              Demo: admin@roboss.co.th / admin1234
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { authService, DEMO_CREDENTIALS, INITIAL_OWNER_EMAIL } from '../services/authService';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

const CURRENT_YEAR = 2026;

export default function AdminLoginPage({ onLoginSuccess, onBackToPublic }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFillDemo = () => {
    setUsername(INITIAL_OWNER_EMAIL);
    setPassword(DEMO_CREDENTIALS.password);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Email atau username wajib diisi.');
      return;
    }
    if (!password) {
      setError('Kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.login(username, password);
      setIsLoading(false);

      if (result.success) {
        onLoginSuccess(result.user);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Terjadi kesalahan saat masuk.');
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      {/* Top back button */}
      <div className="max-w-md w-full mx-auto">
        <button
          onClick={onBackToPublic}
          className="inline-flex items-center gap-2 text-xs font-semibold text-content-secondary hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Halaman Publik
        </button>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto bg-white rounded-2xl border border-divider shadow-card p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto shadow-subtle mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-content-primary">Login Administrator Kelas</h2>
          <p className="text-xs text-content-secondary mt-1">
            Masuk untuk mengelola susunan denah, data 26 siswa, dan eksekusi pengacakan tempat duduk.
          </p>
        </div>

        {/* Demo Credentials Box */}
        <div className="mb-6 p-3.5 bg-brand-50 border border-brand-100 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between text-brand-900 font-semibold">
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-brand-600" />
              Kredensial Demo (Initial Owner)
            </span>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-[11px] font-bold text-brand-700 bg-white hover:bg-brand-100 px-2 py-0.5 rounded border border-brand-200 transition-colors"
            >
              Isi Otomatis
            </button>
          </div>
          <div className="text-[11px] text-brand-800 space-y-0.5 font-mono">
            <div>Email Owner: <strong>{INITIAL_OWNER_EMAIL}</strong></div>
            <div>Password: <strong>{DEMO_CREDENTIALS.password}</strong></div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-content-primary block mb-1">
              Email atau Username Admin
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="fairuzziachmad@gmail.com atau admin"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-divider bg-canvas text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-content-primary block mb-1">
              Kata Sandi (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-divider bg-canvas text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-content-primary p-1"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-subtle transition-all transform active:scale-95 disabled:opacity-50 mt-2"
          >
            {isLoading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
          </button>
        </form>

        {/* Security & Backend integration note */}
        <div className="mt-6 pt-5 border-t border-divider text-center">
          <p className="text-[11px] text-content-secondary leading-relaxed">
            Terhubung dengan Supabase Auth & Role-Based Access Control (OWNER / ADMIN). Akun Owner pertama: <span className="font-semibold text-content-primary">fairuzziachmad@gmail.com</span>.
          </p>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-content-secondary mt-6">
        © {CURRENT_YEAR} SeatFlow Classroom Management.
      </div>
    </div>
  );
}

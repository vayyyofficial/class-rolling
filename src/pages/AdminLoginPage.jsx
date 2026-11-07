import React, { useState } from 'react';
import { authService } from '../services/authService';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  Clock,
} from 'lucide-react';

const CURRENT_YEAR = 2026;

export default function AdminLoginPage({ onLoginSuccess, onBackToPublic }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Kata sandi administrator wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.login(password);
      setIsLoading(false);

      if (result.success) {
        onLoginSuccess(result.user);
      } else {
        setError(result.message || 'Kata sandi tidak valid.');
        if (result.locked) {
          setIsLocked(true);
          setRemainingSeconds(result.remainingSeconds || 900);
        }
        if (result.remainingAttempts !== undefined) {
          setRemainingAttempts(result.remainingAttempts);
        }
      }
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Terjadi kesalahan sistem saat memproses login.');
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
          <h2 className="text-xl font-bold text-content-primary">Login Administrator</h2>
          <p className="text-xs text-content-secondary mt-1">
            Masukkan kata sandi pengurus kelas untuk mengakses pengelolaan denah dan data siswa Class Rolling.
          </p>
        </div>

        {/* Lockout Banner */}
        {isLocked && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Akses Terkunci Sementara</strong>
              <span>
                Terlalu banyak percobaan gagal berturut-turut. Demi keamanan kelas, sistem mengunci akses selama{' '}
                {Math.ceil(remainingSeconds / 60)} menit.
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && !isLocked && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {remainingAttempts !== null && remainingAttempts < 5 && (
                <div className="mt-1 font-semibold text-rose-700">
                  Percobaan tersisa sebelum akun dikunci: {remainingAttempts}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form - Password ONLY */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-content-primary block mb-1">
              Kata Sandi Administrator
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi admin"
                autoComplete="current-password"
                disabled={isLoading || isLocked}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-divider bg-canvas text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:opacity-50"
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
            disabled={isLoading || isLocked || !password}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-subtle transition-all transform active:scale-95 disabled:opacity-50 mt-2"
          >
            {isLoading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-5 border-t border-divider text-center">
          <p className="text-[11px] text-content-secondary leading-relaxed">
            Dilindungi enkripsi Bcrypt tingkat server & perlindungan otomatis terhadap serangan brute-force.
          </p>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="text-center text-xs text-content-secondary mt-6">
        © {CURRENT_YEAR} Class Rolling. Hak cipta dilindungi.
      </div>
    </div>
  );
}

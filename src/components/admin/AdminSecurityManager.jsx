import React, { useState } from 'react';
import { authService } from '../../services/authService';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  RefreshCw,
} from 'lucide-react';

export default function AdminSecurityManager({ showNotification }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!currentPassword) {
      setError('Kata sandi saat ini wajib diisi.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError('Kata sandi baru minimal harus 8 karakter.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('Kata sandi baru tidak boleh sama dengan kata sandi saat ini.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      setIsLoading(false);

      if (result.success) {
        setSuccessMessage(result.message || 'Kata sandi berhasil diperbarui.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (showNotification) {
          showNotification('Kata sandi administrator berhasil diperbarui!', 'success');
        }
      } else {
        setError(result.message || 'Gagal mengubah kata sandi.');
      }
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Terjadi kesalahan sistem.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-white rounded-2xl border border-divider shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0 border border-brand-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-content-primary">
              Keamanan Akun &amp; Kata Sandi Administrator
            </h3>
            <p className="text-xs text-content-secondary mt-1 max-w-xl leading-relaxed">
              Sistem otentikasi RuangKelas menggunakan verifikasi berbasis server dengan enkripsi kuat Bcrypt (cost 12), perlindungan serangan brute-force, dan token sesi kriptografis.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Ganti Kata Sandi */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-divider shadow-subtle p-6 space-y-5">
          <div className="pb-4 border-b border-divider">
            <h4 className="text-sm font-bold text-content-primary flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-600" />
              Ganti Kata Sandi Administrator
            </h4>
            <p className="text-xs text-content-secondary mt-1">
              Untuk memperbarui kata sandi, Anda wajib memverifikasi kata sandi saat ini terlebih dahulu.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
            {/* Current Password */}
            <div>
              <label className="text-xs font-semibold text-content-primary block mb-1">
                Kata Sandi Saat Ini <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan kata sandi lama"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-divider bg-canvas text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-content-primary p-1"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="text-xs font-semibold text-content-primary block mb-1">
                Kata Sandi Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-divider bg-canvas text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-content-primary p-1"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-content-secondary mt-1">
                Gunakan kombinasi huruf, angka, atau simbol agar tidak mudah ditebak.
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-xs font-semibold text-content-primary block mb-1">
                Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-divider bg-canvas text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-subtle transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isLoading ? 'Menyimpan Perubahan...' : 'Simpan Kata Sandi Baru'}
            </button>
          </form>
        </div>

        {/* Security Parameters & Recovery Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-divider shadow-subtle p-5 space-y-4">
            <h4 className="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-brand-600" />
              Parameter Keamanan Server
            </h4>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-canvas border border-divider space-y-1">
                <span className="font-semibold text-content-primary block">Algoritma Hash</span>
                <span className="text-content-secondary text-[11px]">
                  Bcrypt (pgcrypto Blowfish, salt cost 12). Kata sandi asli tidak pernah tersimpan di database.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-divider space-y-1">
                <span className="font-semibold text-content-primary block">Proteksi Brute-Force</span>
                <span className="text-content-secondary text-[11px]">
                  Maksimal 5 kali kegagalan berturut-turut sebelum akun dikunci otomatis selama 15 menit.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-divider space-y-1">
                <span className="font-semibold text-content-primary block">Sesi Kriptografis</span>
                <span className="text-content-secondary text-[11px]">
                  Token 256-bit SHA-256 acak dengan waktu kedaluwarsa 24 jam.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-brand-50/60 rounded-2xl border border-brand-100 p-5 space-y-2 text-xs">
            <span className="font-bold text-brand-900 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-brand-600" />
              Prosedur Pemulihan (Recovery)
            </span>
            <p className="text-brand-800 leading-relaxed text-[11px]">
              Jika administrator lupa kata sandi, pemulihan dilakukan secara aman melalui akses server internal (Supabase SQL Editor) dengan perintah:
            </p>
            <code className="block p-2 bg-white rounded-lg border border-brand-200 text-brand-900 font-mono text-[10px] break-all">
              SELECT public.server_provision_admin_password('PasswordBaru');
            </code>
            <p className="text-[10px] text-brand-700">
              Tidak ada jalur reset publik tanpa otorisasi server langsung.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Calendar, Clock, ShieldCheck, Settings } from 'lucide-react';

const CURRENT_YEAR = 2026;

export default function Footer({ onOpenAdminLogin }) {
  return (
    <footer className="bg-white border-t border-divider mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-divider">
          {/* Brand & About */}
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
                SF
              </div>
              <span className="font-bold text-base text-content-primary">SeatFlow</span>
            </div>
            <p className="text-xs text-content-secondary leading-relaxed">
              Utilitas denah tempat duduk kelas berkapasitas 26 siswa dengan sistem rotasi otomatis mingguan & pembagi kelompok acak.
            </p>
          </div>

          {/* Schedule Info */}
          <div>
            <h4 className="text-xs font-bold text-content-primary mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              Rotasi Otomatis Mingguan
            </h4>
            <div className="p-3 rounded-xl bg-canvas border border-divider space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">Jadwal:</span>
                <span className="font-semibold text-content-primary">Setiap Hari Minggu</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">Waktu:</span>
                <span className="font-semibold text-brand-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 06:00 WIB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">Zona:</span>
                <span className="text-content-primary">Asia/Jakarta (UTC+7)</span>
              </div>
            </div>
          </div>

          {/* Discreet Access */}
          <div>
            <h4 className="text-xs font-bold text-content-primary mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              Akses Terbuka
            </h4>
            <p className="text-xs text-content-secondary leading-relaxed mb-3">
              Denah tempat duduk & pembagi kelompok dapat diakses langsung oleh seluruh siswa tanpa perlu mendaftar atau login akun.
            </p>
            <button
              onClick={onOpenAdminLogin}
              className="inline-flex items-center gap-1.5 text-[11px] text-content-secondary hover:text-brand-600 transition-colors"
              title="Akses Pengurus Kelas"
            >
              <Settings className="w-3 h-3" />
              <span>Akses Pengurus Kelas</span>
            </button>
          </div>
        </div>

        {/* Bottom credits */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-content-secondary">
          <p>© {CURRENT_YEAR} SeatFlow. Didesain untuk kelas 26 siswa.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Aktif (WIB)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

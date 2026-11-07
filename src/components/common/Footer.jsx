import React from 'react';
import { Settings } from 'lucide-react';

const CURRENT_YEAR = 2026;

export default function Footer({ onOpenAdminLogin }) {
  return (
    <footer className="bg-white border-t border-divider mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-content-secondary">
          {/* Brand & Purpose */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-[10px]">
              RK
            </div>
            <span className="font-bold text-sm text-content-primary">RuangKelas</span>
            <span className="text-gray-300">|</span>
            <span className="text-[11px] text-content-secondary">
              Denah Tempat Duduk &amp; Pembagi Kelompok 26 Siswa
            </span>
          </div>

          {/* Copyright & Discreet Admin Access */}
          <div className="flex items-center gap-4 text-[11px]">
            <span>&copy; {CURRENT_YEAR} RuangKelas. Hak cipta dilindungi.</span>
            {onOpenAdminLogin && (
              <button
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-1 text-content-secondary hover:text-brand-600 transition-colors p-1"
                title="Akses Pengurus Kelas"
                aria-label="Akses Pengurus Kelas"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

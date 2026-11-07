import React from 'react';
import {
  Armchair,
  Users2,
  Settings,
  Shield,
} from 'lucide-react';

export default function Navbar({
  activeTab,
  onNavigate,
  isAuthenticated,
  onOpenLogin,
  onOpenDashboard,
}) {
  const navItems = [
    { id: 'denah', label: 'Denah Tempat Duduk', icon: Armchair },
    { id: 'kelompok', label: 'Group Randomizer', icon: Users2 },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-divider transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onNavigate('denah')}
          >
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-subtle group-hover:bg-brand-700 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 18v3" />
                <path d="M20 18v3" />
                <path d="M6 14h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Z" />
                <path d="M4 14h16" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-content-primary">RuangKelas</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                  26 Siswa
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation - 2 Main Tools */}
          <nav className="hidden sm:flex items-center gap-1.5 bg-canvas p-1 rounded-xl border border-divider">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-content-primary shadow-xs font-bold'
                      : 'text-content-secondary hover:text-content-primary hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-600' : 'text-content-secondary'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action: Subtle Discreet Admin Access Icon */}
          <div className="hidden sm:flex items-center gap-2">
            {isAuthenticated ? (
              <button
                onClick={onOpenDashboard}
                title="Buka Dashboard Pengurus Kelas"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold border border-brand-200 transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-brand-600" />
                <span>Panel Pengurus</span>
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                title="Akses Pengurus Kelas"
                aria-label="Akses Pengurus Kelas"
                className="p-2 rounded-lg text-content-secondary hover:text-brand-600 hover:bg-canvas transition-colors border border-transparent hover:border-divider"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile navigation */}
          <div className="flex items-center gap-1 sm:hidden">
            <button
              onClick={() => onNavigate(activeTab === 'denah' ? 'kelompok' : 'denah')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-canvas text-content-primary border border-divider"
            >
              {activeTab === 'denah' ? 'Group Randomizer' : 'Denah Kelas'}
            </button>
            <button
              onClick={() => (isAuthenticated ? onOpenDashboard() : onOpenLogin())}
              className="p-2 text-content-secondary hover:text-brand-600"
              title="Akses Pengurus"
              aria-label="Akses Pengurus"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

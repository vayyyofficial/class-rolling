import React from 'react';
import {
  LayoutDashboard,
  Grid,
  Users,
  Dices,
  History,
  Clock,
  LogOut,
  ExternalLink,
  ChevronRight,
  Shield,
} from 'lucide-react';

export default function AdminSidebar({
  activeTab,
  onSelectTab,
  onLogout,
  onGoToPublic,
  currentUser,
}) {
  const menuItems = [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'layout', label: 'Kelola Tata Letak', icon: Grid },
    { id: 'students', label: 'Kelola Siswa', icon: Users },
    { id: 'seating', label: 'Denah & Acak Ulang', icon: Dices },
    { id: 'history', label: 'Riwayat Aktivitas', icon: History },
    { id: 'schedule', label: 'Pengaturan Jadwal', icon: Clock },
  ];

  return (
    <aside className="w-64 bg-white border-r border-divider flex flex-col justify-between h-screen sticky top-0 z-30">
      {/* Brand & Admin Badge */}
      <div>
        <div className="p-6 border-b border-divider">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-subtle">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-content-primary">SeatFlow</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">
                  Panel Admin
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                    : 'text-content-secondary hover:text-content-primary hover:bg-gray-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-content-secondary'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-brand-600" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-divider space-y-2 bg-canvas/40">
        <button
          onClick={onGoToPublic}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium text-content-secondary hover:text-content-primary hover:bg-white border border-transparent hover:border-divider transition-all"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-brand-600" />
            Lihat Tampilan Publik
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        </button>

        <div className="pt-2 border-t border-divider flex items-center justify-between px-1">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-content-primary truncate">
                {currentUser?.name || 'Administrator'}
              </p>
              {currentUser?.role === 'OWNER' && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                  OWNER
                </span>
              )}
            </div>
            <p className="text-[10px] text-content-secondary truncate">
              {currentUser?.email || 'admin@seatflow.internal'}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Keluar dari Admin"
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}


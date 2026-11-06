import React, { useState, useEffect } from 'react';
import { Clock, Menu, Globe, LogOut } from 'lucide-react';
import { formatWIBTime, formatWIBShort } from '../../utils/timezone';

export default function AdminHeader({
  title,
  subtitle,
  onToggleMobileNav,
  onGoToPublic,
  onLogout,
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-divider px-4 sm:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onToggleMobileNav && (
          <button
            onClick={onToggleMobileNav}
            className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-gray-100 lg:hidden"
            aria-label="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-content-primary">{title}</h1>
          {subtitle && <p className="text-xs text-content-secondary hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Live WIB Clock */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-canvas border border-divider text-xs text-content-secondary font-mono">
          <Clock className="w-3.5 h-3.5 text-brand-600" />
          <span>{formatWIBShort(now)}</span>
          <span className="font-semibold text-content-primary">{formatWIBTime(now)}</span>
        </div>

        {/* Public view shortcut */}
        <button
          onClick={onGoToPublic}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-divider hover:bg-canvas text-xs font-semibold text-content-primary transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-brand-600" />
          Web Publik
        </button>

        {/* Logout shortcut */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}

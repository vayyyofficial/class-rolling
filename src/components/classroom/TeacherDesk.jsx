import React from 'react';
import { Presentation, Armchair } from 'lucide-react';

export default function TeacherDesk({ position = 'center', label = 'Meja Guru' }) {
  const positionClasses = {
    left: 'justify-start md:pl-12',
    center: 'justify-center',
    right: 'justify-end md:pr-12',
  };

  return (
    <div className="w-full mb-8">
      {/* Blackboard / Whiteboard indicator */}
      <div className="w-full flex items-center justify-center mb-5">
        <div className="w-full max-w-xl py-2 px-6 bg-gray-800 text-white rounded-lg shadow-sm border border-gray-700 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold tracking-wider uppercase">
          <Presentation className="w-4 h-4 text-brand-400" />
          <span>Papan Tulis & Depan Ruang Kelas</span>
        </div>
      </div>

      {/* Teacher Desk */}
      <div className={`flex w-full ${positionClasses[position] || positionClasses.center}`}>
        <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-xl border-2 border-brand-200 shadow-subtle text-content-primary">
          <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
            <Armchair className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand-700">{label}</div>
            <div className="text-[11px] text-content-secondary">Area Pengajar / Wali Kelas</div>
          </div>
        </div>
      </div>
    </div>
  );
}


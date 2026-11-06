import React from 'react';
import { User, Ban, Sparkles } from 'lucide-react';

export default function SeatCard({
  seat,
  student,
  isSelected = false,
  isHighlighted = false,
  isShuffling = false,
  shuffleName = '',
  onClick,
  showCode = true,
  editable = false,
  onToggleAvailable,
}) {
  const isAvailable = seat.isAvailable !== false;
  const isAssigned = Boolean(student && isAvailable);

  // During reroll animation
  if (isShuffling && isAvailable) {
    return (
      <div className="relative flex flex-col justify-between p-3 h-24 bg-brand-50 border-2 border-brand-400 rounded-xl shadow-sm animate-pulse transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-brand-200 text-brand-800">
            {seat.code || seat.id}
          </span>
          <Sparkles className="w-3.5 h-3.5 text-brand-500 animate-spin" />
        </div>
        <div className="flex flex-col items-center justify-center my-auto">
          <span className="text-xs font-bold text-brand-700 truncate max-w-[110px] animate-bounce">
            {shuffleName || 'Mengacak...'}
          </span>
        </div>
        <div className="w-full bg-brand-200 h-1 rounded-full overflow-hidden">
          <div className="bg-brand-600 h-full w-2/3 animate-ping" />
        </div>
      </div>
    );
  }

  // Unavailable / Disabled Seat
  if (!isAvailable) {
    return (
      <div
        onClick={() => editable && onToggleAvailable ? onToggleAvailable(seat) : (onClick ? onClick(seat, null) : null)}
        className={`relative flex flex-col justify-between p-3 h-24 rounded-xl border border-dashed border-gray-300 bg-gray-50/80 text-gray-400 select-none transition-all ${
          editable ? 'cursor-pointer hover:bg-gray-100 hover:border-gray-400' : 'cursor-default'
        } ${isSelected ? 'ring-2 ring-brand-500' : ''}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
            {seat.code || seat.id}
          </span>
          <Ban className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <div className="flex flex-col items-center justify-center text-center my-auto">
          <span className="text-xs font-medium text-gray-400">Nonaktif</span>
          {editable && <span className="text-[10px] text-gray-400 mt-0.5">Klik tukar aktif</span>}
        </div>
        <div className="text-[10px] text-center text-gray-400">Tidak Digunakan</div>
      </div>
    );
  }

  // Empty / Unassigned Seat (e.g. 2 empty positions at the back of right block)
  if (!isAssigned) {
    return (
      <div
        onClick={() => onClick ? onClick(seat, null) : null}
        className={`group relative flex flex-col justify-between p-3 h-24 rounded-xl border border-dashed border-gray-300 bg-white hover:border-brand-300 hover:bg-brand-50/30 transition-all cursor-pointer ${
          isSelected ? 'ring-2 ring-brand-500 border-brand-500' : ''
        } ${isHighlighted ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 group-hover:bg-brand-100 group-hover:text-brand-700 transition-colors">
            {seat.code || seat.id}
          </span>
          <span className="text-[10px] font-semibold text-gray-400 group-hover:text-brand-600 transition-colors">
            Kosong
          </span>
        </div>
        <div className="flex flex-col items-center justify-center text-center my-auto">
          <span className="text-xs font-medium text-gray-400 group-hover:text-brand-600 transition-colors">
            Kursi Kosong
          </span>
        </div>
        <div className="text-[10px] text-center text-gray-400">Tersedia</div>
      </div>
    );
  }

  // Occupied Seat
  return (
    <div
      onClick={() => onClick ? onClick(seat, student) : null}
      className={`group relative flex flex-col justify-between p-3 h-24 rounded-xl border bg-white shadow-subtle hover:shadow-card hover:-translate-y-0.5 transition-all cursor-pointer select-none ${
        isSelected
          ? 'border-brand-600 ring-2 ring-brand-600/20'
          : isHighlighted
          ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/40'
          : 'border-divider hover:border-brand-300'
      }`}
    >
      {/* Top row: Seat Code & Avatar/Badge */}
      <div className="flex items-center justify-between">
        {showCode && (
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
              isHighlighted
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-700 group-hover:bg-brand-50 group-hover:text-brand-700'
            }`}
          >
            {seat.code || seat.id}
          </span>
        )}
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 text-[10px] font-bold">
            {student.number || <User className="w-3 h-3" />}
          </div>
        </div>
      </div>

      {/* Middle row: Nickname (Prominent) */}
      <div className="flex flex-col items-center justify-center my-auto text-center px-1">
        <span
          className={`text-sm font-bold tracking-tight truncate w-full ${
            isHighlighted ? 'text-amber-900 font-extrabold' : 'text-content-primary group-hover:text-brand-600'
          }`}
          title={student.fullName}
        >
          {student.nickname}
        </span>
      </div>

      {/* Bottom row: Full name truncated / subtle info */}
      <div className="flex items-center justify-between text-[10px] text-content-secondary border-t border-gray-100 pt-1 mt-1">
        <span className="truncate max-w-[90px]" title={student.fullName}>
          {student.fullName}
        </span>
        <span className="text-brand-600 font-medium ml-1">No.{student.number}</span>
      </div>
    </div>
  );
}


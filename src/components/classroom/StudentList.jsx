import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export default function StudentList({
  students = [],
  layout = null,
  assignments = {},
  onSelectStudent,
  highlightedStudentId,
}) {
  const [search, setSearch] = useState('');

  /**
   * Build a map of seat UUID → seat_code from the layout blocks.
   * Layout seats have shape: { id: uuid, code: '01' | '14' | ... }
   */
  const seatIdToCode = useMemo(() => {
    const map = {};
    if (!layout || !Array.isArray(layout.blocks)) return map;
    layout.blocks.forEach((block) => {
      (block.seats || []).forEach((seat) => {
        if (seat.id && seat.code) {
          map[seat.id] = seat.code;
        }
      });
    });
    return map;
  }, [layout]);

  /**
   * Build a map of student UUID → seat_code from assignments.
   * assignments shape: { seat_uuid: student_uuid }
   */
  const studentIdToSeatCode = useMemo(() => {
    const map = {};
    Object.entries(assignments).forEach(([seatId, studentId]) => {
      if (studentId) {
        const code = seatIdToCode[seatId];
        if (code) {
          map[studentId] = code;
        }
      }
    });
    return map;
  }, [assignments, seatIdToCode]);

  const getSeatLabel = (studentId) => {
    const code = studentIdToSeatCode[studentId];
    if (!code) return null; // null = unassigned
    return code; // e.g. "01", "14"
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const seatCode = getSeatLabel(s.id);
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.nickname.toLowerCase().includes(q) ||
      String(s.number).includes(q) ||
      (seatCode && seatCode.includes(q))
    );
  });

  return (
    <div className="w-full bg-white rounded-2xl border border-divider shadow-subtle p-4 sm:p-8">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-divider">
        <div>
          <h3 className="text-lg font-bold text-content-primary">
            Daftar 26 Siswa &amp; Posisi Duduk
          </h3>
          <p className="text-xs text-content-secondary mt-1">
            Klik nama siswa untuk menyorot posisi duduknya pada denah kelas di atas.
          </p>
        </div>

        <div className="relative w-full sm:w-72 flex-shrink-0">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor kursi..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-divider bg-canvas text-content-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      {/* Grid of Student Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-content-secondary">
            Tidak ada siswa yang sesuai dengan kata kunci &ldquo;{search}&rdquo;.
          </div>
        ) : (
          filtered.map((s) => {
            const seatCode = getSeatLabel(s.id);
            const isHighlighted = highlightedStudentId === s.id;

            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectStudent(s.id)}
                onKeyDown={(e) => e.key === 'Enter' && onSelectStudent(s.id)}
                aria-label={`${s.nickname} — Kursi ${seatCode ? seatCode : 'Belum Ditentukan'}`}
                className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  isHighlighted
                    ? 'border-amber-400 ring-2 ring-amber-300/60 bg-amber-50 shadow-subtle'
                    : 'border-divider bg-white hover:border-brand-200 hover:bg-brand-50/30'
                }`}
              >
                {/* Number Avatar */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    isHighlighted
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-brand-50 text-brand-700 border border-brand-100 group-hover:bg-brand-100'
                  }`}
                >
                  {String(s.number).padStart(2, '0')}
                </div>

                {/* Name block */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[13px] font-semibold leading-tight truncate ${
                        isHighlighted ? 'text-amber-900' : 'text-content-primary group-hover:text-brand-700'
                      } transition-colors`}
                    >
                      {s.nickname}
                    </span>
                    {s.isActive && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"
                        title="Siswa Aktif"
                      />
                    )}
                  </div>
                  {/* Full name — always visible, secondary style */}
                  <p
                    className="text-[11px] text-content-secondary truncate mt-0.5"
                    title={s.fullName}
                  >
                    {s.fullName}
                  </p>
                </div>

                {/* Seat Badge */}
                <div className="flex-shrink-0 text-right">
                  <span className="block text-[10px] text-content-secondary mb-0.5 font-medium">
                    Kursi
                  </span>
                  {seatCode ? (
                    <span className="inline-block font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                      {seatCode}
                    </span>
                  ) : (
                    <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-400 border border-gray-200">
                      —
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-divider flex items-center justify-between text-[11px] text-content-secondary">
        <span>
          Menampilkan{' '}
          <span className="font-semibold text-content-primary">{filtered.length}</span> dari{' '}
          <span className="font-semibold text-content-primary">{students.length}</span> siswa
        </span>
        <span className="text-brand-600 font-medium hidden sm:block">
          Klik nama siswa untuk melihat letak meja pada denah &uarr;
        </span>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Search } from 'lucide-react';

export default function StudentList({
  students = [],
  assignments = {},
  onSelectStudent,
  highlightedStudentId,
}) {
  const [search, setSearch] = useState('');

  // Find seat code assigned to student
  const getAssignedSeatCode = (studentId) => {
    const seatId = Object.keys(assignments).find((key) => assignments[key] === studentId);
    return seatId ? seatId.replace('seat-', '') : '-';
  };

  const filtered = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.nickname.toLowerCase().includes(search.toLowerCase()) ||
      String(s.number).includes(search) ||
      getAssignedSeatCode(s.id).includes(search)
  );

  return (
    <div className="w-full bg-white rounded-2xl border border-divider shadow-subtle p-4 sm:p-8">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-divider">
        <div>
          <h3 className="text-lg font-bold text-content-primary">
            Daftar 26 Siswa & Posisi Duduk
          </h3>
          <p className="text-xs text-content-secondary mt-1">
            Cari nama Anda atau klik pada kartu siswa untuk menyorot posisi duduk pada denah kelas di atas.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor kursi..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-divider bg-canvas text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>
      </div>

      {/* Grid of Student Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-content-secondary">
            Tidak ada siswa yang sesuai dengan kata kunci "{search}".
          </div>
        ) : (
          filtered.map((s) => {
            const seatCode = getAssignedSeatCode(s.id);
            const isHighlighted = highlightedStudentId === s.id;

            return (
              <div
                key={s.id}
                onClick={() => onSelectStudent(s.id)}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isHighlighted
                    ? 'border-amber-400 ring-2 ring-amber-300 bg-amber-50/50 shadow-subtle'
                    : 'border-divider bg-white hover:border-brand-300 hover:bg-brand-50/20 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-xs border border-brand-100 flex-shrink-0 group-hover:bg-brand-100 transition-colors">
                    {s.number}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-content-primary truncate group-hover:text-brand-700 transition-colors">
                        {s.nickname}
                      </span>
                      {s.isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Siswa Aktif" />
                      )}
                    </div>
                    <p className="text-[11px] text-content-secondary truncate max-w-[170px]" title={s.fullName}>
                      {s.fullName}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[10px] text-content-secondary font-medium mb-0.5">Kursi</span>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      seatCode !== '-'
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    #{seatCode}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-divider flex items-center justify-between text-[11px] text-content-secondary">
        <span>Menampilkan {filtered.length} dari {students.length} siswa</span>
        <span className="text-brand-600 font-medium">Klik nama siswa untuk melihat letak meja pada denah &uarr;</span>
      </div>
    </div>
  );
}

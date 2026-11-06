import React from 'react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import { Armchair, CheckCircle2 } from 'lucide-react';

export default function SeatDetailModal({ isOpen, onClose, seat, student, blockName }) {
  if (!seat) return null;

  const isAvailable = seat.isAvailable !== false;
  const isOccupied = Boolean(student && isAvailable);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Informasi Kursi #${seat.code || seat.id}`} maxWidth="max-w-md">
      <div className="space-y-6">
        {/* Seat Badge & Location */}
        <div className="flex items-center justify-between p-4 bg-canvas rounded-xl border border-divider">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 font-mono font-bold text-lg">
              {seat.code || seat.id}
            </div>
            <div>
              <div className="text-sm font-bold text-content-primary flex items-center gap-2">
                {blockName || 'Blok Meja'}
                {isOccupied ? (
                  <Badge variant="success" size="xs">Terisi</Badge>
                ) : isAvailable ? (
                  <Badge variant="neutral" size="xs">Kosong</Badge>
                ) : (
                  <Badge variant="danger" size="xs">Nonaktif</Badge>
                )}
              </div>
              <p className="text-xs text-content-secondary mt-0.5">
                Baris {seat.row + 1}, Kolom {seat.col + 1}
              </p>
            </div>
          </div>
        </div>

        {/* Student Profile Card (if occupied) */}
        {isOccupied ? (
          <div className="p-4 rounded-xl border border-brand-100 bg-brand-50/40 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-base shadow-subtle">
                {student.nickname ? student.nickname.slice(0, 2).toUpperCase() : 'ST'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-content-primary truncate">{student.nickname}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white font-mono font-semibold text-brand-700 border border-brand-200">
                    No. {student.number}
                  </span>
                </div>
                <p className="text-xs text-content-secondary mt-0.5">Nama Panggilan</p>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-100/60 space-y-2 text-xs">
              <div>
                <span className="text-content-secondary block mb-0.5">Nama Lengkap Siswa:</span>
                <span className="font-semibold text-content-primary block bg-white px-3 py-2 rounded-lg border border-divider">
                  {student.fullName}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-content-secondary">Status Siswa:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Aktif Mengikuti Kelas
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center space-y-2">
            <Armchair className="w-8 h-8 text-gray-400 mx-auto" />
            <h4 className="text-sm font-semibold text-content-primary">
              {isAvailable ? 'Kursi Ini Sedang Kosong' : 'Kursi Sedang Nonaktif'}
            </h4>
            <p className="text-xs text-content-secondary max-w-xs mx-auto">
              {isAvailable
                ? 'Tidak ada siswa yang duduk di kursi ini pada rotasi minggu ini. Kursi dapat terisi pada rotasi acak berikutnya.'
                : 'Kursi ini dinonaktifkan oleh pengurus dan tidak akan diikutsertakan dalam pengacakan rotasi.'}
            </p>
          </div>
        )}

        {/* Footer info */}
        <div className="text-[11px] text-content-secondary text-center pt-2">
          Rotasi tempat duduk otomatis diperbarui setiap Minggu pukul 06:00 WIB.
        </div>
      </div>
    </Modal>
  );
}

import React, { useState } from 'react';
import ClassroomMap from '../classroom/ClassroomMap';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import confetti from 'canvas-confetti';
import { formatWIBDateTime } from '../../utils/timezone';
import {
  Dices,
  Sparkles,
  AlertTriangle,
  History,
} from 'lucide-react';

export default function SeatingManager({
  layout,
  students = [],
  currentArrangement,
  previousArrangement,
  onExecuteReroll,
  showNotification,
}) {
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleNames, setShuffleNames] = useState({});
  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'previous'

  const activeStudents = students.filter((s) => s.isActive);

  // Trigger smooth reroll animation
  const startRerollSequence = () => {
    setConfirmModalOpen(false);
    setIsShuffling(true);

    // Rapid name flipping interval for ~1.8 seconds
    const interval = setInterval(() => {
      const tempNames = {};
      layout.blocks.forEach((b) => {
        b.seats.forEach((s) => {
          if (s.isAvailable && activeStudents.length > 0) {
            const randomStudent = activeStudents[Math.floor(Math.random() * activeStudents.length)];
            tempNames[s.id] = randomStudent.nickname;
          }
        });
      });
      setShuffleNames(tempNames);
    }, 85);

    setTimeout(() => {
      clearInterval(interval);
      setIsShuffling(false);
      setShuffleNames({});

      // Execute actual unbiased Fisher-Yates reroll
      onExecuteReroll();

      // Launch festive confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#C62828', '#E53935', '#F8B4B4', '#FFFFFF'],
        });
      } catch {
        // fallback if canvas not available
      }

      showNotification('Pengacakan tempat duduk kelas berhasil diperbarui!', 'success');
    }, 1800);
  };

  const displayAssignments =
    activeTab === 'previous' && previousArrangement
      ? previousArrangement.assignments
      : currentArrangement?.assignments || {};

  return (
    <div className="space-y-6">
      {/* Top Banner and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-divider shadow-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-content-primary">Pengacakan & Denah Duduk</h2>
            <Badge variant="primary" size="xs">
              {currentArrangement?.type || 'Manual'}
            </Badge>
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Terakhir diacak: <strong className="text-content-primary">{formatWIBDateTime(currentArrangement?.updatedAt)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {previousArrangement && (
            <div className="flex rounded-xl bg-canvas p-1 border border-divider text-xs">
              <button
                onClick={() => setActiveTab('current')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'current'
                    ? 'bg-white text-content-primary shadow-xs'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                Susunan Aktif
              </button>
              <button
                onClick={() => setActiveTab('previous')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'previous'
                    ? 'bg-white text-content-primary shadow-xs'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                Susunan Sebelumnya
              </button>
            </div>
          )}

          <button
            onClick={() => setConfirmModalOpen(true)}
            disabled={isShuffling}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-subtle transition-all transform active:scale-95 disabled:opacity-50"
          >
            <Dices className={`w-4 h-4 ${isShuffling ? 'animate-spin' : ''}`} />
            {isShuffling ? 'Sedang Mengacak...' : 'Acak Ulang Tempat Duduk (Reroll)'}
          </button>
        </div>
      </div>

      {/* Info notice about current view */}
      {activeTab === 'previous' && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-600" />
            <span>
              Anda sedang melihat <strong>Susunan Tempat Duduk Sebelumnya</strong> (arsip rotasi terakhir).
            </span>
          </div>
          <button
            onClick={() => setActiveTab('current')}
            className="font-bold text-brand-700 hover:underline"
          >
            Kembali ke Susunan Aktif &rarr;
          </button>
        </div>
      )}

      {/* Visual Classroom Canvas */}
      <ClassroomMap
        layout={layout}
        students={students}
        assignments={displayAssignments}
        isShuffling={isShuffling}
        shuffleNames={shuffleNames}
      />

      {/* Confirmation Dialog */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Konfirmasi Acak Ulang Tempat Duduk"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-content-secondary">
          <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl flex items-start gap-2.5 text-brand-900">
            <AlertTriangle className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Peringatan Penggantian Posisi:</span>
              Posisi duduk seluruh {activeStudents.length} siswa aktif saat ini akan diacak ulang secara acak dengan algoritma Fisher-Yates.
            </div>
          </div>

          <p>
            Susunan saat ini akan disimpan sebagai arsip sebelumnya dan denah baru akan langsung aktif untuk dilihat siswa.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-divider">
            <button
              onClick={() => setConfirmModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-content-secondary font-medium"
            >
              Batal
            </button>
            <button
              onClick={startRerollSequence}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-subtle"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ya, Acak Sekarang
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import React, { useState } from 'react';
import Badge from '../common/Badge';
import Modal from '../common/Modal';
import { History, Trash2, Clock, RefreshCw, Dices } from 'lucide-react';
import { formatWIBDateTime } from '../../utils/timezone';

export default function HistoryTable({ history = [], onClearHistory, showNotification }) {
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const handleConfirmClear = () => {
    onClearHistory();
    setClearModalOpen(false);
    showNotification('Riwayat pengacakan tempat duduk berhasil dibersihkan.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-divider shadow-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-content-primary">Riwayat Aktivitas Rotasi</h2>
            <Badge variant="neutral" size="xs">
              {history.length} Catatan
            </Badge>
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Catatan log rotasi tempat duduk otomatis mingguan maupun pengacakan manual oleh admin.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setClearModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Bersihkan Riwayat
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-divider shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-canvas border-b border-divider text-[11px] font-bold text-content-secondary uppercase tracking-wider">
                <th className="py-3.5 px-4">Waktu Pelaksanaan (WIB)</th>
                <th className="py-3.5 px-4 text-center">Tipe Rotasi</th>
                <th className="py-3.5 px-4">Keterangan Aktivitas</th>
                <th className="py-3.5 px-4 text-center">Siswa Aktif</th>
                <th className="py-3.5 px-4 font-mono text-xs">Siklus / Cycle ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider text-xs">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-content-secondary">
                    <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    Belum ada riwayat aktivitas pengacakan.
                  </td>
                </tr>
              ) : (
                history.map((log) => {
                  const isAuto = log.type === 'Otomatis';
                  const isManual = log.type === 'Manual';
                  return (
                    <tr key={log.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-content-primary">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                          <span>{log.wibFormatted || formatWIBDateTime(log.timestamp)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isAuto ? (
                          <Badge variant="primary" size="xs">
                            <RefreshCw className="w-3 h-3 text-brand-600" />
                            Otomatis
                          </Badge>
                        ) : isManual ? (
                          <Badge variant="warning" size="xs">
                            <Dices className="w-3 h-3 text-amber-600" />
                            Manual
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="xs">
                            Inisialisasi
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-content-secondary font-medium">
                        {log.description}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-content-primary">
                        {log.activeStudentCount} Siswa
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-content-secondary">
                        {log.cycleId || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Clear Modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Bersihkan Semua Catatan Riwayat?"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-content-secondary">
          <p>
            Apakah Anda yakin ingin menghapus seluruh log riwayat aktivitas pengacakan? Catatan yang dihapus tidak dapat dipulihkan kembali.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-divider">
            <button
              onClick={() => setClearModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-content-secondary font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleConfirmClear}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-subtle"
            >
              Hapus Semua Riwayat
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

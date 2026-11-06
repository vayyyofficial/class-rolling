import React, { useState } from 'react';
import ClassroomMap from '../classroom/ClassroomMap';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import { validateLayout } from '../../utils/validation';
import {
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Eye,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Armchair,
} from 'lucide-react';

export default function LayoutEditor({
  currentLayout,
  activeStudentCount = 26,
  onSave,
  onResetDefault,
  onCancel,
  showNotification,
}) {
  const [layout, setLayout] = useState(() => JSON.parse(JSON.stringify(currentLayout)));
  const [hasChanges, setHasChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [deleteBlockId, setDeleteBlockId] = useState(null);

  // Validate on the fly
  const validation = validateLayout(layout, activeStudentCount);

  const markChanged = (newLayout) => {
    setLayout(newLayout);
    setHasChanges(true);
  };

  // Toggle seat availability (Aktif / Nonaktif)
  const handleToggleSeatAvailable = (seat) => {
    const updated = JSON.parse(JSON.stringify(layout));
    let found = false;

    updated.blocks.forEach((block) => {
      block.seats.forEach((s) => {
        if (s.id === seat.id) {
          s.isAvailable = s.isAvailable === false ? true : false;
          found = true;
        }
      });
    });

    if (found) {
      markChanged(updated);
      showNotification(
        `Kursi #${seat.code || seat.id} kini ${seat.isAvailable === false ? 'diaktifkan' : 'dinonaktifkan'}.`,
        'info'
      );
    }
  };

  // Add row to block
  const handleAddRow = (blockId) => {
    const updated = JSON.parse(JSON.stringify(layout));
    const block = updated.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newRowIndex = block.rows;
    block.rows += 1;

    // Generate seats for each column in this new row
    for (let c = 0; c < block.cols; c++) {
      const seatNum = Math.floor(100 + Math.random() * 900);
      block.seats.push({
        id: `seat-${Date.now()}-${seatNum}-${c}`,
        code: `${block.name.slice(0, 1).toUpperCase()}${block.seats.length + 1}`,
        row: newRowIndex,
        col: c,
        isAvailable: true,
        defaultEmpty: false,
      });
    }

    markChanged(updated);
  };

  // Remove row from block
  const handleRemoveRow = (blockId) => {
    const updated = JSON.parse(JSON.stringify(layout));
    const block = updated.blocks.find((b) => b.id === blockId);
    if (!block || block.rows <= 1) {
      showNotification('Minimal 1 baris pada blok ini.', 'error');
      return;
    }

    const lastRowIndex = block.rows - 1;
    block.seats = block.seats.filter((s) => s.row !== lastRowIndex);
    block.rows -= 1;

    markChanged(updated);
  };

  // Add column to block
  const handleAddCol = (blockId) => {
    const updated = JSON.parse(JSON.stringify(layout));
    const block = updated.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newColIndex = block.cols;
    block.cols += 1;

    for (let r = 0; r < block.rows; r++) {
      const seatNum = Math.floor(100 + Math.random() * 900);
      block.seats.push({
        id: `seat-${Date.now()}-${seatNum}-${r}`,
        code: `${block.name.slice(0, 1).toUpperCase()}${block.seats.length + 1}`,
        row: r,
        col: newColIndex,
        isAvailable: true,
        defaultEmpty: false,
      });
    }

    markChanged(updated);
  };

  // Remove column from block
  const handleRemoveCol = (blockId) => {
    const updated = JSON.parse(JSON.stringify(layout));
    const block = updated.blocks.find((b) => b.id === blockId);
    if (!block || block.cols <= 1) {
      showNotification('Minimal 1 kolom pada blok ini.', 'error');
      return;
    }

    const lastColIndex = block.cols - 1;
    block.seats = block.seats.filter((s) => s.col !== lastColIndex);
    block.cols -= 1;

    markChanged(updated);
  };

  // Add brand new seating block
  const handleAddBlock = () => {
    const updated = JSON.parse(JSON.stringify(layout));
    const blockNum = updated.blocks.length + 1;
    const newBlockId = `block-${Date.now()}`;
    const newBlockName = `Blok ${String.fromCharCode(64 + blockNum)}`; // Blok A, B, C, D...

    const newSeats = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        newSeats.push({
          id: `seat-${newBlockId}-${r}-${c}`,
          code: `${newBlockName.slice(-1)}${r * 2 + c + 1}`,
          row: r,
          col: c,
          isAvailable: true,
          defaultEmpty: false,
        });
      }
    }

    updated.blocks.push({
      id: newBlockId,
      name: newBlockName,
      cols: 2,
      rows: 2,
      seats: newSeats,
    });

    markChanged(updated);
    showNotification(`Blok baru "${newBlockName}" berhasil ditambahkan.`, 'success');
  };

  // Delete block
  const confirmDeleteBlock = () => {
    if (!deleteBlockId) return;
    const updated = JSON.parse(JSON.stringify(layout));
    if (updated.blocks.length <= 1) {
      showNotification('Minimal harus ada 1 blok meja di kelas.', 'error');
      setDeleteBlockId(null);
      return;
    }
    updated.blocks = updated.blocks.filter((b) => b.id !== deleteBlockId);
    markChanged(updated);
    setDeleteBlockId(null);
    showNotification('Blok berhasil dihapus.', 'info');
  };

  // Change teacher desk position
  const handleTeacherDeskChange = (pos) => {
    const updated = JSON.parse(JSON.stringify(layout));
    updated.teacherDesk = {
      ...updated.teacherDesk,
      position: pos,
    };
    markChanged(updated);
  };

  // Save changes
  const handleSave = () => {
    if (!validation.isValid) {
      showNotification(validation.errors[0] || 'Validasi tata letak gagal.', 'error');
      return;
    }
    onSave(layout);
    setHasChanges(false);
    showNotification('Konfigurasi tata letak kelas berhasil disimpan!', 'success');
  };

  // Reset to default
  const handleConfirmReset = () => {
    onResetDefault();
    setResetModalOpen(false);
    showNotification('Tata letak telah dikembalikan ke denah standar (3 blok).', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-divider shadow-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-content-primary">Visual Layout Editor</h2>
            {hasChanges && (
              <Badge variant="warning" size="xs">
                Ada Perubahan Belum Disimpan
              </Badge>
            )}
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Sesuaikan posisi meja, baris, kolom, atau nonaktifkan kursi tanpa mengubah kode.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              previewMode
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white border-divider text-content-primary hover:bg-canvas'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {previewMode ? 'Keluar Pratinjau' : 'Pratinjau'}
          </button>

          <button
            onClick={() => setResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-divider text-content-secondary hover:text-content-primary hover:bg-canvas transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Denah
          </button>

          {hasChanges && (
            <button
              onClick={() => {
                setLayout(JSON.parse(JSON.stringify(currentLayout)));
                setHasChanges(false);
                if (onCancel) onCancel();
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-content-secondary hover:text-content-primary bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Batalkan
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={!validation.isValid}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-subtle ${
              validation.isValid
                ? 'bg-brand-600 hover:bg-brand-700'
                : 'bg-gray-400 cursor-not-allowed opacity-70'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            Simpan Perubahan
          </button>
        </div>
      </div>

      {/* Validation Banner if errors or warnings */}
      {validation.errors.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Konfigurasi tidak valid:</span>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Stats & Global Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-divider shadow-subtle flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
              Total Kursi
            </span>
            <div className="text-xl font-bold text-content-primary mt-0.5">
              {validation.totalSeats}
            </div>
          </div>
          <Armchair className="w-6 h-6 text-brand-600 opacity-80" />
        </div>

        <div className="p-4 bg-white rounded-xl border border-divider shadow-subtle flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
              Kursi Tersedia
            </span>
            <div className="text-xl font-bold text-emerald-600 mt-0.5">
              {validation.availableSeats}
            </div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-600 opacity-80" />
        </div>

        <div className="p-4 bg-white rounded-xl border border-divider shadow-subtle flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
              Siswa Aktif
            </span>
            <div className="text-xl font-bold text-content-primary mt-0.5">
              {activeStudentCount}
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-brand-50 text-brand-700">
            Kebutuhan
          </span>
        </div>

        {/* Teacher Desk Position Setting */}
        <div className="p-4 bg-white rounded-xl border border-divider shadow-subtle">
          <span className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider block mb-1.5">
            Posisi Meja Guru
          </span>
          <div className="flex items-center gap-1.5">
            {['left', 'center', 'right'].map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => handleTeacherDeskChange(pos)}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg capitalize border transition-all ${
                  layout.teacherDesk?.position === pos
                    ? 'bg-brand-50 text-brand-700 border-brand-300'
                    : 'bg-canvas text-content-secondary border-divider hover:bg-gray-100'
                }`}
              >
                {pos === 'left' ? 'Kiri' : pos === 'center' ? 'Tengah' : 'Kanan'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Interactive Layout Area */}
      <div className="p-4 sm:p-6 bg-white rounded-2xl border border-divider shadow-subtle">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-divider">
          <div>
            <h3 className="text-sm font-bold text-content-primary flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-600" />
              Editor Blok Meja Kelas
            </h3>
            <p className="text-xs text-content-secondary mt-0.5">
              Klik pada kursi untuk mengaktifkan/menonaktifkan atau mengubah status kursi.
            </p>
          </div>
          <button
            onClick={handleAddBlock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Blok Meja
          </button>
        </div>

        {/* Live Classroom Interactive Canvas */}
        <ClassroomMap
          layout={layout}
          students={[]}
          assignments={{}}
          editable={true}
          onToggleSeatAvailable={handleToggleSeatAvailable}
        />

        {/* Per-Block Structure Modifiers */}
        <div className="mt-8 pt-6 border-t border-divider space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
            Pengaturan Dimensi Per Blok
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {layout.blocks.map((block) => (
              <div
                key={block.id}
                className="p-4 rounded-xl border border-divider bg-canvas/70 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-content-primary">{block.name}</span>
                  {layout.blocks.length > 1 && (
                    <button
                      onClick={() => setDeleteBlockId(block.id)}
                      className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus Blok"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Row controls */}
                  <div className="p-2.5 bg-white rounded-lg border border-divider">
                    <span className="text-content-secondary block text-[11px] mb-1.5">
                      Baris: <strong className="text-content-primary">{block.rows}</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRemoveRow(block.id)}
                        className="flex-1 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleAddRow(block.id)}
                        className="flex-1 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Col controls */}
                  <div className="p-2.5 bg-white rounded-lg border border-divider">
                    <span className="text-content-secondary block text-[11px] mb-1.5">
                      Kolom: <strong className="text-content-primary">{block.cols}</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRemoveCol(block.id)}
                        className="flex-1 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleAddCol(block.id)}
                        className="flex-1 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Reset Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Kembalikan ke Denah Standar?"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-content-secondary">
          <p>
            Tindakan ini akan mengembalikan susunan ruang kelas ke tata letak awal:
            <strong> 3 Blok (Kiri 10, Tengah 10, Kanan 8 kursi)</strong> dengan 2 kursi kosong di belakang blok kanan.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-content-primary font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleConfirmReset}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium shadow-subtle"
            >
              Ya, Reset Denah
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Delete Block Modal */}
      <Modal
        isOpen={Boolean(deleteBlockId)}
        onClose={() => setDeleteBlockId(null)}
        title="Hapus Blok Meja?"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-content-secondary">
          <p>
            Apakah Anda yakin ingin menghapus blok ini beserta seluruh kursi di dalamnya?
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              onClick={() => setDeleteBlockId(null)}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-content-primary font-medium"
            >
              Batal
            </button>
            <button
              onClick={confirmDeleteBlock}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-subtle"
            >
              Hapus Blok
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

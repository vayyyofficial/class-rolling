import React, { useState } from 'react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import { validateStudent } from '../../utils/validation';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';

export default function StudentManager({
  students = [],
  assignments = {},
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onToggleActive,
  onResetDefault,
  showNotification,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({ fullName: '', nickname: '', isActive: true });
  const [formErrors, setFormErrors] = useState({});

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.number).includes(searchQuery);

    if (filterActive === 'active') return matchesSearch && s.isActive;
    if (filterActive === 'inactive') return matchesSearch && !s.isActive;
    return matchesSearch;
  });

  const activeCount = students.filter((s) => s.isActive).length;

  // Open add modal
  const openAdd = () => {
    setFormData({ fullName: '', nickname: '', isActive: true });
    setFormErrors({});
    setAddModalOpen(true);
  };

  // Submit add
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const val = validateStudent(formData);
    if (!val.isValid) {
      setFormErrors(val.errors);
      return;
    }

    const result = await onAddStudent(formData);
    if (result?.error) {
      return;
    }
    setAddModalOpen(false);
  };

  // Open edit modal
  const openEdit = (s) => {
    setEditStudent(s);
    setFormData({ fullName: s.fullName, nickname: s.nickname, isActive: s.isActive });
    setFormErrors({});
  };

  // Submit edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const val = validateStudent(formData);
    if (!val.isValid) {
      setFormErrors(val.errors);
      return;
    }

    const result = await onUpdateStudent(editStudent.id, formData);
    if (result?.error) {
      return;
    }
    setEditStudent(null);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteStudent) return;
    const result = await onDeleteStudent(deleteStudent.id);
    if (result?.error) {
      return;
    }
    setDeleteStudent(null);
  };

  // Confirm reset
  const handleConfirmReset = () => {
    onResetDefault();
    setResetModalOpen(false);
    showNotification('Daftar siswa dikembalikan ke 26 data siswa awal.', 'info');
  };

  // Find seat assigned for a student
  const getAssignedSeatCode = (studentId) => {
    const seatId = Object.keys(assignments).find((key) => assignments[key] === studentId);
    return seatId ? seatId.replace('seat-', '#') : '-';
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-divider shadow-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-content-primary">Manajemen Siswa Kelas</h2>
            <Badge variant="primary" size="xs">
              {activeCount} / {students.length} Siswa Aktif
            </Badge>
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Kelola data 26 siswa kelas, ubah nama panggilan, atau atur keikutsertaan dalam rotasi tempat duduk.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-divider text-content-secondary hover:text-content-primary hover:bg-canvas transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset ke 26 Siswa Awal
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-subtle transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Siswa
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-xl border border-divider">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, panggilan, atau no absen..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-divider bg-canvas text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-content-secondary hidden sm:inline">Filter:</span>
          {['all', 'active', 'inactive'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                filterActive === f
                  ? 'bg-brand-50 text-brand-700 border-brand-200'
                  : 'bg-white text-content-secondary border-divider hover:bg-canvas'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Nonaktif'}
            </button>
          ))}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-divider shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-canvas border-b border-divider text-[11px] font-bold text-content-secondary uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">No.</th>
                <th className="py-3.5 px-4">Nama Lengkap Siswa</th>
                <th className="py-3.5 px-4">Nama Panggilan</th>
                <th className="py-3.5 px-4 text-center">Kursi Saat Ini</th>
                <th className="py-3.5 px-4 text-center">Status Rotasi</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-content-secondary">
                    Tidak ada siswa yang sesuai dengan pencarian "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const seatCode = getAssignedSeatCode(s.id);
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-brand-50/20 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-content-secondary">
                        {s.number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-content-primary">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-[11px] border border-brand-100 flex-shrink-0">
                            {s.nickname.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="truncate max-w-xs">{s.fullName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-brand-700 bg-brand-50/70 px-2 py-0.5 rounded border border-brand-100">
                          {s.nickname}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {seatCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onToggleActive(s.id)}
                          className="inline-flex items-center gap-1 cursor-pointer focus:outline-none"
                          title="Klik untuk mengubah status aktif"
                        >
                          {s.isActive ? (
                            <Badge variant="success" size="xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="danger" size="xs">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Nonaktif
                            </Badge>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg text-content-secondary hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Edit Siswa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteStudent(s)}
                            className="p-1.5 rounded-lg text-content-secondary hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Tambah Siswa Baru"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-content-primary block mb-1">
              Nama Lengkap Siswa *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Contoh: MUHAMMAD SALMAN AL FARIZI"
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-canvas focus:outline-none focus:ring-2 ${
                formErrors.fullName ? 'border-rose-400 focus:ring-rose-200' : 'border-divider focus:ring-brand-500/20'
              }`}
            />
            {formErrors.fullName && <p className="text-[11px] text-rose-600 mt-1">{formErrors.fullName}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-content-primary block mb-1">
              Nama Panggilan (Nickname) *
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="Contoh: Faris"
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-canvas focus:outline-none focus:ring-2 ${
                formErrors.nickname ? 'border-rose-400 focus:ring-rose-200' : 'border-divider focus:ring-brand-500/20'
              }`}
            />
            {formErrors.nickname && <p className="text-[11px] text-rose-600 mt-1">{formErrors.nickname}</p>}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="addActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="addActive" className="text-xs text-content-primary font-medium cursor-pointer">
              Siswa Aktif mengikuti rotasi tempat duduk
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-divider">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-content-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-subtle"
            >
              Simpan Siswa
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={Boolean(editStudent)}
        onClose={() => setEditStudent(null)}
        title={`Edit Data Siswa #${editStudent?.number || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-content-primary block mb-1">
              Nama Lengkap Siswa *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-canvas focus:outline-none focus:ring-2 ${
                formErrors.fullName ? 'border-rose-400 focus:ring-rose-200' : 'border-divider focus:ring-brand-500/20'
              }`}
            />
            {formErrors.fullName && <p className="text-[11px] text-rose-600 mt-1">{formErrors.fullName}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-content-primary block mb-1">
              Nama Panggilan (Nickname) *
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-canvas focus:outline-none focus:ring-2 ${
                formErrors.nickname ? 'border-rose-400 focus:ring-rose-200' : 'border-divider focus:ring-brand-500/20'
              }`}
            />
            {formErrors.nickname && <p className="text-[11px] text-rose-600 mt-1">{formErrors.nickname}</p>}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="editActive" className="text-xs text-content-primary font-medium cursor-pointer">
              Siswa Aktif mengikuti rotasi tempat duduk
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-divider">
            <button
              type="button"
              onClick={() => setEditStudent(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-content-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-subtle"
            >
              Perbarui Data
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteStudent)}
        onClose={() => setDeleteStudent(null)}
        title="Hapus Siswa dari Kelas?"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-content-secondary">
          <p>
            Apakah Anda yakin ingin menghapus siswa <strong>{deleteStudent?.fullName}</strong> ({deleteStudent?.nickname})?
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              onClick={() => setDeleteStudent(null)}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-content-primary font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-subtle"
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset ke 26 Siswa Awal?"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-content-secondary">
          <p>
            Tindakan ini akan memulihkan daftar siswa ke <strong>26 siswa terdaftar awal</strong> persis sesuai data bawaan kelas.
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
              Ya, Reset
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

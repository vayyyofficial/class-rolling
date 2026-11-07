import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { groupService } from '../../services/groupService';
import Badge from '../common/Badge';
import Modal from '../common/Modal';
import {
  Users,
  Dices,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  Bookmark,
  BookmarkCheck,
  Search,
  BookOpen,
  FolderArchive,
  ChevronRight,
  UserCheck,
  Trash2,
} from 'lucide-react';

const COMMON_SUBJECTS = [
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Fisika',
  'Kimia',
  'Biologi',
  'Sejarah',
  'Informatika',
  'Sosiologi',
  'Ekonomi',
];

const GROUP_CATEGORIES = [
  'Tugas Kelompok',
  'Proyek Kelas',
  'Praktikum / Eksperimen',
  'Diskusi & Presentasi',
  'Aktivitas Kelas / Games',
];

export default function GroupRandomizerView({ students = [], showNotification }) {
  const [activeTab, setActiveTab] = useState('randomizer'); // 'randomizer' | 'saved'
  const [generation, setGeneration] = useState(() => groupService.getCurrentUnsaved());
  const [numGroups, setNumGroups] = useState(() => groupService.getCurrentUnsaved()?.numGroups || 4);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shufflePreview, setShufflePreview] = useState([]);
  const [copied, setCopied] = useState(false);

  // Saved Groups List State
  const [savedGroups, setSavedGroups] = useState([]);

  // Save Modal State
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [category, setCategory] = useState(GROUP_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // View Saved Detail Modal
  const [selectedSavedDetail, setSelectedSavedDetail] = useState(null);

  const activeStudents = useMemo(() => {
    return students.filter((s) => s.isActive !== false);
  }, [students]);

  // Load saved groups on mount & Realtime updates
  useEffect(() => {
    let isMounted = true;

    // Fetch saved groups list
    groupService.fetchSavedGroups().then((list) => {
      if (isMounted) setSavedGroups(list);
    });

    const unsubscribe = groupService.subscribeToSavedGroups((list) => {
      if (isMounted) setSavedGroups(list);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Compute balanced group breakdown preview
  const getGroupBreakdown = (totalStudents, groupsCount) => {
    if (!totalStudents || !groupsCount) return '';
    const base = Math.floor(totalStudents / groupsCount);
    const remainder = totalStudents % groupsCount;

    if (remainder === 0) {
      return `${groupsCount} kelompok masing-masing ${base} siswa`;
    }
    return `${remainder} kelompok berisi ${base + 1} siswa & ${groupsCount - remainder} kelompok berisi ${base} siswa`;
  };

  // Trigger group generation with animation
  const handleGenerate = () => {
    if (activeStudents.length < numGroups) {
      showNotification(`Jumlah siswa (${activeStudents.length}) kurang dari ${numGroups} kelompok.`, 'error');
      return;
    }

    setIsShuffling(true);

    // Rapid name cycle animation for 1.2 seconds
    const interval = setInterval(() => {
      const sample = [...activeStudents].sort(() => 0.5 - Math.random()).slice(0, 4);
      setShufflePreview(sample.map((s) => s.nickname));
    }, 85);

    setTimeout(() => {
      clearInterval(interval);
      try {
        const result = groupService.generateGroups(numGroups);
        setGeneration(result);
        setIsShuffling(false);
        setShufflePreview([]);

        // Confetti effect
        try {
          confetti({
            particleCount: 50,
            spread: 55,
            origin: { y: 0.6 },
            colors: ['#C62828', '#E53935', '#F8B4B4', '#FFFFFF'],
          });
        } catch {
          // ignore if canvas not supported
        }

        showNotification(`Berhasil membagi ${result.studentCount} siswa ke dalam ${result.numGroups} kelompok!`, 'success');
      } catch (err) {
        setIsShuffling(false);
        showNotification(err.message || 'Gagal mengacak kelompok.', 'error');
      }
    }, 1200);
  };

  // Open Save Modal
  const openSaveModal = () => {
    if (!generation) return;
    setCategory(GROUP_CATEGORIES[0]);
    setSubject('');
    setSelectedStudentId('');
    setStudentSearch('');
    setSaveModalOpen(true);
  };

  // Filter students for submitter dropdown
  const filteredSubmitters = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return activeStudents;
    return activeStudents.filter(
      (s) =>
        s.nickname.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q) ||
        String(s.number).includes(q)
    );
  }, [activeStudents, studentSearch]);

  const selectedStudentObj = useMemo(() => {
    return activeStudents.find((s) => s.id === selectedStudentId) || null;
  }, [activeStudents, selectedStudentId]);

  // Submit Save Group
  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      showNotification('Mata pelajaran wajib diisi.', 'error');
      return;
    }
    if (!selectedStudentId || !selectedStudentObj) {
      showNotification('Pilih siswa yang menyimpan kelompok dari daftar nama.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await groupService.saveGroup({
        category,
        subject: subject.trim(),
        submittedByStudentId: selectedStudentObj.id,
        submittedByName: `${selectedStudentObj.nickname} (${selectedStudentObj.fullName})`,
        numGroups: generation.numGroups,
        studentCount: generation.studentCount,
        groups: generation.groups,
      });

      setIsSaving(false);
      setSaveModalOpen(false);
      setGeneration(saved);

      // Refresh list
      const updatedList = await groupService.fetchSavedGroups();
      setSavedGroups(updatedList);

      showNotification(`Kelompok untuk mata pelajaran "${saved.subject}" berhasil disimpan!`, 'success');
    } catch (err) {
      setIsSaving(false);
      showNotification(err.message || 'Gagal menyimpan kelompok.', 'error');
    }
  };

  // Delete saved group record
  const handleDeleteSaved = async (id, title) => {
    if (window.confirm(`Hapus catatan kelompok untuk "${title}"?`)) {
      await groupService.deleteSavedGroup(id);
      const updated = await groupService.fetchSavedGroups();
      setSavedGroups(updated);
      if (selectedSavedDetail?.id === id) {
        setSelectedSavedDetail(null);
      }
      showNotification(`Catatan kelompok "${title}" telah dihapus.`, 'info');
    }
  };

  // Copy results to clipboard
  const handleCopy = async (targetGeneration) => {
    if (!targetGeneration) return;
    const text = groupService.formatGroupsForCopy(targetGeneration);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showNotification('Hasil kelompok berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showNotification('Gagal menyalin teks.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-divider pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('randomizer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'randomizer'
                ? 'bg-brand-600 text-white shadow-subtle'
                : 'bg-white text-content-secondary hover:text-content-primary border border-divider hover:bg-canvas'
            }`}
          >
            <Dices className="w-4 h-4" />
            <span>Acak Kelompok Tugas</span>
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'saved'
                ? 'bg-brand-600 text-white shadow-subtle'
                : 'bg-white text-content-secondary hover:text-content-primary border border-divider hover:bg-canvas'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Kelompok Tersimpan</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'saved' ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700'
              }`}
            >
              {savedGroups.length}
            </span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: RANDOMIZER ================= */}
      {activeTab === 'randomizer' && (
        <div className="space-y-6">
          {/* Header & Controls Bar */}
          <div className="bg-white rounded-2xl border border-divider p-6 sm:p-8 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                Utilitas Pembagi Kelompok 26 Siswa
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
                Pembagi Kelompok Acak
              </h2>
              <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
                Bantu pengurus kelas membagi siswa ke dalam kelompok tugas, proyek, atau praktikum secara acak dan seimbang tanpa perlu memasukkan nama satu per satu ke spin wheel.
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 bg-canvas px-3.5 py-2 rounded-xl border border-divider">
                <span className="text-xs font-semibold text-content-secondary">Jumlah Kelompok:</span>
                <select
                  value={numGroups}
                  onChange={(e) => setNumGroups(Number(e.target.value))}
                  disabled={isShuffling}
                  className="bg-white px-2.5 py-1 text-xs font-bold rounded-lg border border-divider text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 13].map((n) => (
                    <option key={n} value={n}>
                      {n} Kelompok
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isShuffling}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-subtle transition-all transform active:scale-95 disabled:opacity-50"
              >
                <Dices className={`w-4 h-4 ${isShuffling ? 'animate-spin' : ''}`} />
                {isShuffling ? 'Mengacak Siswa...' : 'Acak Kelompok Sekarang'}
              </button>
            </div>
          </div>

          {/* Composition Notice */}
          <div className="p-3.5 bg-brand-50/50 border border-brand-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-brand-900">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <span>
                Komposisi: <strong>{getGroupBreakdown(activeStudents.length, numGroups)}</strong> ({activeStudents.length} siswa aktif terdaftar).
              </span>
            </div>
          </div>

          {/* Shuffling Animation */}
          {isShuffling && (
            <div className="p-12 bg-white rounded-2xl border-2 border-dashed border-brand-300 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto animate-bounce">
                <Dices className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-base font-bold text-content-primary">Sedang Mengacak Anggota Kelompok...</h3>
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
                {shufflePreview.map((name, i) => (
                  <span key={i} className="px-3 py-1 rounded-lg bg-brand-100 text-brand-800 text-xs font-bold animate-pulse">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results Display */}
          {!isShuffling && generation && generation.groups && (
            <div className="space-y-6">
              {/* Status Header: Saved vs Unsaved */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-divider shadow-subtle">
                <div className="flex items-center gap-3">
                  {generation.isSaved ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <div>
                        <span className="text-xs font-bold text-emerald-800">
                          Tersimpan: {generation.subject} ({generation.category})
                        </span>
                        {generation.submittedByName && (
                          <p className="text-[11px] text-content-secondary">
                            Disimpan oleh: {generation.submittedByName}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <div>
                        <span className="text-xs font-bold text-amber-800">
                          Hasil Acak Baru (Belum Disimpan)
                        </span>
                        <p className="text-[11px] text-content-secondary">
                          Klik tombol "Simpan Kelompok" agar hasil ini tersimpan untuk tugas mata pelajaran terkait.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Save Button */}
                  {!generation.isSaved ? (
                    <button
                      onClick={openSaveModal}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-subtle transition-all transform active:scale-95"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      Simpan Kelompok
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                      <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                      Sudah Tersimpan
                    </div>
                  )}

                  {/* Copy WhatsApp Button */}
                  <button
                    onClick={() => handleCopy(generation)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-divider hover:bg-canvas text-content-primary shadow-xs transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-brand-600" />}
                    {copied ? 'Tersalin!' : 'Salin WhatsApp'}
                  </button>

                  {/* Re-roll button */}
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Acak Ulang
                  </button>
                </div>
              </div>

              {/* Grid of Groups */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {generation.groups.map((group) => (
                  <div
                    key={group.groupNumber}
                    className="bg-white rounded-2xl border border-divider shadow-subtle hover:shadow-card transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-4 bg-canvas border-b border-divider flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-brand-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                          {group.groupNumber}
                        </div>
                        <span className="font-bold text-sm text-content-primary">{group.name}</span>
                      </div>
                      <Badge variant="neutral" size="xs">
                        {group.members.length} Siswa
                      </Badge>
                    </div>

                    <div className="p-3 divide-y divide-gray-100 flex-1">
                      {group.members.map((member, idx) => (
                        <div key={member.id} className="py-2 px-1.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="font-mono text-[10px] text-content-secondary w-4 text-center">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-content-primary block truncate">
                                {member.nickname}
                              </span>
                              <span className="text-[10px] text-content-secondary block truncate max-w-[140px]" title={member.fullName}>
                                {member.fullName}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded flex-shrink-0">
                            #{String(member.number).padStart(2, '0')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Initial State */}
          {!isShuffling && !generation && (
            <div className="p-12 bg-white rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-canvas text-gray-400 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-content-primary">Belum Ada Kelompok Terbentuk</h3>
              <p className="text-xs text-content-secondary max-w-sm mx-auto">
                Pilih jumlah kelompok lalu klik "Acak Kelompok Sekarang" untuk membagi 26 siswa kelas secara instan.
              </p>
              <button
                onClick={handleGenerate}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-subtle mt-2"
              >
                Mulai Acak Kelompok
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: SAVED GROUPS ================= */}
      {activeTab === 'saved' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-divider p-6 sm:p-8 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-content-primary flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-600" />
                Daftar Kelompok Tugas Tersimpan
              </h3>
              <p className="text-xs text-content-secondary mt-1">
                Catatan kelompok yang telah disimpan untuk tugas atau proyek tertentu. Pengacakan baru tidak akan menghapus data di sini.
              </p>
            </div>

            <button
              onClick={() => setActiveTab('randomizer')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors self-start sm:self-auto"
            >
              <Dices className="w-4 h-4" />
              Acak Kelompok Baru
            </button>
          </div>

          {savedGroups.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-divider text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
                <FolderArchive className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-content-primary">Belum Ada Kelompok yang Disimpan</h4>
              <p className="text-xs text-content-secondary max-w-sm mx-auto">
                Setelah mengacak kelompok pada tab "Acak Kelompok", klik tombol "Simpan Kelompok" untuk mendokumentasikannya di sini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedGroups.map((saved) => (
                <div
                  key={saved.id}
                  className="bg-white rounded-2xl border border-divider shadow-subtle hover:border-brand-300 transition-all p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                        {saved.category}
                      </span>
                      <span className="text-[11px] text-content-secondary">
                        {new Date(saved.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-content-primary truncate">
                      {saved.subject}
                    </h4>

                    <div className="space-y-1 text-xs text-content-secondary">
                      <p className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-brand-600" />
                        <span>{saved.numGroups} Kelompok ({saved.studentCount} Siswa)</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="truncate">Oleh: <strong>{saved.submittedByName}</strong></span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-divider flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedSavedDetail(saved)}
                      className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      <span>Buka Detail</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(saved)}
                        title="Salin ke WhatsApp"
                        className="p-1.5 rounded-lg text-content-secondary hover:text-brand-600 hover:bg-canvas transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(saved.id, saved.subject)}
                        title="Hapus Catatan"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: SIMPAN KELOMPOK ================= */}
      {saveModalOpen && (
        <Modal
          isOpen={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          title="Simpan Hasil Kelompok"
        >
          <form onSubmit={handleSaveSubmit} className="space-y-4">
            <p className="text-xs text-content-secondary">
              Dokumentasikan kelompok ini agar dapat dibuka kembali oleh teman sekelas untuk keperluan tugas terkait.
            </p>

            {/* 1. Kategori Kelompok */}
            <div>
              <label className="text-xs font-semibold text-content-primary block mb-1">
                Kategori Kelompok <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-divider bg-canvas text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {GROUP_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Mata Pelajaran */}
            <div>
              <label className="text-xs font-semibold text-content-primary block mb-1">
                Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Contoh: Matematika, Fisika, dll."
                className="w-full px-3 py-2 text-xs rounded-xl border border-divider bg-canvas text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {/* Quick tags */}
              <div className="flex flex-wrap gap-1 mt-2">
                {COMMON_SUBJECTS.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubject(sub)}
                    className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-[11px] text-content-secondary transition-colors"
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Disimpan Oleh (Searchable student select) */}
            <div>
              <label className="text-xs font-semibold text-content-primary block mb-1">
                Disimpan Oleh (Pilih Siswa) <span className="text-rose-500">*</span>
              </label>

              {/* Selected student badge */}
              {selectedStudentObj ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 mb-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-semibold">
                      #{String(selectedStudentObj.number).padStart(2, '0')} — {selectedStudentObj.nickname} ({selectedStudentObj.fullName})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId('')}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    Ganti
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Cari nama siswa kelas..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-divider bg-canvas text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  {/* Student listbox */}
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-divider divide-y divide-gray-100 bg-white">
                    {filteredSubmitters.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStudentId(s.id)}
                        className="w-full p-2 text-left hover:bg-brand-50 flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-content-secondary w-5">
                            #{String(s.number).padStart(2, '0')}
                          </span>
                          <span className="font-semibold text-content-primary">
                            {s.nickname}
                          </span>
                          <span className="text-[10px] text-content-secondary truncate max-w-[150px]">
                            ({s.fullName})
                          </span>
                        </div>
                        <span className="text-[10px] text-brand-600 font-bold">Pilih</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-divider flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-content-secondary hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving || !subject.trim() || !selectedStudentId}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-subtle disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Sekarang'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: DETAIL KELOMPOK TERSIMPAN ================= */}
      {selectedSavedDetail && (
        <Modal
          isOpen={Boolean(selectedSavedDetail)}
          onClose={() => setSelectedSavedDetail(null)}
          title={`Detail Kelompok: ${selectedSavedDetail.subject}`}
        >
          <div className="space-y-5">
            {/* Metadata banner */}
            <div className="p-3.5 bg-canvas rounded-xl border border-divider space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-content-primary">
                  {selectedSavedDetail.category}
                </span>
                <span className="text-[11px] text-content-secondary">
                  {new Date(selectedSavedDetail.createdAt).toLocaleDateString('id-ID', {
                    dateStyle: 'full',
                  })}
                </span>
              </div>
              <p className="text-content-secondary text-[11px]">
                Disimpan oleh: <strong>{selectedSavedDetail.submittedByName}</strong> • Total {selectedSavedDetail.studentCount} Siswa ({selectedSavedDetail.numGroups} Kelompok)
              </p>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
              {selectedSavedDetail.groups.map((g) => (
                <div key={g.groupNumber} className="bg-white rounded-xl border border-divider p-3 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-divider">
                    <span className="font-bold text-xs text-content-primary">{g.name}</span>
                    <Badge variant="neutral" size="xs">
                      {g.members.length} Siswa
                    </Badge>
                  </div>
                  <div className="divide-y divide-gray-100 text-xs">
                    {g.members.map((m, idx) => (
                      <div key={m.id} className="py-1 flex items-center justify-between">
                        <span className="text-content-primary font-medium truncate max-w-[150px]">
                          {idx + 1}. {m.nickname}
                        </span>
                        <span className="font-mono text-[10px] text-gray-400">
                          #{String(m.number).padStart(2, '0')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-divider flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteSaved(selectedSavedDetail.id, selectedSavedDetail.subject)}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Catatan
              </button>

              <button
                type="button"
                onClick={() => handleCopy(selectedSavedDetail)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-subtle"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin ke WhatsApp
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

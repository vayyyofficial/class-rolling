import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { groupService } from '../../services/groupService';
import Badge from '../common/Badge';
import {
  Users,
  Dices,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  Clock,
} from 'lucide-react';

export default function GroupRandomizerView({ students = [], showNotification }) {
  const [numGroups, setNumGroups] = useState(4);
  const [generation, setGeneration] = useState(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shufflePreview, setShufflePreview] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const activeStudents = students.filter((s) => s.isActive !== false);

  // Load existing / latest group generation on mount
  useEffect(() => {
    let isMounted = true;
    groupService.getLatestGroupGeneration().then((data) => {
      if (isMounted) {
        if (data) {
          setGeneration(data);
          setNumGroups(data.numGroups || 4);
        }
        setIsLoading(false);
      }
    });

    // Subscribe to realtime updates
    const unsubscribe = groupService.subscribeToGroupChanges((updated) => {
      if (isMounted && updated) {
        setGeneration(updated);
        setNumGroups(updated.numGroups || 4);
      }
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
  const handleGenerate = async () => {
    if (activeStudents.length < numGroups) {
      showNotification(`Jumlah siswa aktif (${activeStudents.length}) kurang dari ${numGroups} kelompok.`, 'error');
      return;
    }

    setIsShuffling(true);

    // Rapid name cycle animation for 1.5 seconds
    const interval = setInterval(() => {
      const sample = [...activeStudents].sort(() => 0.5 - Math.random()).slice(0, 4);
      setShufflePreview(sample.map((s) => s.nickname));
    }, 90);

    setTimeout(async () => {
      clearInterval(interval);
      try {
        const result = await groupService.generateGroups(numGroups);
        setGeneration(result);
        setIsShuffling(false);
        setShufflePreview([]);

        // Confetti effect
        try {
          confetti({
            particleCount: 60,
            spread: 60,
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
    }, 1500);
  };

  // Copy results to clipboard
  const handleCopyResults = async () => {
    if (!generation) return;
    const text = groupService.formatGroupsForCopy(generation);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 animate-in fade-in duration-200">
      {/* Header & Controls Bar */}
      <div className="bg-white rounded-2xl border border-divider p-6 sm:p-8 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            Group Randomizer Kelas
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
            Pembagi Kelompok Otomatis
          </h2>
          <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
            Bagi seluruh 26 siswa kelas ke dalam kelompok secara acak, seimbang, dan adil dalam satu kali klik.
          </p>
        </div>

        {/* Group Count Selector & Action Button */}
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
            {isShuffling ? 'Mengacak Kelompok...' : 'Acak Kelompok Sekarang'}
          </button>
        </div>
      </div>

      {/* Breakdown Notice */}
      <div className="p-3.5 bg-brand-50/50 border border-brand-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-brand-900">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <span>
            Komposisi: <strong>{getGroupBreakdown(activeStudents.length, numGroups)}</strong> ({activeStudents.length} siswa aktif).
          </span>
        </div>
        {generation && (
          <span className="text-[11px] text-content-secondary flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Terakhir diacak: {new Date(generation.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
          </span>
        )}
      </div>

      {/* Shuffling Loading State */}
      {isShuffling && (
        <div className="p-12 bg-white rounded-2xl border-2 border-dashed border-brand-300 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto animate-bounce">
            <Dices className="w-6 h-6 animate-spin" />
          </div>
          <h3 className="text-base font-bold text-content-primary">Sedang Mengacak Anggota Kelompok...</h3>
          <div className="flex items-center justify-center gap-2">
            {shufflePreview.map((name, i) => (
              <span key={i} className="px-3 py-1 rounded-lg bg-brand-100 text-brand-800 text-xs font-bold animate-pulse">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Group Results View */}
      {!isShuffling && generation && generation.groups && (
        <div className="space-y-6">
          {/* Top Actions: Copy and Re-roll */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-content-primary">Hasil Pembagian:</span>
              <Badge variant="primary" size="xs">
                {generation.numGroups} Kelompok Terbentuk
              </Badge>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCopyResults}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-divider hover:bg-canvas text-content-primary shadow-xs transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-brand-600" />}
                {copied ? 'Tersalin!' : 'Salin Hasil (WhatsApp)'}
              </button>

              <button
                onClick={handleGenerate}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors"
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
                {/* Group Card Header */}
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

                {/* Group Members List */}
                <div className="p-3 divide-y divide-gray-100 flex-1">
                  {group.members.map((member, idx) => (
                    <div key={member.id} className="py-2 px-1.5 flex items-center justify-between text-xs group">
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
                        #{member.number}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State if not generated yet */}
      {!isShuffling && !generation && !isLoading && (
        <div className="p-12 bg-white rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-canvas text-gray-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-content-primary">Belum Ada Kelompok Terbentuk</h3>
          <p className="text-xs text-content-secondary max-w-sm mx-auto">
            Pilih jumlah kelompok yang diinginkan lalu klik tombol "Acak Kelompok Sekarang" untuk membagi 26 siswa secara acak.
          </p>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-subtle mt-2"
          >
            Mulai Acak Kelompok
          </button>
        </div>
      )}
    </div>
  );
}

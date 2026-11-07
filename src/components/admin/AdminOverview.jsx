import React from 'react';
import Badge from '../common/Badge';
import Countdown from '../common/Countdown';
import { formatWIBDateTime } from '../../utils/timezone';
import {
  Users,
  Armchair,
  CheckCircle2,
  Calendar,
  Clock,
  Dices,
  Grid,
  Sparkles,
} from 'lucide-react';

export default function AdminOverview({
  students = [],
  layout,
  currentArrangement,
  history = [],
  onNavigateTab,
}) {
  const activeStudents = students.filter((s) => s.isActive);
  let totalSeats = 0;
  let availableSeats = 0;

  layout.blocks.forEach((b) => {
    b.seats.forEach((s) => {
      totalSeats++;
      if (s.isAvailable !== false) availableSeats++;
    });
  });

  const emptySeats = Math.max(0, availableSeats - activeStudents.length);
  const latestLog = history.length > 0 ? history[0] : null;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-2xl shadow-card">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="outline" size="xs" className="text-white border-white/30 bg-white/10 mb-3">
            Dashboard Manajemen Kelas
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Selamat Datang di Panel Class Rolling
          </h2>
          <p className="text-sm text-brand-100 mt-2 leading-relaxed">
            Kelola denah kelas 26 siswa, lakukan acak ulang manual kapan saja, atau pantau rotasi otomatis mingguan setiap Minggu pukul 06:00 WIB.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={() => onNavigateTab('seating')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-brand-700 hover:bg-brand-50 text-xs font-bold shadow-subtle transition-all"
            >
              <Dices className="w-4 h-4 text-brand-600" />
              Kelola Denah & Reroll
            </button>
            <button
              onClick={() => onNavigateTab('layout')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-800/60 hover:bg-brand-800/90 text-white border border-white/20 text-xs font-semibold transition-all"
            >
              <Grid className="w-4 h-4" />
              Buka Layout Editor
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Students */}
        <div
          onClick={() => onNavigateTab('students')}
          className="p-5 bg-white rounded-xl border border-divider shadow-subtle hover:border-brand-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Siswa Aktif
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-content-primary mt-2">
            {activeStudents.length}{' '}
            <span className="text-xs font-medium text-content-secondary">/ {students.length} Siswa</span>
          </div>
          <p className="text-[11px] text-content-secondary mt-1 flex items-center justify-between">
            <span>Siap diacak</span>
            <span className="text-brand-600 font-semibold group-hover:underline">Kelola &rarr;</span>
          </p>
        </div>

        {/* Total Positions */}
        <div
          onClick={() => onNavigateTab('layout')}
          className="p-5 bg-white rounded-xl border border-divider shadow-subtle hover:border-brand-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Total Posisi Kursi
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Armchair className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-content-primary mt-2">
            {totalSeats}{' '}
            <span className="text-xs font-medium text-content-secondary">Meja/Kursi</span>
          </div>
          <p className="text-[11px] text-content-secondary mt-1 flex items-center justify-between">
            <span>3 Blok Ruangan</span>
            <span className="text-blue-600 font-semibold group-hover:underline">Edit &rarr;</span>
          </p>
        </div>

        {/* Available vs Empty */}
        <div className="p-5 bg-white rounded-xl border border-divider shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Kursi Kosong
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {emptySeats}{' '}
            <span className="text-xs font-medium text-content-secondary">Kursi Tersisa</span>
          </div>
          <p className="text-[11px] text-content-secondary mt-1">
            2 posisi di belakang blok kanan
          </p>
        </div>

        {/* Schedule */}
        <div
          onClick={() => onNavigateTab('schedule')}
          className="p-5 bg-white rounded-xl border border-divider shadow-subtle hover:border-brand-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Rotasi Berikutnya
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-content-primary mt-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            Minggu 06:00 WIB
          </div>
          <div className="mt-2">
            <Countdown compact={true} />
          </div>
        </div>
      </div>

      {/* Two Columns: Current Seating Quick Info & Latest Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Arrangement Status Card */}
        <div className="p-5 bg-white rounded-2xl border border-divider shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-content-primary flex items-center gap-2">
                <Dices className="w-4 h-4 text-brand-600" />
                Status Susunan Tempat Duduk Aktif
              </h3>
              <Badge variant="primary" size="xs">
                {currentArrangement?.type || 'Aktif'}
              </Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-canvas rounded-xl border border-divider flex items-center justify-between">
                <span className="text-content-secondary">Waktu Pembaruan Terakhir:</span>
                <span className="font-semibold text-content-primary">
                  {formatWIBDateTime(currentArrangement?.updatedAt)}
                </span>
              </div>
              <div className="p-3 bg-canvas rounded-xl border border-divider flex items-center justify-between">
                <span className="text-content-secondary">Siswa Ditempatkan:</span>
                <span className="font-semibold text-content-primary">
                  {currentArrangement?.activeStudentCount || activeStudents.length} Siswa Terdaftar
                </span>
              </div>
              <div className="p-3 bg-canvas rounded-xl border border-divider flex items-center justify-between">
                <span className="text-content-secondary">Siklus Periode:</span>
                <span className="font-mono text-xs font-medium text-brand-700">
                  {currentArrangement?.cycleId || '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-divider flex items-center justify-between">
            <span className="text-xs text-content-secondary">
              Ingin mengganti susunan sekarang?
            </span>
            <button
              onClick={() => onNavigateTab('seating')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700"
            >
              Buka Halaman Reroll &rarr;
            </button>
          </div>
        </div>

        {/* Latest Activity Card */}
        <div className="p-5 bg-white rounded-2xl border border-divider shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-content-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                Aktivitas Terakhir
              </h3>
              <button
                onClick={() => onNavigateTab('history')}
                className="text-xs font-semibold text-brand-600 hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            {latestLog ? (
              <div className="p-4 bg-canvas rounded-xl border border-divider space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-content-primary">{latestLog.description}</span>
                  <Badge variant={latestLog.type === 'Otomatis' ? 'primary' : 'warning'} size="xs">
                    {latestLog.type}
                  </Badge>
                </div>
                <p className="text-content-secondary flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-brand-600" />
                  {latestLog.wibFormatted || formatWIBDateTime(latestLog.timestamp)}
                </p>
                <p className="text-content-secondary text-[11px]">
                  Jumlah siswa dirotasi: <strong>{latestLog.activeStudentCount} siswa</strong>
                </p>
              </div>
            ) : (
              <p className="text-xs text-content-secondary py-6 text-center">
                Belum ada catatan aktivitas tercatat.
              </p>
            )}
          </div>

          <div className="pt-5 mt-5 border-t border-divider flex items-center justify-between text-xs text-content-secondary">
            <span>Zona waktu sistem: Asia/Jakarta (WIB)</span>
            <button
              onClick={() => onNavigateTab('schedule')}
              className="text-brand-600 font-semibold hover:underline"
            >
              Jadwal Rotasi &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

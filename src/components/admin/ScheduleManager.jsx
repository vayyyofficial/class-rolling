import React from 'react';
import Countdown from '../common/Countdown';
import Badge from '../common/Badge';
import { Calendar, Clock, Globe, ShieldAlert, Play, Server } from 'lucide-react';
import { getWeeklyCycleId } from '../../utils/scheduler';
import { WIB_TIMEZONE } from '../../utils/timezone';

export default function ScheduleManager({ onSimulateAutoReroll, showNotification }) {
  const currentCycleId = getWeeklyCycleId();

  const handleSimulate = () => {
    onSimulateAutoReroll();
    showNotification('Simulasi rotasi otomatis mingguan berhasil dijalankan!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-white rounded-2xl border border-divider shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-content-primary">Pengaturan & Informasi Jadwal</h2>
            <Badge variant="success" size="xs">
              Aktif Setiap Minggu 06:00 WIB
            </Badge>
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Konfigurasi waktu pengacakan tempat duduk otomatis dan parameter zona waktu.
          </p>
        </div>

        <button
          onClick={handleSimulate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors"
        >
          <Play className="w-4 h-4 text-brand-600" />
          Simulasikan Pengacakan Otomatis
        </button>
      </div>

      {/* Countdown Hero Box */}
      <div className="p-6 sm:p-8 bg-gradient-to-br from-white via-white to-brand-50/30 rounded-2xl border border-divider shadow-card text-center flex flex-col items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200 mb-3">
          Hitung Mundur Rotasi Berikutnya
        </span>
        <h3 className="text-xl sm:text-2xl font-bold text-content-primary mb-5">
          Menuju Minggu Pukul 06:00 WIB
        </h3>

        <Countdown compact={false} />
      </div>

      {/* Schedule Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-xl border border-divider shadow-subtle space-y-2">
          <div className="flex items-center gap-2 text-brand-600">
            <Calendar className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
              Hari Terjadwal
            </span>
          </div>
          <p className="text-lg font-bold text-content-primary">Setiap Hari Minggu</p>
          <p className="text-xs text-content-secondary">
            Pengacakan dilaksanakan di akhir pekan agar siap digunakan siswa pada hari Senin pagi.
          </p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-divider shadow-subtle space-y-2">
          <div className="flex items-center gap-2 text-brand-600">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
              Waktu Eksekusi
            </span>
          </div>
          <p className="text-lg font-bold text-content-primary">06:00:00 WIB</p>
          <p className="text-xs text-content-secondary">
            Waktu Indonesia Barat (WIB) yang konsisten menggunakan offset UTC+7 tanpa pergantian jam musiman.
          </p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-divider shadow-subtle space-y-2">
          <div className="flex items-center gap-2 text-brand-600">
            <Globe className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
              Zona Waktu
            </span>
          </div>
          <p className="text-lg font-bold text-content-primary">{WIB_TIMEZONE}</p>
          <p className="text-xs text-content-secondary">
            Identifier Siklus Aktif: <strong className="font-mono text-brand-700">{currentCycleId}</strong>
          </p>
        </div>
      </div>

      {/* Technical Architecture & Frontend Limitation Note */}
      <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>Catatan Arsitektur Sistem (Fase Frontend):</span>
        </div>
        <p className="text-xs text-amber-950 leading-relaxed">
          Pada fase frontend ini, logika penjadwalan disimulasikan menggunakan deteksi siklus mingguan (
          <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-mono">weeklyCycleId</code>
          ) dan persistensi lokal <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">localStorage</code>.
          Sistem secara otomatis mendeteksi ketika ambang batas waktu Minggu 06:00 WIB telah terlewati dan memproses rotasi tertunda satu kali tanpa pengacakan ganda saat halaman diakses.
        </p>
        <div className="pt-2 border-t border-amber-200/80 flex items-center gap-2 text-xs text-amber-900 font-medium">
          <Server className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>
            Arsitektur modul ini dirancang modular agar pada fase berikutnya siap dihubungkan langsung ke cron job backend server.
          </span>
        </div>
      </div>
    </div>
  );
}

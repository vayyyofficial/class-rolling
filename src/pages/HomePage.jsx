import React, { useState } from 'react';
import ClassroomMap from '../components/classroom/ClassroomMap';
import StudentList from '../components/classroom/StudentList';
import Countdown from '../components/common/Countdown';
import Badge from '../components/common/Badge';
import { formatWIBShort } from '../utils/timezone';
import {
  Users,
  Calendar,
  Clock,
  Shield,
  Armchair,
  Users2,
} from 'lucide-react';

export default function HomePage({
  layout,
  students = [],
  currentArrangement,
  onOpenAdminLogin,
  onOpenGroupRandomizer,
}) {
  const [highlightedStudentId, setHighlightedStudentId] = useState(null);

  const activeStudents = students.filter((s) => s.isActive);

  const handleStudentSelect = (studentId) => {
    setHighlightedStudentId((prev) => (prev === studentId ? null : studentId));
    // Smooth scroll up to map if on mobile
    const mapElement = document.getElementById('denah-kelas');
    if (mapElement && window.innerWidth < 768) {
      mapElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-12 sm:space-y-16 pb-12">
      {/* 1. Hero / Welcome Section */}
      <section className="relative overflow-hidden pt-6 sm:pt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8">
            {/* Left Column: Heading & Value Prop */}
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                Sistem Rotasi Mingguan Kelas 26 Siswa
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-content-primary tracking-tight leading-[1.15]">
                Denah Tempat Duduk Kelas Yang{' '}
                <span className="text-brand-600">Adil & Transparan</span>
              </h1>

              <p className="text-sm sm:text-base text-content-secondary leading-relaxed">
                RuangKelas mengelola susunan 26 siswa kelas dalam 3 blok ruangan dengan rotasi otomatis setiap pekan serta pembagian kelompok acak. Seluruh siswa dapat mengecek meja duduknya tanpa perlu login.
              </p>

              {/* Quick stats pills */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-divider shadow-subtle text-xs">
                  <Users className="w-4 h-4 text-brand-600" />
                  <span className="text-content-secondary">Total Siswa:</span>
                  <strong className="text-content-primary">{activeStudents.length} Siswa Aktif</strong>
                </div>

                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-divider shadow-subtle text-xs">
                  <Armchair className="w-4 h-4 text-brand-600" />
                  <span className="text-content-secondary">Total Posisi:</span>
                  <strong className="text-content-primary">28 Kursi (2 Kosong)</strong>
                </div>

                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-divider shadow-subtle text-xs">
                  <Clock className="w-4 h-4 text-brand-600" />
                  <span className="text-content-secondary">Jadwal:</span>
                  <strong className="text-content-primary">Minggu 06:00 WIB</strong>
                </div>

                {onOpenGroupRandomizer && (
                  <button
                    onClick={onOpenGroupRandomizer}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-semibold shadow-subtle transition-all"
                  >
                    <Users2 className="w-4 h-4 text-brand-600" />
                    <span>Group Randomizer &rarr;</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Live Countdown Card */}
            <div className="w-full lg:w-96 bg-white rounded-2xl border border-divider p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-divider">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  <span className="text-xs font-bold text-content-primary uppercase tracking-wider">
                    Rotasi Berikutnya
                  </span>
                </div>
                <Badge variant="primary" size="xs">
                  Otomatis
                </Badge>
              </div>

              <Countdown compact={false} />

              <div className="pt-3 border-t border-divider text-[11px] text-content-secondary flex items-center justify-between">
                <span>Diperbarui terakhir:</span>
                <span className="font-semibold text-content-primary">
                  {formatWIBShort(currentArrangement?.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Visual Classroom Seating Map */}
      <section id="denah-kelas" className="scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-content-primary">
                  Denah Tempat Duduk Minggu Ini
                </h2>
                <Badge variant="success" size="xs">
                  Aktif
                </Badge>
              </div>
              <p className="text-xs text-content-secondary mt-1">
                Tampilan visual 3 blok ruangan kelas. Klik pada salah satu meja untuk melihat profil siswa.
              </p>
            </div>

            {highlightedStudentId && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <span>Meja siswa terpilih sedang disorot</span>
                <button
                  onClick={() => setHighlightedStudentId(null)}
                  className="font-bold text-amber-800 hover:underline"
                >
                  (Batal)
                </button>
              </div>
            )}
          </div>

          {/* Interactive Classroom Map */}
          <ClassroomMap
            layout={layout}
            students={students}
            assignments={currentArrangement?.assignments || {}}
            highlightedStudentId={highlightedStudentId}
          />
        </div>
      </section>

      {/* 3. Students Directory List */}
      <section id="daftar-siswa" className="scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StudentList
            students={students}
            layout={layout}
            assignments={currentArrangement?.assignments || {}}
            onSelectStudent={handleStudentSelect}
            highlightedStudentId={highlightedStudentId}
          />
        </div>
      </section>

      {/* 4. Weekly Schedule & Rules Information */}
      <section id="jadwal-reroll" className="scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-divider shadow-subtle p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-content-primary flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-600" />
                Ketentuan & Cara Kerja Rotasi Mingguan
              </h3>
              <p className="text-xs text-content-secondary mt-1">
                Prinsip transparansi pengacakan tempat duduk RuangKelas untuk kenyamanan bersama.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 font-bold flex items-center justify-center text-xs">
                  01
                </div>
                <h4 className="text-xs font-bold text-content-primary">Jadwal Pasti Setiap Minggu</h4>
                <p className="text-xs text-content-secondary leading-relaxed">
                  Pengacakan otomatis dieksekusi setiap hari Minggu tepat pukul 06:00 WIB (Waktu Indonesia Barat) sehingga denah baru siap sebelum kegiatan belajar mengajar dimulai hari Senin.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 font-bold flex items-center justify-center text-xs">
                  02
                </div>
                <h4 className="text-xs font-bold text-content-primary">Algoritma Acak Tanpa Bias</h4>
                <p className="text-xs text-content-secondary leading-relaxed">
                  Seluruh 26 siswa aktif diacak menggunakan algoritma Fisher-Yates (Knuth shuffle) yang adil secara matematis, memastikan peluang yang sama bagi setiap siswa untuk menempati tiap posisi.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-canvas border border-divider space-y-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 font-bold flex items-center justify-center text-xs">
                  03
                </div>
                <h4 className="text-xs font-bold text-content-primary">Stabil Selama Sepekan</h4>
                <p className="text-xs text-content-secondary leading-relaxed">
                  Susunan tempat duduk yang telah dihasilkan akan terkunci dan tetap aktif sepanjang minggu. Denah tidak akan berubah hanya karena halaman web di-refresh atau dibuka oleh siswa lain.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-brand-50/50 border border-brand-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-900">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-brand-600 flex-shrink-0" />
                <span>Pengurus kelas membutuhkan acak ulang khusus atau ingin mengubah tata letak meja?</span>
              </div>
              <button
                onClick={onOpenAdminLogin}
                className="font-bold text-brand-700 hover:text-brand-800 hover:underline flex-shrink-0"
              >
                Masuk ke Panel Admin &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

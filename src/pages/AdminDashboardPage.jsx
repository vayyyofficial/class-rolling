import React, { useState } from 'react';
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminHeader from '../components/admin/AdminHeader';
import AdminOverview from '../components/admin/AdminOverview';
import LayoutEditor from '../components/admin/LayoutEditor';
import StudentManager from '../components/admin/StudentManager';
import SeatingManager from '../components/admin/SeatingManager';
import HistoryTable from '../components/admin/HistoryTable';
import ScheduleManager from '../components/admin/ScheduleManager';

export default function AdminDashboardPage({
  currentUser,
  layout,
  students,
  currentArrangement,
  previousArrangement,
  history,
  onSaveLayout,
  onResetLayout,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onToggleStudentActive,
  onResetStudents,
  onExecuteReroll,
  onClearHistory,
  onSimulateAutoReroll,
  onGoToPublic,
  onLogout,
  showNotification,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const tabTitles = {
    overview: { title: 'Ringkasan Dashboard', subtitle: 'Ikhtisar kapasitas kelas, siswa aktif, dan jadwal rotasi' },
    layout: { title: 'Editor Tata Letak Denah', subtitle: 'Atur blok meja, tambah/hapus baris & kolom secara visual' },
    students: { title: 'Manajemen Data Siswa', subtitle: 'Daftar 26 siswa kelas, ubah nama panggilan, atau nonaktifkan' },
    seating: { title: 'Kelola Denah & Reroll', subtitle: 'Pratinjau visual susunan aktif dan lakukan pengacakan ulang manual' },
    history: { title: 'Riwayat Aktivitas Rotasi', subtitle: 'Log riwayat seluruh pengacakan otomatis dan manual' },
    schedule: { title: 'Pengaturan Jadwal Mingguan', subtitle: 'Parameter waktu Minggu 06:00 WIB dan simulasi siklus' },
  };

  const currentTabInfo = tabTitles[activeTab] || tabTitles.overview;

  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onLogout={onLogout}
          onGoToPublic={onGoToPublic}
          currentUser={currentUser}
        />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 bg-white h-full shadow-card flex flex-col justify-between">
            <AdminSidebar
              activeTab={activeTab}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                setMobileSidebarOpen(false);
              }}
              onLogout={onLogout}
              onGoToPublic={onGoToPublic}
              currentUser={currentUser}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title={currentTabInfo.title}
          subtitle={currentTabInfo.subtitle}
          onToggleMobileNav={() => setMobileSidebarOpen(true)}
          onGoToPublic={onGoToPublic}
          onLogout={onLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <AdminOverview
              students={students}
              layout={layout}
              currentArrangement={currentArrangement}
              history={history}
              onNavigateTab={setActiveTab}
              onTriggerReroll={onExecuteReroll}
            />
          )}

          {activeTab === 'layout' && (
            <LayoutEditor
              currentLayout={layout}
              activeStudentCount={students.filter((s) => s.isActive).length}
              onSave={onSaveLayout}
              onResetDefault={onResetLayout}
              showNotification={showNotification}
            />
          )}

          {activeTab === 'students' && (
            <StudentManager
              students={students}
              assignments={currentArrangement?.assignments || {}}
              onAddStudent={onAddStudent}
              onUpdateStudent={onUpdateStudent}
              onDeleteStudent={onDeleteStudent}
              onToggleActive={onToggleStudentActive}
              onResetDefault={onResetStudents}
              showNotification={showNotification}
            />
          )}

          {activeTab === 'seating' && (
            <SeatingManager
              layout={layout}
              students={students}
              currentArrangement={currentArrangement}
              previousArrangement={previousArrangement}
              onExecuteReroll={onExecuteReroll}
              showNotification={showNotification}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTable
              history={history}
              onClearHistory={onClearHistory}
              showNotification={showNotification}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleManager
              onSimulateAutoReroll={onSimulateAutoReroll}
              showNotification={showNotification}
            />
          )}
        </main>
      </div>
    </div>
  );
}


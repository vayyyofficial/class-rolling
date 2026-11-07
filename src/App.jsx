import React, { useState, useEffect } from 'react';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import Toast from './components/common/Toast';
import HomePage from './pages/HomePage';
import GroupRandomizerView from './components/groups/GroupRandomizerView';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

import { studentService } from './services/studentService';
import { layoutService } from './services/layoutService';
import { seatingService } from './services/seatingService';
import { authService } from './services/authService';

export default function App() {
  // Current view: 'public' | 'login' | 'admin'
  const [currentView, setCurrentView] = useState('public');
  // Public sub-tab: 'denah' | 'kelompok'
  const [publicActiveTab, setPublicActiveTab] = useState('denah');

  // Application Data State
  const [students, setStudents] = useState(() => studentService.getStudents());
  const [layout, setLayout] = useState(() => layoutService.getLayout());
  const [currentArrangement, setCurrentArrangement] = useState(() => {
    seatingService.checkAndRunScheduledReroll();
    return seatingService.getCurrentArrangement();
  });
  const [previousArrangement, setPreviousArrangement] = useState(() =>
    seatingService.getPreviousArrangement()
  );
  const [history, setHistory] = useState(() => seatingService.getHistory());
  const [currentUser, setCurrentUser] = useState(() =>
    authService.isAuthenticated() ? authService.getCurrentUser() : null
  );

  // Toast feedback state
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
  };

  // On mount: Fetch from Supabase and subscribe to Realtime updates
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch latest data from Supabase
    studentService.fetchStudents().then((data) => {
      if (isMounted && data) setStudents(data);
    });

    layoutService.fetchLayout().then((data) => {
      if (isMounted && data) setLayout(data);
    });

    seatingService.fetchActiveArrangement().then((data) => {
      if (isMounted && data) setCurrentArrangement(data);
    });

    seatingService.fetchHistory().then((data) => {
      if (isMounted && data) setHistory(data);
    });

    // 2. Realtime listener for seating changes
    const unsubSeating = seatingService.subscribeToSeatingChanges((updated) => {
      if (isMounted && updated) {
        setCurrentArrangement(updated);
        showNotification('Denah tempat duduk baru saja diperbarui!', 'info');
      }
    });

    // 3. Supabase Auth listener
    const unsubAuth = authService.onAuthStateChange((user) => {
      if (isMounted) {
        setCurrentUser(user);
      }
    });

    return () => {
      isMounted = false;
      unsubSeating();
      unsubAuth();
    };
  }, []);

  // Handle Navigation from Navbar
  const handlePublicNavigate = (tabId) => {
    setCurrentView('public');
    setPublicActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Authentication Handlers
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setCurrentView('admin');
    showNotification(`Selamat datang kembali, ${user.name}!`, 'success');
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setCurrentView('public');
    showNotification('Anda telah keluar dari sesi admin.', 'info');
  };

  // Student Actions
  const handleAddStudent = async (studentData) => {
    const newStudent = await studentService.addStudent(studentData);
    setStudents(studentService.getStudents());
    return newStudent;
  };

  const handleUpdateStudent = async (id, updates) => {
    await studentService.updateStudent(id, updates);
    setStudents(studentService.getStudents());
  };

  const handleDeleteStudent = async (id) => {
    await studentService.deleteStudent(id);
    setStudents(studentService.getStudents());
  };

  const handleToggleStudentActive = async (id) => {
    await studentService.toggleActive(id);
    setStudents(studentService.getStudents());
  };

  const handleResetStudents = () => {
    const fresh = studentService.resetToDefault();
    setStudents(fresh);
  };

  // Layout Actions
  const handleSaveLayout = (newLayout) => {
    layoutService.saveLayout(newLayout);
    setLayout(newLayout);
  };

  const handleResetLayout = () => {
    const fresh = layoutService.resetToDefault();
    setLayout(fresh);
  };

  // Seating / Reroll Actions
  // Note: Authorization is validated server-side via the session token stored in authService.
  // Never pass currentUser?.id as a proof of admin authorization to the server.
  const handleExecuteReroll = async (type = 'Manual', description = '') => {
    const newArrangement = await seatingService.executeRerollAsync(
      type,
      description
    );
    setCurrentArrangement(newArrangement);
    setPreviousArrangement(seatingService.getPreviousArrangement());
    const hist = await seatingService.fetchHistory();
    setHistory(hist);
  };

  const handleSimulateAutoReroll = () => {
    handleExecuteReroll('Otomatis', 'Simulasi Rotasi Otomatis Mingguan (Minggu 06:00 WIB)');
  };

  const handleClearHistory = () => {
    seatingService.clearHistory();
    setHistory([]);
  };

  // Guard while initial layout loads
  if (!layout) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <span className="text-xs font-semibold text-content-secondary">Memuat Class Rolling...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-content-primary">
      {/* Toast Notification Container */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />

      {/* VIEW: ADMIN LOGIN */}
      {currentView === 'login' && (
        <AdminLoginPage
          onLoginSuccess={handleLoginSuccess}
          onBackToPublic={() => setCurrentView('public')}
        />
      )}

      {/* VIEW: ADMIN DASHBOARD */}
      {currentView === 'admin' && (
        <AdminDashboardPage
          currentUser={currentUser}
          layout={layout}
          students={students}
          currentArrangement={currentArrangement}
          previousArrangement={previousArrangement}
          history={history}
          onSaveLayout={handleSaveLayout}
          onResetLayout={handleResetLayout}
          onAddStudent={handleAddStudent}
          onUpdateStudent={handleUpdateStudent}
          onDeleteStudent={handleDeleteStudent}
          onToggleStudentActive={handleToggleStudentActive}
          onResetStudents={handleResetStudents}
          onExecuteReroll={handleExecuteReroll}
          onClearHistory={handleClearHistory}
          onSimulateAutoReroll={handleSimulateAutoReroll}
          onGoToPublic={() => setCurrentView('public')}
          onLogout={handleLogout}
          showNotification={showNotification}
        />
      )}

      {/* VIEW: PUBLIC SITE (Main Navigation: Denah Tempat Duduk vs Group Randomizer) */}
      {currentView === 'public' && (
        <>
          <Navbar
            activeTab={publicActiveTab}
            onNavigate={handlePublicNavigate}
            isAuthenticated={Boolean(currentUser)}
            onOpenLogin={() => setCurrentView('login')}
            onOpenDashboard={() => setCurrentView('admin')}
          />

          <main className="flex-1">
            {publicActiveTab === 'denah' && (
              <HomePage
                layout={layout}
                students={students}
                currentArrangement={currentArrangement}
                onOpenAdminLogin={() =>
                  setCurrentView(currentUser ? 'admin' : 'login')
                }
                onOpenGroupRandomizer={() => setPublicActiveTab('kelompok')}
              />
            )}

            {publicActiveTab === 'kelompok' && (
              <GroupRandomizerView
                students={students}
                showNotification={showNotification}
              />
            )}
          </main>

          <Footer
            onOpenAdminLogin={() =>
              setCurrentView(currentUser ? 'admin' : 'login')
            }
          />
        </>
      )}
    </div>
  );
}

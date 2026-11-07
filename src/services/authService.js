import { storageService } from './storageService.js';

const ADMIN_PASSWORD = 'kajenter35_2026';
const SESSION_KEY = 'admin_session';

export const authService = {
  /**
   * Log in with fixed admin password.
   *
   * @param {string} password - Password entered by user
   * @returns {Promise<{success: boolean, message?: string, user?: object}>}
   */
  async login(password) {
    if (!password || !password.trim()) {
      return {
        success: false,
        message: 'Kata sandi administrator wajib diisi.',
      };
    }

    if (password.trim() === ADMIN_PASSWORD) {
      const session = {
        role: 'ADMIN',
        name: 'Administrator Kelas',
        key: ADMIN_PASSWORD,
        loginTime: new Date().toISOString(),
      };
      storageService.set(SESSION_KEY, session);
      return { success: true, user: session };
    }

    return {
      success: false,
      message: 'Kata sandi salah. Silakan coba lagi.',
    };
  },

  /**
   * Log out session.
   */
  async logout() {
    storageService.remove(SESSION_KEY);
  },

  /**
   * Retrieve active session.
   */
  getSession() {
    return storageService.get(SESSION_KEY, null);
  },

  /**
   * Retrieve active admin key for authenticated database RPCs.
   */
  getAdminKey() {
    const session = this.getSession();
    return session?.key === ADMIN_PASSWORD ? ADMIN_PASSWORD : null;
  },

  /**
   * Check if user is currently authenticated.
   */
  isAuthenticated() {
    const session = this.getSession();
    return Boolean(session && session.role === 'ADMIN' && session.key === ADMIN_PASSWORD);
  },

  /**
   * Get current user profile.
   */
  getCurrentUser() {
    const session = this.getSession();
    return session && session.role === 'ADMIN'
      ? {
          name: session.name || 'Administrator Kelas',
          role: session.role || 'ADMIN',
        }
      : null;
  },

  /**
   * Auth state listener compatibility.
   */
  onAuthStateChange(_callback) {
    return () => {};
  },
};

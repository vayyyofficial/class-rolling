/**
 * CLASS ROLLING - Password-Only Authentication Service
 * Server-side verified authentication with rate limiting and brute force protection.
 *
 * Passwords are NEVER hardcoded, logged, or verified on the client.
 * All verification, bcrypt hashing, and session tokens are managed server-side.
 */

import { supabase } from './supabase.js';
import { storageService } from './storageService.js';

const SESSION_KEY = 'admin_session';

export const authService = {
  /**
   * Log in with admin password only.
   * Calls server-side PostgreSQL function admin_verify_password.
   *
   * @param {string} password - Raw password entered by user
   * @returns {Promise<{success: boolean, message?: string, locked?: boolean, remainingAttempts?: number}>}
   */
  async login(password) {
    if (!password || !password.trim()) {
      return {
        success: false,
        message: 'Kata sandi wajib diisi.',
      };
    }

    try {
      const { data, error } = await supabase.rpc('admin_verify_password', {
        p_password: password.trim(),
      });

      if (error) {
        // If function not found in Supabase schema yet (e.g. migration pending)
        if (error.code === 'PGRST202' || error.message?.includes('admin_verify_password')) {
          return {
            success: false,
            message:
              'Sistem otentikasi kata sandi server belum aktif di database Supabase. Jalankan migrasi 20261107000000_password_auth.sql di Supabase SQL Editor.',
          };
        }

        console.error('[authService] Server verification error:', error.message);
        return {
          success: false,
          message: 'Terjadi kesalahan sistem saat memverifikasi kata sandi.',
        };
      }

      if (data?.success) {
        const session = {
          token: data.token,
          role: data.role || 'ADMIN',
          name: 'Administrator Kelas',
          expiresAt: data.expires_at,
          loginTime: new Date().toISOString(),
        };

        storageService.set(SESSION_KEY, session);
        return { success: true, user: session };
      }

      // Handle server-side lockout / failure
      return {
        success: false,
        locked: Boolean(data?.locked),
        remainingAttempts: data?.remaining_attempts,
        remainingSeconds: data?.remaining_seconds,
        message: data?.error || 'Kata sandi tidak valid.',
      };
    } catch (err) {
      console.error('[authService] Authentication exception:', err);
      return {
        success: false,
        message: 'Gagal terhubung ke server otentikasi. Periksa koneksi internet Anda.',
      };
    }
  },

  /**
   * Change admin password.
   * Requires valid active session token AND correct current password.
   *
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async changePassword(currentPassword, newPassword) {
    const session = this.getSession();
    if (!session || !session.token) {
      return {
        success: false,
        message: 'Sesi Anda telah kedaluwarsa. Silakan masuk kembali.',
      };
    }

    if (!currentPassword) {
      return {
        success: false,
        message: 'Kata sandi saat ini wajib diisi.',
      };
    }

    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        message: 'Kata sandi baru minimal harus 8 karakter.',
      };
    }

    if (currentPassword === newPassword) {
      return {
        success: false,
        message: 'Kata sandi baru tidak boleh sama dengan kata sandi saat ini.',
      };
    }

    try {
      const { data, error } = await supabase.rpc('admin_change_password', {
        p_token: session.token,
        p_current_password: currentPassword,
        p_new_password: newPassword,
      });

      if (error) {
        console.error('[authService] Password change error:', error.message);
        return {
          success: false,
          message: error.message || 'Gagal mengubah kata sandi.',
        };
      }

      if (data?.success) {
        // Update session with new token issued by server
        if (data.token) {
          const updatedSession = {
            ...session,
            token: data.token,
            expiresAt: data.expires_at,
          };
          storageService.set(SESSION_KEY, updatedSession);
        }

        return {
          success: true,
          message: data.message || 'Kata sandi berhasil diperbarui.',
        };
      }

      return {
        success: false,
        message: data?.error || 'Gagal mengubah kata sandi.',
      };
    } catch (err) {
      console.error('[authService] Password change exception:', err);
      return {
        success: false,
        message: 'Terjadi kesalahan sistem saat memperbarui kata sandi.',
      };
    }
  },

  /**
   * Log out session both locally and on the server.
   */
  async logout() {
    const session = this.getSession();
    if (session?.token) {
      try {
        await supabase.rpc('admin_logout', { p_token: session.token });
      } catch {
        // Ignore network failure on logout
      }
    }
    storageService.remove(SESSION_KEY);
  },

  /**
   * Retrieve active session
   */
  getSession() {
    return storageService.get(SESSION_KEY, null);
  },

  /**
   * Retrieve active session token
   */
  getSessionToken() {
    const session = this.getSession();
    return session?.token || null;
  },

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated() {
    const session = this.getSession();
    if (!session || !session.token) return false;

    // Check expiration timestamp if available
    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
      this.logout();
      return false;
    }

    return true;
  },

  /**
   * Validate current session with server
   */
  async verifySessionServer() {
    const session = this.getSession();
    if (!session || !session.token) return false;

    try {
      const { data, error } = await supabase.rpc('admin_verify_session', {
        p_token: session.token,
      });

      if (!error && data?.valid) {
        return true;
      }

      // If invalid on server, clear local session
      storageService.remove(SESSION_KEY);
      return false;
    } catch {
      // In offline / fallback mode, rely on local expiry check
      return this.isAuthenticated();
    }
  },

  /**
   * Get current user profile
   */
  getCurrentUser() {
    const session = this.getSession();
    return session
      ? {
          name: session.name || 'Administrator Kelas',
          role: session.role || 'ADMIN',
        }
      : null;
  },

  /**
   * Legacy auth state listener compatibility
   */
  onAuthStateChange(_callback) {
    return () => {};
  },
};

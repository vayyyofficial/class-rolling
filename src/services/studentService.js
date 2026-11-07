/**
 * CLASS ROLLING - Student Service
 *
 * All write operations (add, update, delete, toggle) REQUIRE an active admin session token
 * and are routed through the server-side admin_manage_student RPC, which validates the
 * session before executing any database change.
 *
 * Direct table writes are NEVER used as a fallback for write operations because:
 *  - They would bypass the server-side authorization check.
 *  - RLS policies on the students table must block unauthenticated writes.
 *
 * Read operations (SELECT) remain public because students and seating data
 * are intentionally public-facing.
 */

import { INITIAL_STUDENTS } from '../data/students.js';
import { storageService } from './storageService.js';
import { authService } from './authService.js';
import { supabase } from './supabase.js';

const STORAGE_KEY = 'students';

export const studentService = {
  /**
   * Synchronous / cached student list (read-only, public)
   */
  getStudents() {
    const saved = storageService.get(STORAGE_KEY, null);
    if (!saved || !Array.isArray(saved) || saved.length === 0) {
      storageService.set(STORAGE_KEY, INITIAL_STUDENTS);
      return [...INITIAL_STUDENTS];
    }
    return saved;
  },

  /**
   * Async fetch from Supabase with local caching (read-only, public)
   */
  async fetchStudents() {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('number', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped = data.map((s) => ({
          id: s.id,
          number: s.number,
          fullName: s.full_name,
          nickname: s.nickname,
          isActive: s.is_active,
          createdAt: s.created_at,
        }));
        storageService.set(STORAGE_KEY, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[studentService] Supabase fetch error, using local data:', err);
    }
    return this.getStudents();
  },

  getActiveStudents() {
    return this.getStudents().filter((s) => s.isActive);
  },

  getStudentById(id) {
    return this.getStudents().find((s) => s.id === id) || null;
  },

  saveStudents(students) {
    return storageService.set(STORAGE_KEY, students);
  },

  /**
   * Add student — requires a valid admin session token.
   * Routed exclusively through admin_manage_student RPC.
   * Falls back to local-only storage if Supabase is unavailable,
   * but will NOT attempt a direct unauthenticated insert.
   */
  async addStudent({ fullName, nickname, isActive = true }) {
    const students = this.getStudents();
    const token = authService.getSessionToken();

    if (!token) {
      return { error: 'Sesi administrator tidak aktif. Silakan login kembali.' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_manage_student', {
        p_session_token: token,
        p_action: 'add',
        p_student_id: null,
        p_payload: { fullName, nickname, isActive },
      });

      if (error) {
        console.warn('[studentService] RPC add error:', error.message);
        return { error: error.message || 'Gagal menambahkan siswa ke server.' };
      }

      if (data?.success && data.student) {
        const updated = [...students, data.student];
        this.saveStudents(updated);
        return data.student;
      }

      return { error: data?.error || 'Server menolak penambahan siswa.' };
    } catch (err) {
      console.warn('[studentService] RPC add exception:', err);
      return { error: 'Gagal terhubung ke server. Periksa koneksi internet Anda.' };
    }
  },

  /**
   * Update student — requires a valid admin session token.
   * Routed exclusively through admin_manage_student RPC.
   */
  async updateStudent(id, updates) {
    const students = this.getStudents();
    const index = students.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const token = authService.getSessionToken();

    if (!token) {
      return { error: 'Sesi administrator tidak aktif. Silakan login kembali.' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_manage_student', {
        p_session_token: token,
        p_action: 'update',
        p_student_id: id,
        p_payload: updates,
      });

      if (error) {
        console.warn('[studentService] RPC update error:', error.message);
        return { error: error.message || 'Gagal memperbarui data siswa.' };
      }

      if (!data?.success) {
        return { error: data?.error || 'Server menolak pembaruan data siswa.' };
      }
    } catch (err) {
      console.warn('[studentService] RPC update exception:', err);
      return { error: 'Gagal terhubung ke server.' };
    }

    // Update local cache to reflect committed change
    students[index] = {
      ...students[index],
      ...updates,
      fullName: updates.fullName !== undefined ? updates.fullName.trim() : students[index].fullName,
      nickname: updates.nickname !== undefined ? updates.nickname.trim() : students[index].nickname,
      updatedAt: new Date().toISOString(),
    };

    this.saveStudents(students);
    return students[index];
  },

  /**
   * Toggle active status — requires a valid admin session token.
   */
  async toggleActive(id) {
    const students = this.getStudents();
    const student = students.find((s) => s.id === id);
    if (!student) return null;

    const token = authService.getSessionToken();

    if (!token) {
      return { error: 'Sesi administrator tidak aktif. Silakan login kembali.' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_manage_student', {
        p_session_token: token,
        p_action: 'toggle_active',
        p_student_id: id,
        p_payload: {},
      });

      if (error) {
        console.warn('[studentService] RPC toggle error:', error.message);
        return { error: error.message || 'Gagal mengubah status siswa.' };
      }

      if (!data?.success) {
        return { error: data?.error || 'Server menolak perubahan status siswa.' };
      }

      // Reflect confirmed server-side change in local cache
      const newStatus = data.isActive ?? !student.isActive;
      student.isActive = newStatus;
      this.saveStudents(students);
      return student;
    } catch (err) {
      console.warn('[studentService] RPC toggle exception:', err);
      return { error: 'Gagal terhubung ke server.' };
    }
  },

  /**
   * Delete student — requires a valid admin session token.
   * Note: Soft-deactivation (toggle_active) is preferred over hard deletion
   * to preserve historical seating and group records.
   */
  async deleteStudent(id) {
    const token = authService.getSessionToken();

    if (!token) {
      return { error: 'Sesi administrator tidak aktif. Silakan login kembali.' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_manage_student', {
        p_session_token: token,
        p_action: 'delete',
        p_student_id: id,
        p_payload: {},
      });

      if (error) {
        console.warn('[studentService] RPC delete error:', error.message);
        return { error: error.message || 'Gagal menghapus data siswa.' };
      }

      if (!data?.success) {
        return { error: data?.error || 'Server menolak penghapusan siswa.' };
      }
    } catch (err) {
      console.warn('[studentService] RPC delete exception:', err);
      return { error: 'Gagal terhubung ke server.' };
    }

    const students = this.getStudents();
    const filtered = students.filter((s) => s.id !== id);
    this.saveStudents(filtered);
    return true;
  },

  resetToDefault() {
    storageService.set(STORAGE_KEY, INITIAL_STUDENTS);
    return [...INITIAL_STUDENTS];
  },
};

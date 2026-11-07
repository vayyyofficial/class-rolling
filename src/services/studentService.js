/**
 * CLASS ROLLING - Student Service
 *
 * Student data is publicly viewable.
 * Mutations (add, update, delete, toggle) require administrator authorization.
 */

import { INITIAL_STUDENTS } from '../data/students.js';
import { storageService } from './storageService.js';
import { authService } from './authService.js';
import { supabase, isSupabaseConfigured } from './supabase.js';

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
    if (!isSupabaseConfigured) {
      return this.getStudents();
    }

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
   * Add student — requires admin access.
   */
  async addStudent({ fullName, nickname, isActive = true }) {
    if (!authService.isAuthenticated()) {
      return { error: 'Sesi administrator tidak aktif. Silakan login kembali.' };
    }

    const adminKey = authService.getAdminKey();
    if (!adminKey) {
      return { error: 'Otorisasi administrator tidak valid. Silakan login kembali.' };
    }

    const cleanFullName = (fullName || '').trim();
    const cleanNickname = (nickname || '').trim();

    if (!cleanFullName) return { error: 'Nama lengkap wajib diisi.' };
    if (!cleanNickname) return { error: 'Nama panggilan wajib diisi.' };

    const students = this.getStudents();
    const nextNumber =
      students.length > 0
        ? Math.max(...students.map((s) => s.number || 0)) + 1
        : 1;

    let newStudent = {
      id: `stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      number: nextNumber,
      fullName: cleanFullName,
      nickname: cleanNickname,
      isActive: Boolean(isActive),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('admin_manage_student', {
          p_admin_password: adminKey,
          p_action: 'add',
          p_student_id: null,
          p_payload: { fullName: cleanFullName, nickname: cleanNickname, isActive: Boolean(isActive) },
        });

        if (!error && data?.success && data.student) {
          newStudent = data.student;
        } else if (error) {
          console.warn('[studentService] admin_manage_student error, saving locally:', error.message);
        }
      } catch (err) {
        console.warn('[studentService] admin_manage_student exception, saving locally:', err);
      }
    }

    const updated = [...students, newStudent];
    this.saveStudents(updated);
    return newStudent;
  },

  /**
   * Update student — requires admin access.
   */
  async updateStudent(id, updates) {
    if (!authService.isAuthenticated()) {
      return { error: 'Sesi administrator tidak aktif. Silakan login kembali.' };
    }

    const adminKey = authService.getAdminKey();
    if (!adminKey) {
      return { error: 'Otorisasi administrator tidak valid. Silakan login kembali.' };
    }

    const students = this.getStudents();
    const index = students.findIndex((s) => s.id === id);
    if (index === -1) return { error: 'Siswa tidak ditemukan.' };

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('admin_manage_student', {
          p_admin_password: adminKey,
          p_action: 'update',
          p_student_id: id,
          p_payload: updates,
        });

        if (error) {
          console.warn('[studentService] admin_manage_student update error:', error.message);
        }
      } catch (err) {
        console.warn('[studentService] admin_manage_student update exception:', err);
      }
    }

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
   * Toggle active status — requires admin access.
   */
  async toggleActive(id) {
    if (!authService.isAuthenticated()) {
      return { error: 'Sesi administrator tidak aktif. Silakan login kembali.' };
    }

    const adminKey = authService.getAdminKey();
    if (!adminKey) {
      return { error: 'Otorisasi administrator tidak valid. Silakan login kembali.' };
    }

    const students = this.getStudents();
    const student = students.find((s) => s.id === id);
    if (!student) return { error: 'Siswa tidak ditemukan.' };

    const newStatus = !student.isActive;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('admin_manage_student', {
          p_admin_password: adminKey,
          p_action: 'toggle_active',
          p_student_id: id,
          p_payload: {},
        });

        if (error) {
          console.warn('[studentService] admin_manage_student toggle error:', error.message);
        }
      } catch (err) {
        console.warn('[studentService] admin_manage_student toggle exception:', err);
      }
    }

    student.isActive = newStatus;
    this.saveStudents(students);
    return student;
  },

  /**
   * Delete student — requires admin access.
   */
  async deleteStudent(id) {
    if (!authService.isAuthenticated()) {
      return { error: 'Sesi administrator tidak aktif. Silakan login kembali.' };
    }

    const adminKey = authService.getAdminKey();
    if (!adminKey) {
      return { error: 'Otorisasi administrator tidak valid. Silakan login kembali.' };
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('admin_manage_student', {
          p_admin_password: adminKey,
          p_action: 'delete',
          p_student_id: id,
          p_payload: {},
        });

        if (error) {
          console.warn('[studentService] admin_manage_student delete error:', error.message);
        }
      } catch (err) {
        console.warn('[studentService] admin_manage_student delete exception:', err);
      }
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

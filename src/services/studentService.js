import { INITIAL_STUDENTS } from '../data/students';
import { storageService } from './storageService';
import { authService } from './authService';
import { supabase } from './supabase';

const STORAGE_KEY = 'students';

export const studentService = {
  /**
   * Synchronous / cached student list
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
   * Async fetch from Supabase with local caching
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

  async addStudent({ fullName, nickname, isActive = true }) {
    const students = this.getStudents();
    const token = authService.getSessionToken();

    // 1. Try secure admin_manage_student RPC
    if (token) {
      try {
        const { data, error } = await supabase.rpc('admin_manage_student', {
          p_session_token: token,
          p_action: 'add',
          p_student_id: null,
          p_payload: { fullName, nickname, isActive },
        });

        if (!error && data?.success && data.student) {
          const updated = [...students, data.student];
          this.saveStudents(updated);
          return data.student;
        }
      } catch (err) {
        console.warn('[studentService] RPC add failed, falling back:', err);
      }
    }

    // 2. Direct Supabase insert fallback
    const nextNumber = students.length > 0 ? Math.max(...students.map((s) => s.number || 0)) + 1 : 1;
    try {
      const { data, error } = await supabase
        .from('students')
        .insert({
          number: nextNumber,
          full_name: fullName.trim(),
          nickname: nickname.trim(),
          is_active: Boolean(isActive),
        })
        .select()
        .single();

      if (!error && data) {
        const newStudent = {
          id: data.id,
          number: data.number,
          fullName: data.full_name,
          nickname: data.nickname,
          isActive: data.is_active,
          createdAt: data.created_at,
        };
        const updated = [...students, newStudent];
        this.saveStudents(updated);
        return newStudent;
      }
    } catch (err) {
      console.warn('[studentService] Supabase insert failed, storing locally:', err);
    }

    // 3. Local fallback
    const newStudent = {
      id: `std-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      number: nextNumber,
      fullName: fullName.trim(),
      nickname: nickname.trim(),
      isActive: Boolean(isActive),
      createdAt: new Date().toISOString(),
    };
    const updated = [...students, newStudent];
    this.saveStudents(updated);
    return newStudent;
  },

  async updateStudent(id, updates) {
    const students = this.getStudents();
    const index = students.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const token = authService.getSessionToken();

    // 1. Try secure admin_manage_student RPC
    if (token) {
      try {
        const { data, error } = await supabase.rpc('admin_manage_student', {
          p_session_token: token,
          p_action: 'update',
          p_student_id: id,
          p_payload: updates,
        });

        if (!error && data?.success) {
          // Success on server
        }
      } catch (err) {
        console.warn('[studentService] RPC update failed:', err);
      }
    } else {
      // 2. Direct Supabase update fallback
      try {
        const dbUpdates = {};
        if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName.trim();
        if (updates.nickname !== undefined) dbUpdates.nickname = updates.nickname.trim();
        if (updates.isActive !== undefined) dbUpdates.is_active = Boolean(updates.isActive);

        await supabase.from('students').update(dbUpdates).eq('id', id);
      } catch (err) {
        console.warn('[studentService] Supabase update failed:', err);
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

  async toggleActive(id) {
    const students = this.getStudents();
    const student = students.find((s) => s.id === id);
    if (!student) return null;
    const newStatus = !student.isActive;

    const token = authService.getSessionToken();

    // 1. Try secure admin_manage_student RPC
    if (token) {
      try {
        await supabase.rpc('admin_manage_student', {
          p_session_token: token,
          p_action: 'toggle_active',
          p_student_id: id,
          p_payload: {},
        });
      } catch (err) {
        console.warn('[studentService] RPC toggle failed:', err);
      }
    } else {
      try {
        await supabase.from('students').update({ is_active: newStatus }).eq('id', id);
      } catch (err) {
        console.warn('[studentService] Supabase toggleActive failed:', err);
      }
    }

    student.isActive = newStatus;
    this.saveStudents(students);
    return student;
  },

  async deleteStudent(id) {
    const token = authService.getSessionToken();

    if (token) {
      try {
        await supabase.rpc('admin_manage_student', {
          p_session_token: token,
          p_action: 'delete',
          p_student_id: id,
          p_payload: {},
        });
      } catch (err) {
        console.warn('[studentService] RPC delete failed:', err);
      }
    } else {
      try {
        await supabase.from('students').delete().eq('id', id);
      } catch (err) {
        console.warn('[studentService] Supabase delete failed:', err);
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

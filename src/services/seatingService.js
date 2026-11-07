/**
 * CLASS ROLLING - Seating Arrangement & Reroll Service
 *
 * Seating assignments and history are publicly viewable by students.
 * Admin actions (manual reroll) require admin authentication via the website.
 *
 * Weekly automatic rerolls are executed server-side via pg_cron (Sundays at 06:00 WIB).
 * The browser NEVER triggers automated rerolls on cycle transition.
 */

import { storageService } from './storageService.js';
import { layoutService } from './layoutService.js';
import { studentService } from './studentService.js';
import { authService } from './authService.js';
import { generateSeatingArrangement } from '../utils/randomizer.js';
import { getWeeklyCycleId } from '../utils/scheduler.js';
import { formatWIBDateTime } from '../utils/timezone.js';
import { supabase, isSupabaseConfigured } from './supabase.js';

const STORAGE_KEYS = {
  CURRENT_ARRANGEMENT: 'seating_current',
  HISTORY: 'seating_history',
  LAST_CYCLE_ID: 'seating_last_cycle_id',
  PREVIOUS_ARRANGEMENT: 'seating_previous',
};

export const seatingService = {
  /**
   * Returns the cached active seating arrangement for immediate rendering.
   * If cache is empty, provides a clean initial layout without faking database records.
   */
  getCurrentArrangement() {
    const arrangement = storageService.get(STORAGE_KEYS.CURRENT_ARRANGEMENT, null);

    if (arrangement && arrangement.assignments) {
      return arrangement;
    }

    // Clean initial fallback state for immediate offline/cold-start UI display
    const layout = layoutService.getLayout();
    const students = studentService.getStudents();
    const activeStudents = (students || []).filter((s) => s.isActive);
    const { assignments, emptySeatIds, timestamp } = generateSeatingArrangement(layout, students);
    const currentCycleId = getWeeklyCycleId();

    const fallbackArrangement = {
      assignments,
      emptySeatIds,
      updatedAt: timestamp,
      type: 'Inisialisasi',
      cycleId: currentCycleId,
      activeStudentCount: activeStudents.length,
    };

    storageService.set(STORAGE_KEYS.CURRENT_ARRANGEMENT, fallbackArrangement);
    return fallbackArrangement;
  },

  /**
   * Fetch active arrangement from Supabase get_active_seating RPC.
   * Updates local cache upon successful fetch.
   */
  async fetchActiveArrangement() {
    if (!isSupabaseConfigured) {
      return this.getCurrentArrangement();
    }

    try {
      const { data, error } = await supabase.rpc('get_active_seating');

      if (!error && data && data.active && data.assignments) {
        const arrangement = {
          assignments: data.assignments,
          emptySeatIds: data.empty_seat_ids || [],
          updatedAt: data.created_at,
          type:
            data.roll_type === 'automatic'
              ? 'Otomatis'
              : data.roll_type === 'manual'
              ? 'Manual'
              : 'Inisialisasi',
          cycleId: data.cycle_id,
          activeStudentCount: Object.keys(data.assignments).length,
        };
        storageService.set(STORAGE_KEYS.CURRENT_ARRANGEMENT, arrangement);
        return arrangement;
      }
    } catch (err) {
      console.warn('[seatingService] get_active_seating error, using cached data:', err);
    }

    return this.getCurrentArrangement();
  },

  /**
   * Returns previous arrangement for visual comparison.
   */
  getPreviousArrangement() {
    return storageService.get(STORAGE_KEYS.PREVIOUS_ARRANGEMENT, null);
  },

  /**
   * Passive cycle check on client-side:
   * Detects weekly cycle transition and refreshes active arrangement from the server.
   */
  async checkAndRunScheduledReroll() {
    const currentCycleId = getWeeklyCycleId();
    const lastCycleId = storageService.get(STORAGE_KEYS.LAST_CYCLE_ID, null);

    if (lastCycleId && lastCycleId !== currentCycleId) {
      storageService.set(STORAGE_KEYS.LAST_CYCLE_ID, currentCycleId);
      return await this.fetchActiveArrangement();
    }

    if (!lastCycleId) {
      storageService.set(STORAGE_KEYS.LAST_CYCLE_ID, currentCycleId);
    }

    return null;
  },

  /**
   * Generates a local seating arrangement and saves to cache/history.
   */
  executeLocalReroll(dbType = 'manual', description = '') {
    const layout = layoutService.getLayout();
    const students = studentService.getStudents();
    const activeStudents = (students || []).filter((s) => s.isActive);
    const { assignments, emptySeatIds, timestamp } = generateSeatingArrangement(layout, students);
    const currentCycleId = getWeeklyCycleId();

    const previous = this.getCurrentArrangement();
    if (previous) {
      storageService.set(STORAGE_KEYS.PREVIOUS_ARRANGEMENT, previous);
    }

    const newArrangement = {
      assignments,
      emptySeatIds,
      updatedAt: timestamp,
      type: dbType === 'automatic' ? 'Otomatis' : 'Manual',
      cycleId: currentCycleId,
      activeStudentCount: activeStudents.length,
    };

    storageService.set(STORAGE_KEYS.CURRENT_ARRANGEMENT, newArrangement);

    const historyItem = {
      id: `local-${Date.now()}`,
      timestamp,
      wibFormatted: formatWIBDateTime(timestamp),
      type: dbType === 'automatic' ? 'Otomatis' : 'Manual',
      description: description || (dbType === 'automatic' ? 'Rotasi Otomatis' : 'Pengacakan Manual oleh Admin'),
      activeStudentCount: activeStudents.length,
      cycleId: currentCycleId,
    };

    const existingHistory = this.getHistory();
    storageService.set(STORAGE_KEYS.HISTORY, [historyItem, ...existingHistory]);

    return newArrangement;
  },

  /**
   * Execute seating reroll on the database or locally if offline.
   *
   * @param {string} type - 'Manual' | 'Otomatis' (simulation) | 'Inisialisasi'
   * @param {string} description - Log description
   * @returns {Promise<Object>} Updated arrangement or { error: string }
   */
  async executeRerollAsync(type = 'Manual', description = '') {
    if (!authService.isAuthenticated()) {
      return {
        error: 'Sesi administrator tidak aktif. Silakan masuk kembali.',
      };
    }

    const dbType =
      type === 'Otomatis'
        ? 'automatic'
        : type === 'Inisialisasi'
        ? 'initial'
        : 'manual';

    const desc =
      description ||
      (dbType === 'manual'
        ? 'Pengacakan Manual oleh Admin'
        : 'Pengacakan Otomatis Mingguan');

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('execute_seating_reroll', {
          p_roll_type: dbType,
          p_description: desc,
        });

        if (!error && data?.success) {
          const latest = await this.fetchActiveArrangement();
          return latest;
        }

        if (error) {
          console.warn('[seatingService] execute_seating_reroll RPC error, using local fallback:', error.message);
        }
      } catch (err) {
        console.warn('[seatingService] execute_seating_reroll exception, using local fallback:', err);
      }
    }

    return this.executeLocalReroll(dbType, desc);
  },

  /**
   * Get activity history from local cache
   */
  getHistory() {
    return storageService.get(STORAGE_KEYS.HISTORY, []);
  },

  /**
   * Async fetch history from Supabase reroll_history table with local fallback
   */
  async fetchHistory() {
    if (!isSupabaseConfigured) {
      return this.getHistory();
    }

    try {
      const { data, error } = await supabase
        .from('reroll_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        const mapped = data.map((h) => ({
          id: h.id,
          timestamp: h.created_at,
          wibFormatted: formatWIBDateTime(h.created_at),
          type:
            h.roll_type === 'automatic'
              ? 'Otomatis'
              : h.roll_type === 'manual'
              ? 'Manual'
              : 'Inisialisasi',
          description: h.description,
          activeStudentCount: h.active_student_count,
          cycleId: h.cycle_id,
        }));
        storageService.set(STORAGE_KEYS.HISTORY, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[seatingService] Supabase fetch history error:', err);
    }
    return this.getHistory();
  },

  clearHistory() {
    storageService.set(STORAGE_KEYS.HISTORY, []);
    return true;
  },

  /**
   * Supabase Realtime listener for live seating updates across student devices
   */
  subscribeToSeatingChanges(onUpdate) {
    if (!isSupabaseConfigured) {
      return () => {};
    }

    try {
      const channel = supabase
        .channel('public:seating_periods')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'seating_periods' },
          async () => {
            const latest = await this.fetchActiveArrangement();
            if (latest && onUpdate) onUpdate(latest);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  },
};

import { storageService } from './storageService';
import { layoutService } from './layoutService';
import { studentService } from './studentService';
import { generateSeatingArrangement } from '../utils/randomizer';
import { getWeeklyCycleId } from '../utils/scheduler';
import { formatWIBDateTime } from '../utils/timezone';
import { supabase } from './supabase';

const STORAGE_KEYS = {
  CURRENT_ARRANGEMENT: 'seating_current',
  HISTORY: 'seating_history',
  LAST_CYCLE_ID: 'seating_last_cycle_id',
  PREVIOUS_ARRANGEMENT: 'seating_previous',
};

export const seatingService = {
  /**
   * Returns the active seating arrangement.
   * If not found, initializes an arrangement automatically.
   */
  getCurrentArrangement() {
    let arrangement = storageService.get(STORAGE_KEYS.CURRENT_ARRANGEMENT, null);

    if (!arrangement || !arrangement.assignments) {
      arrangement = this.executeReroll('Inisialisasi', 'Inisialisasi Pengacakan Awal Sistem');
    }

    return arrangement;
  },

  /**
   * Async fetch active arrangement from Supabase with local fallback
   */
  async fetchActiveArrangement() {
    try {
      const { data, error } = await supabase.rpc('get_active_seating');
      if (!error && data && data.active && data.assignments) {
        const arrangement = {
          assignments: data.assignments,
          emptySeatIds: data.empty_seat_ids || [],
          updatedAt: data.created_at,
          type: data.roll_type === 'automatic' ? 'Otomatis' : data.roll_type === 'manual' ? 'Manual' : 'Inisialisasi',
          cycleId: data.cycle_id,
          activeStudentCount: Object.keys(data.assignments).length,
        };
        storageService.set(STORAGE_KEYS.CURRENT_ARRANGEMENT, arrangement);
        return arrangement;
      }
    } catch (err) {
      console.warn('[seatingService] Supabase get_active_seating error, using local:', err);
    }

    return this.getCurrentArrangement();
  },

  /**
   * Returns previous arrangement for comparison
   */
  getPreviousArrangement() {
    return storageService.get(STORAGE_KEYS.PREVIOUS_ARRANGEMENT, null);
  },

  /**
   * Checks whether the current weekly cycle has had an automatic reroll.
   */
  checkAndRunScheduledReroll() {
    const currentCycleId = getWeeklyCycleId();
    const lastCycleId = storageService.get(STORAGE_KEYS.LAST_CYCLE_ID, null);

    if (lastCycleId && lastCycleId !== currentCycleId) {
      console.log(`[Scheduler] Cycle transition detected (${lastCycleId} -> ${currentCycleId}). Executing scheduled weekly reroll.`);
      return this.executeReroll('Otomatis', 'Rotasi Otomatis Mingguan (Jadwal Minggu 06:00 WIB)');
    }

    if (!lastCycleId) {
      storageService.set(STORAGE_KEYS.LAST_CYCLE_ID, currentCycleId);
    }

    return null;
  },

  /**
   * Execute seating reroll (manual or automatic).
   * NOTE: Manual reroll NEVER cancels or postpones the upcoming Sunday 06:00 WIB automatic roll!
   */
  async executeRerollAsync(type = 'Manual', description = '', adminId = null) {
    // Try Supabase RPC first
    try {
      const dbType = type === 'Otomatis' ? 'automatic' : type === 'Inisialisasi' ? 'initial' : 'manual';
      const { data, error } = await supabase.rpc('execute_seating_reroll', {
        p_roll_type: dbType,
        p_description: description || (type === 'Manual' ? 'Pengacakan Manual oleh Admin' : 'Pengacakan Otomatis Mingguan'),
        p_admin_id: adminId,
      });

      if (!error && data?.success) {
        const fetched = await this.fetchActiveArrangement();
        return fetched;
      }
    } catch (err) {
      console.warn('[seatingService] Supabase RPC failed, running local reroll:', err);
    }

    // Fallback to local execution
    return this.executeReroll(type, description);
  },

  /**
   * Synchronous / local fallback reroll execution
   */
  executeReroll(type = 'Manual', description = '') {
    const layout = layoutService.getLayout();
    const students = studentService.getStudents();
    const activeStudents = students.filter((s) => s.isActive);

    const existing = storageService.get(STORAGE_KEYS.CURRENT_ARRANGEMENT, null);
    if (existing) {
      storageService.set(STORAGE_KEYS.PREVIOUS_ARRANGEMENT, existing);
    }

    const { assignments, emptySeatIds, timestamp } = generateSeatingArrangement(layout, students);
    const currentCycleId = getWeeklyCycleId();

    const arrangement = {
      assignments,
      emptySeatIds,
      updatedAt: timestamp,
      type,
      cycleId: currentCycleId,
      activeStudentCount: activeStudents.length,
    };

    storageService.set(STORAGE_KEYS.CURRENT_ARRANGEMENT, arrangement);
    storageService.set(STORAGE_KEYS.LAST_CYCLE_ID, currentCycleId);

    this.addHistoryLog({
      type,
      description: description || (type === 'Manual' ? 'Pengacakan Manual oleh Admin' : 'Pengacakan Otomatis Mingguan'),
      activeStudentCount: activeStudents.length,
      cycleId: currentCycleId,
      timestamp,
    });

    return arrangement;
  },

  /**
   * Get activity history
   */
  getHistory() {
    return storageService.get(STORAGE_KEYS.HISTORY, []);
  },

  /**
   * Async fetch history from Supabase with local fallback
   */
  async fetchHistory() {
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
          type: h.roll_type === 'automatic' ? 'Otomatis' : h.roll_type === 'manual' ? 'Manual' : 'Inisialisasi',
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

  /**
   * Add a log entry
   */
  addHistoryLog(entry) {
    const history = this.getHistory();
    const logItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      wibFormatted: formatWIBDateTime(entry.timestamp || new Date()),
      type: entry.type || 'Manual',
      description: entry.description || 'Pengacakan tempat duduk',
      activeStudentCount: entry.activeStudentCount || 0,
      cycleId: entry.cycleId || getWeeklyCycleId(),
    };

    const updated = [logItem, ...history].slice(0, 50);
    storageService.set(STORAGE_KEYS.HISTORY, updated);
    return logItem;
  },

  clearHistory() {
    storageService.set(STORAGE_KEYS.HISTORY, []);
    return true;
  },

  /**
   * Supabase Realtime listener for live seating updates
   */
  subscribeToSeatingChanges(onUpdate) {
    try {
      const channel = supabase
        .channel('public:seating_periods')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'seating_periods' },
          async () => {
            const latest = await seatingService.fetchActiveArrangement();
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

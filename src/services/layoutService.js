import { DEFAULT_LAYOUT } from '../data/defaultLayout';
import { storageService } from './storageService';
import { authService } from './authService';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'layout';

export const layoutService = {
  getLayout() {
    const saved = storageService.get(STORAGE_KEY, null);
    if (!saved || !saved.blocks || !Array.isArray(saved.blocks)) {
      storageService.set(STORAGE_KEY, DEFAULT_LAYOUT);
      return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    }
    return saved;
  },

  async fetchLayout() {
    if (!isSupabaseConfigured) {
      return this.getLayout();
    }

    try {
      const { data: layoutData, error: lErr } = await supabase
        .from('classroom_layouts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: seatData, error: sErr } = await supabase
        .from('seats')
        .select('*')
        .order('seat_code', { ascending: true });

      if (!lErr && !sErr && layoutData && seatData && seatData.length > 0) {
        const blocksMap = {
          'block-left': { id: 'block-left', name: 'Blok Kiri', cols: 2, rows: 5, seats: [] },
          'block-middle': { id: 'block-middle', name: 'Blok Tengah', cols: 2, rows: 5, seats: [] },
          'block-right': { id: 'block-right', name: 'Blok Kanan', cols: 2, rows: 4, seats: [] },
        };

        seatData.forEach((s) => {
          const bId = s.block_id || 'block-left';
          if (!blocksMap[bId]) {
            blocksMap[bId] = {
              id: bId,
              name: s.block_name || bId,
              cols: 2,
              rows: 1,
              seats: [],
            };
          }

          blocksMap[bId].seats.push({
            id: s.id,
            code: s.seat_code,
            row: s.row_index,
            col: s.col_index,
            isAvailable: s.is_available,
            defaultEmpty: s.default_empty,
          });

          if (s.row_index + 1 > blocksMap[bId].rows) blocksMap[bId].rows = s.row_index + 1;
          if (s.col_index + 1 > blocksMap[bId].cols) blocksMap[bId].cols = s.col_index + 1;
        });

        const formatted = {
          id: layoutData.id,
          name: layoutData.name,
          teacherDesk: {
            label: layoutData.teacher_desk_label || 'Meja Guru',
            position: layoutData.teacher_desk_position || 'center',
          },
          blocks: Object.values(blocksMap),
        };

        storageService.set(STORAGE_KEY, formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[layoutService] Supabase fetchLayout error:', err);
    }

    return this.getLayout();
  },

  async saveLayout(layout) {
    if (!authService.isAuthenticated()) {
      return {
        error: 'Sesi administrator tidak aktif. Silakan masuk kembali.',
      };
    }

    if (isSupabaseConfigured && layout.id) {
      try {
        await supabase
          .from('classroom_layouts')
          .update({
            name: layout.name,
            teacher_desk_position: layout.teacherDesk?.position || 'center',
            teacher_desk_label: layout.teacherDesk?.label || 'Meja Guru',
            updated_at: new Date().toISOString(),
          })
          .eq('id', layout.id);
      } catch (err) {
        console.warn('[layoutService] Supabase saveLayout error, saving locally:', err);
      }
    }

    storageService.set(STORAGE_KEY, layout);
    return { success: true };
  },

  resetToDefault() {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    storageService.set(STORAGE_KEY, fresh);
    return fresh;
  },

  getSeatStats(layout) {
    let total = 0;
    let available = 0;
    (layout.blocks || []).forEach((b) => {
      (b.seats || []).forEach((s) => {
        total++;
        if (s.isAvailable !== false) available++;
      });
    });
    return { total, available };
  },

  generateSeatCode(layout) {
    let max = 0;
    (layout.blocks || []).forEach((b) => {
      (b.seats || []).forEach((s) => {
        const num = parseInt(s.code, 10);
        if (!isNaN(num) && num > max) max = num;
      });
    });
    return String(max + 1).padStart(2, '0');
  },
};

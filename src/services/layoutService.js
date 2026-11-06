/**
 * SEATFLOW - Layout Service
 * Manages classroom layout structure, blocks, seats, and desk configuration.
 */

import { DEFAULT_LAYOUT } from '../data/defaultLayout';
import { storageService } from './storageService';

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

  saveLayout(layout) {
    return storageService.set(STORAGE_KEY, layout);
  },

  resetToDefault() {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    storageService.set(STORAGE_KEY, fresh);
    return fresh;
  },

  /**
   * Helper to recalculate total and available seats count
   */
  getSeatStats(layout) {
    let total = 0;
    let available = 0;
    (layout.blocks || []).forEach((b) => {
      (b.seats || []).forEach((s) => {
        total++;
        if (s.isAvailable) available++;
      });
    });
    return { total, available };
  },

  /**
   * Helper to generate a new sequential seat code if needed
   */
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


/**
 * RUANGKELAS - Storage Service
 * Abstraction layer for browser localStorage with memory fallback and error protection.
 */

const STORAGE_PREFIX = 'ruangkelas_v1_';
const LEGACY_PREFIX = 'seatflow_v1_';

class MemoryStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

let backendStorage;
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    backendStorage = window.localStorage;
  } else {
    backendStorage = new MemoryStorage();
  }
} catch {
  backendStorage = new MemoryStorage();
}

export const storageService = {
  get(key, defaultValue = null) {
    try {
      let serialized = backendStorage.getItem(STORAGE_PREFIX + key);

      // Seamless migration from legacy seatflow prefix if not found
      if (serialized === null || serialized === undefined) {
        const legacy = backendStorage.getItem(LEGACY_PREFIX + key);
        if (legacy !== null && legacy !== undefined) {
          backendStorage.setItem(STORAGE_PREFIX + key, legacy);
          serialized = legacy;
        }
      }

      if (serialized === null || serialized === undefined) {
        return defaultValue;
      }
      return JSON.parse(serialized);
    } catch (err) {
      console.warn(`[storageService] Error reading key "${key}":`, err);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      backendStorage.setItem(STORAGE_PREFIX + key, serialized);
      return true;
    } catch (err) {
      console.error(`[storageService] Error writing key "${key}":`, err);
      return false;
    }
  },

  remove(key) {
    try {
      backendStorage.removeItem(STORAGE_PREFIX + key);
      backendStorage.removeItem(LEGACY_PREFIX + key);
      return true;
    } catch (err) {
      console.error(`[storageService] Error removing key "${key}":`, err);
      return false;
    }
  },

  clear() {
    try {
      if (backendStorage === window.localStorage) {
        Object.keys(window.localStorage).forEach((k) => {
          if (k.startsWith(STORAGE_PREFIX) || k.startsWith(LEGACY_PREFIX)) {
            window.localStorage.removeItem(k);
          }
        });
      } else {
        backendStorage.clear();
      }
      return true;
    } catch (err) {
      console.error('[storageService] Error clearing storage:', err);
      return false;
    }
  },
};

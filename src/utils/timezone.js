/**
 * Timezone utilities for WIB (Waktu Indonesia Barat / UTC+7 / Asia/Jakarta)
 */

export const WIB_OFFSET_HOURS = 7;
export const WIB_TIMEZONE = 'Asia/Jakarta';

/**
 * Returns the current Date in WIB timezone coordinates
 */
export function getWIBNow() {
  const now = new Date();
  // Get UTC time and add 7 hours
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * WIB_OFFSET_HOURS);
}

/**
 * Convert any Date object to WIB Date object
 */
export function toWIBDate(date) {
  if (!date) return getWIBNow();
  const d = typeof date === 'string' ? new Date(date) : date;
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * WIB_OFFSET_HOURS);
}

/**
 * Format a Date to standard Indonesian WIB string
 * e.g., "Minggu, 8 November 2026 06:00 WIB"
 */
export function formatWIBDateTime(date) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d) + ' WIB';
}

/**
 * Format a Date to short Indonesian format
 * e.g., "08 Nov 2026, 06:00 WIB"
 */
export function formatWIBShort(date) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d) + ' WIB';
}

/**
 * Format a Date to time only (e.g., "06:00:00 WIB")
 */
export function formatWIBTime(date) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d) + ' WIB';
}


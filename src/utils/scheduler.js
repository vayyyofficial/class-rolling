/**
 * SEATFLOW - Scheduler Utility
 * Handles Sunday 06:00 WIB weekly reroll calculation, countdown, and week identifiers.
 */

import { WIB_OFFSET_HOURS } from './timezone';

/**
 * Get current UTC date with offset for WIB calculation
 */
function getWIBTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * WIB_OFFSET_HOURS);
}

/**
 * Returns the exact Date of the NEXT Sunday at 06:00 WIB
 */
export function getNextSunday0600WIB() {
  const wib = getWIBTime();
  const day = wib.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const hours = wib.getHours();
  const minutes = wib.getMinutes();

  let daysUntilSunday = (7 - day) % 7;

  // If today is Sunday (day === 0)
  if (day === 0) {
    if (hours < 6 || (hours === 6 && minutes === 0 && wib.getSeconds() === 0)) {
      // It is before 06:00 WIB today!
      daysUntilSunday = 0;
    } else {
      // 06:00 WIB has passed today, next is 7 days from now
      daysUntilSunday = 7;
    }
  }

  const nextSundayWib = new Date(wib);
  nextSundayWib.setDate(wib.getDate() + daysUntilSunday);
  nextSundayWib.setHours(6, 0, 0, 0);

  // Convert back to local system timestamp
  const diffFromWibNow = nextSundayWib.getTime() - wib.getTime();
  return new Date(Date.now() + diffFromWibNow);
}

/**
 * Returns the exact Date of the MOST RECENT Sunday at 06:00 WIB that has already passed
 */
export function getLastSunday0600WIB() {
  const nextSunday = getNextSunday0600WIB();
  return new Date(nextSunday.getTime() - 7 * 24 * 60 * 60 * 1000);
}

/**
 * Generates a unique execution identifier for a given weekly cycle.
 * A weekly cycle runs from Sunday 06:00 WIB to the next Sunday 05:59:59 WIB.
 * Format: "CYCLE-YYYY-MM-DD" representing the starting Sunday date in WIB.
 */
export function getWeeklyCycleId(date = new Date()) {
  const d = new Date(date);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 3600000 * WIB_OFFSET_HOURS);

  const day = wib.getDay();
  const hours = wib.getHours();

  let daysBack = day; // 0 for Sunday, 1 for Monday, etc.
  if (day === 0 && hours < 6) {
    // Before 06:00 on Sunday belongs to the PREVIOUS cycle
    daysBack = 7;
  }

  const cycleStart = new Date(wib);
  cycleStart.setDate(wib.getDate() - daysBack);
  
  const y = cycleStart.getFullYear();
  const m = String(cycleStart.getMonth() + 1).padStart(2, '0');
  const dt = String(cycleStart.getDate()).padStart(2, '0');

  return `CYCLE-${y}-${m}-${dt}`;
}

/**
 * Calculates remaining time until next Sunday 06:00 WIB
 * Returns { days, hours, minutes, seconds, totalSeconds, formatted }
 */
export function getTimeUntilNextReroll() {
  const target = getNextSunday0600WIB();
  const now = new Date();
  const diffMs = Math.max(0, target.getTime() - now.getTime());

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    formatted: `${days}h ${hours}j ${minutes}m ${seconds}d`,
    targetDate: target,
  };
}


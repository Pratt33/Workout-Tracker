// Date helpers. All date keys are *local* calendar days (YYYY-MM-DD).
// IMPORTANT: never use Date#toISOString().slice(0, 10) for a local day key —
// in positive timezones (e.g. IST) it returns the previous day before 05:30.

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function dateKeyFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey() {
  return dateKeyFromDate(new Date());
}

export function parseDateKey(key) {
  if (typeof key !== "string" || !DATE_KEY_RE.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidDateKey(key) {
  return parseDateKey(key) !== null;
}

export function addDaysToKey(key, amount) {
  const date = parseDateKey(key);
  if (!date) return key;
  date.setDate(date.getDate() + amount);
  return dateKeyFromDate(date);
}

export function formatDate(key, options) {
  const date = parseDateKey(key);
  if (!date) return key;
  return date.toLocaleDateString(
    "en-IN",
    options || { weekday: "short", day: "numeric", month: "short" },
  );
}

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

export function splitDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 };
}

export function joinDuration(minutes, seconds) {
  const mins = Math.max(0, Math.floor(Number(minutes) || 0));
  const secs = Math.max(0, Math.floor(Number(seconds) || 0));
  return mins * 60 + secs;
}

// Converts the legacy decimal-minutes representation to whole seconds.
export function minutesToSeconds(minutes) {
  const value = parseFloat(minutes);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 60);
}

export function secondsToMinutes(seconds) {
  const value = Number(seconds) || 0;
  return Math.round((value / 60) * 100) / 100;
}

export function formatDuration(totalSeconds, { compact = false } = {}) {
  const { minutes, seconds } = splitDuration(totalSeconds);
  if (minutes === 0 && seconds === 0) return compact ? "0s" : "0:00";
  if (compact && minutes === 0) return `${seconds}s`;
  if (compact && seconds === 0) return `${minutes}m`;
  return `${minutes}:${pad2(seconds)}`;
}

// ---------------------------------------------------------------------------
// ISO week helper (Monday-based, local calendar days)
// ---------------------------------------------------------------------------

export function getWeekKey(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;

  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = (thursday.getDay() + 6) % 7; // Mon=0 ... Sun=6
  thursday.setDate(thursday.getDate() - dayNumber + 3);

  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);

  const weekNumber =
    1 +
    Math.round(
      (thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

  return `${thursday.getFullYear()}-W${pad2(weekNumber)}`;
}

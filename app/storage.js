import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_CARDIO_CONFIG,
  PLAN_VERSION,
  getPlanMuscles,
  getWorkoutById,
  normalizeCardioConfig,
} from "./data";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  SCHEMA_VERSION,
} from "./keys";
import {
  dateKeyFromDate,
  formatDate,
  getWeekKey,
  parseDateKey,
  todayKey,
} from "./dates";
import {
  catalogFromPlan,
  createCatalog,
  getExerciseMuscle,
  getExerciseTracking,
  renameCatalogEntry,
} from "./catalog";
import {
  clonePlan,
  normalizePlan,
  renameExerciseInPlan,
} from "./planUtils";
import {
  getLoggedSessionEntries,
  getSessionMuscleVolumes,
  normalizeCardioValues,
  hasCardioValues,
} from "./sessionUtils";
import {
  cleanWorkoutSets,
  getSetsDuration,
  getSetsVolume,
  hasLoggedSets,
} from "./workoutSets";

export {
  dateKeyFromDate,
  formatDate,
  getWeekKey,
  parseDateKey,
  todayKey,
};

const warn = (message, error) => {
  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[storage] ${message}`, error);
  }
};

async function readJSON(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    warn(`Could not read ${key}`, error);
    return fallback;
  }
}

async function writeJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    warn(`Could not write ${key}`, error);
    return false;
  }
}

async function removeKey(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    warn(`Could not remove ${key}`, error);
    return false;
  }
}

// Shared with backup.js so storage access stays in one place.
export { readJSON as readStorageJSON, writeJSON as writeStorageJSON };

// ---------------------------------------------------------------------------
// Startup: one-time fresh start for the new data model
// ---------------------------------------------------------------------------

let storagePromise = null;

// Schema versions written by the discarded v6 migration preview. They are
// reset once so development installs do not carry half-migrated data forward.
const DISCARDED_SCHEMA_VERSIONS = new Set([2, 3]);

const ACTIVE_KEYS = [
  STORAGE_KEYS.sessions,
  STORAGE_KEYS.plan,
  STORAGE_KEYS.cardioConfig,
  STORAGE_KEYS.restDays,
  STORAGE_KEYS.assignments,
  STORAGE_KEYS.catalog,
  LEGACY_STORAGE_KEYS.overrides,
];

export function resetStorageCache() {
  storagePromise = null;
}

export function ensureStorageReady() {
  if (!storagePromise) {
    storagePromise = runStartup().catch((error) => {
      warn("Startup initialization failed; continuing with available data", error);
      return false;
    });
  }
  return storagePromise;
}

async function runStartup() {
  const meta = await readJSON(STORAGE_KEYS.meta, null);
  const metaVersion = Number(meta?.schemaVersion) || 0;

  // Future schema upgrades belong here: compare metaVersion with
  // SCHEMA_VERSION and upgrade the stored data in place. Never clear sessions
  // for an existing install.
  // if (metaVersion < SCHEMA_VERSION) { ... }

  if (metaVersion > 0 && !DISCARDED_SCHEMA_VERSIONS.has(metaVersion)) {
    if (metaVersion > SCHEMA_VERSION) {
      warn(`Unknown schema version ${metaVersion}; keeping data untouched`);
    }
    return true;
  }

  // First launch of the new model (or a discarded preview build): keep a copy
  // of whatever is on the device, then start with empty sessions and defaults.
  const snapshot = {};
  for (const key of ACTIVE_KEYS) {
    const value = await readJSON(key, null);
    if (value !== null) snapshot[key] = value;
  }

  if (Object.keys(snapshot).length > 0) {
    const archived = await writeJSON(STORAGE_KEYS.legacyArchive, {
      archivedAt: new Date().toISOString(),
      schemaVersion: metaVersion || null,
      data: snapshot,
    });
    if (!archived) {
      // Do not delete data we could not back up.
      warn("Could not archive legacy data; keeping it in place");
      return false;
    }
  }

  const removed = await Promise.all(ACTIVE_KEYS.map((key) => removeKey(key)));
  if (!removed.every(Boolean)) {
    warn("Could not clear legacy data; will retry on next launch");
    return false;
  }

  return writeJSON(STORAGE_KEYS.meta, {
    schemaVersion: SCHEMA_VERSION,
    initializedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function loadSessions() {
  await ensureStorageReady();
  const sessions = await readJSON(STORAGE_KEYS.sessions, {});
  return normalizeSessionsMap(sessions);
}

function sessionHasData(session) {
  if (!session || typeof session !== "object") return false;
  if (session._rest) return true;
  return Object.keys(session).some((key) => {
    if (key.startsWith("_")) return false;
    const value = session[key];
    if (Array.isArray(value)) return hasLoggedSets(value);
    if (value && typeof value === "object") {
      if (value.kg !== undefined) return String(value.kg).trim() !== "";
      return Object.keys(value).length > 0;
    }
    return String(value).trim() !== "";
  });
}

function normalizeSessionsMap(sessions) {
  if (!sessions || typeof sessions !== "object" || Array.isArray(sessions)) {
    return {};
  }
  const next = {};
  Object.entries(sessions).forEach(([key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const normalized = normalizeSessionData(value);
    // Older builds kept sessions that only had _workoutId/_label after the last
    // exercise was cleared. Drop those so they stop showing in History.
    if (sessionHasData(normalized)) next[key] = normalized;
  });
  return next;
}

function normalizeSessionData(sessionData) {
  const next = {};
  Object.entries(sessionData).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Keep only real rows. Padding blank sets here would leak empty rows into
      // exports, while the editors pad to 3 rows at display time.
      next[key] = value
        .map((set, index) => {
          if (!set || typeof set !== "object" || Array.isArray(set)) return null;
          const copy = {
            label: set.label || `Set ${index + 1}`,
            w: set.w != null ? String(set.w) : "",
            r: set.r != null ? String(set.r) : "",
          };
          if (set.t != null && String(set.t) !== "") copy.t = String(set.t);
          return copy;
        })
        .filter(Boolean);
      return;
    }
    if (value && typeof value === "object") {
      const cardioKeys = [
        "durationSec",
        "seconds",
        "minutes",
        "distance",
        "km",
        "speed",
        "incline",
        "steps",
      ];
      const looksLikeCardio = Object.keys(value).some((field) =>
        cardioKeys.includes(field),
      );
      // Older builds saved untouched cardio rows as { durationSec: "0" }.
      // Drop those so they stop looking logged.
      if (looksLikeCardio && !hasCardioValues(value)) return;
      next[key] = { ...value };
      return;
    }
    next[key] = value;
  });
  return next;
}

export async function saveSessions(sessions) {
  await ensureStorageReady();
  return writeJSON(STORAGE_KEYS.sessions, normalizeSessionsMap(sessions));
}

// ---------------------------------------------------------------------------
// Plan & exercise catalog
// ---------------------------------------------------------------------------

export async function loadCustomPlan() {
  await ensureStorageReady();
  const raw = await readJSON(STORAGE_KEYS.plan, null);
  if (!raw) return null;
  const plan = raw.plan || raw;
  return normalizePlan(plan);
}

export async function loadWorkoutPlan() {
  const plan = await loadCustomPlan();
  return plan || clonePlan(normalizePlan(null));
}

export async function saveCustomPlan(plan) {
  await ensureStorageReady();
  const normalized = normalizePlan(plan);
  await writeJSON(STORAGE_KEYS.plan, {
    _planVersion: PLAN_VERSION,
    plan: normalized,
  });

  const currentCatalog = await loadCatalog();
  const nextCatalog = catalogFromPlan(normalized, currentCatalog);
  await writeJSON(STORAGE_KEYS.catalog, nextCatalog);
  return normalized;
}

export async function clearCustomPlan() {
  await ensureStorageReady();
  await removeKey(STORAGE_KEYS.plan);

  // Restoring defaults must not orphan history: keep existing catalog entries
  // (renamed/removed exercises) and add fresh entries for the default plan.
  const currentCatalog = await loadCatalog();
  const nextCatalog = catalogFromPlan(normalizePlan(null), currentCatalog);
  await writeJSON(STORAGE_KEYS.catalog, nextCatalog);
}

export async function loadCatalog() {
  await ensureStorageReady();
  const stored = await readJSON(STORAGE_KEYS.catalog, null);
  if (stored && Object.keys(stored).length > 0) {
    return createCatalog(stored);
  }
  const plan = await loadCustomPlan();
  return catalogFromPlan(plan || normalizePlan(null), {});
}

export async function saveCatalog(catalog) {
  await ensureStorageReady();
  return writeJSON(STORAGE_KEYS.catalog, createCatalog(catalog));
}

export async function renameExerciseGlobally(oldName, newName) {
  const [sessions, plan, catalog] = await Promise.all([
    loadSessions(),
    loadWorkoutPlan(),
    loadCatalog(),
  ]);

  const sessionResult = renameExerciseInSessions(sessions, oldName, newName);
  const planResult = renameExerciseInPlan(plan, oldName, newName);
  const muscle = getExerciseMuscle(oldName, catalog);
  const tracking = getExerciseTracking(oldName, catalog);
  const nextCatalog = renameCatalogEntry(catalog, oldName, newName, {
    muscle,
    tracking,
  });

  await Promise.all([
    sessionResult.changed
      ? writeJSON(STORAGE_KEYS.sessions, sessionResult.sessions)
      : Promise.resolve(),
    planResult.changed
      ? writeJSON(STORAGE_KEYS.plan, {
          _planVersion: PLAN_VERSION,
          plan: planResult.plan,
        })
      : Promise.resolve(),
    writeJSON(STORAGE_KEYS.catalog, nextCatalog),
  ]);

  return {
    sessions: sessionResult.sessions,
    plan: planResult.plan,
    catalog: nextCatalog,
  };
}

export function renameExerciseInSessions(sessions, oldName, newName) {
  if (!oldName || !newName || oldName === newName) {
    return { sessions, changed: false };
  }
  const next = JSON.parse(JSON.stringify(sessions || {}));
  let changed = false;

  Object.keys(next).forEach((key) => {
    const session = next[key];
    if (!session || typeof session !== "object" || Array.isArray(session)) {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(session, oldName)) return;

    const oldSets = Array.isArray(session[oldName]) ? session[oldName] : [];
    const existing = Array.isArray(session[newName]) ? session[newName] : [];
    session[newName] =
      existing.length > 0 ? [...existing, ...oldSets] : oldSets;
    delete session[oldName];
    changed = true;
  });

  return { sessions: next, changed };
}

// ---------------------------------------------------------------------------
// Cardio config
// ---------------------------------------------------------------------------

export async function loadCardioConfig() {
  await ensureStorageReady();
  const raw = await readJSON(STORAGE_KEYS.cardioConfig, null);
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return normalizeCardioConfig(raw);
}

export async function saveCardioConfig(config) {
  await ensureStorageReady();
  return writeJSON(STORAGE_KEYS.cardioConfig, config);
}

export async function resetCardioConfig() {
  await ensureStorageReady();
  return removeKey(STORAGE_KEYS.cardioConfig);
}

// ---------------------------------------------------------------------------
// Rest days and workout assignments
// ---------------------------------------------------------------------------

export async function loadRestDays() {
  await ensureStorageReady();
  const value = await readJSON(STORAGE_KEYS.restDays, {});
  return value && typeof value === "object" ? value : {};
}

export async function saveRestDay(dateKey, isRest) {
  const [restDays, sessions] = await Promise.all([
    loadRestDays(),
    loadSessions(),
  ]);
  const nextRest = { ...restDays };
  const nextSessions = JSON.parse(JSON.stringify(sessions));

  if (isRest) {
    nextRest[dateKey] = true;
    nextSessions[dateKey] = {
      ...(nextSessions[dateKey] || {}),
      _rest: true,
      _label: nextSessions[dateKey]?._label || "Rest",
    };
  } else {
    delete nextRest[dateKey];
    if (nextSessions[dateKey]) {
      delete nextSessions[dateKey]._rest;
      const dataKeys = Object.keys(nextSessions[dateKey]).filter(
        (key) => !key.startsWith("_"),
      );
      if (dataKeys.length === 0) delete nextSessions[dateKey];
    }
  }

  await Promise.all([
    writeJSON(STORAGE_KEYS.restDays, nextRest),
    writeJSON(STORAGE_KEYS.sessions, nextSessions),
  ]);
  return { restDays: nextRest, sessions: nextSessions };
}

export async function loadDayOverrides() {
  await ensureStorageReady();
  const value = await readJSON(STORAGE_KEYS.assignments, {});
  return value && typeof value === "object" ? value : {};
}

export async function saveDayOverride(dateKey, workoutId) {
  await ensureStorageReady();
  const assignments = await loadDayOverrides();
  const next = { ...assignments };
  if (workoutId === null || workoutId === undefined || workoutId === "auto") {
    delete next[dateKey];
  } else if (typeof workoutId === "string") {
    next[dateKey] = workoutId;
  } else {
    return assignments;
  }
  await writeJSON(STORAGE_KEYS.assignments, next);
  return next;
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function getSessionVolume(sessionData) {
  if (!sessionData) return 0;
  let volume = 0;
  Object.entries(sessionData).forEach(([key, sets]) => {
    if (key.startsWith("_") || !Array.isArray(sets)) return;
    volume += getSetsVolume(cleanWorkoutSets(sets));
  });
  return Math.round(volume);
}

export function getFilteredKeys(sessions, filter) {
  const keys = Object.keys(sessions || {})
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort();

  if (filter === "all") return keys;

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (filter === "4w") cutoff.setDate(cutoff.getDate() - 28);
  else if (filter === "3m") cutoff.setMonth(cutoff.getMonth() - 3);

  return keys.filter((key) => {
    const date = parseDateKey(key);
    return date && date >= cutoff;
  });
}

export function getLatestExerciseSets(sessions, exerciseName, excludeKey) {
  if (!exerciseName || !sessions || typeof sessions !== "object") {
    return { sets: null, dateKey: null };
  }
  const keys = Object.keys(sessions)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key !== excludeKey)
    .sort()
    .reverse();

  for (const key of keys) {
    const sets = sessions[key]?.[exerciseName];
    if (Array.isArray(sets) && hasLoggedSets(sets)) {
      return {
        sets: cleanWorkoutSets(sets),
        dateKey: key,
      };
    }
  }
  return { sets: null, dateKey: null };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCSVExport(sessions, plan, catalog, cardioConfig = DEFAULT_CARDIO_CONFIG) {
  const header = [
    "Date",
    "Workout",
    "Muscle Group",
    "Exercise",
    "Set",
    "Weight (kg)",
    "Reps",
    "Time (sec)",
    "Volume (kg)",
    "Duration (min)",
    "Distance (km)",
    "Speed (km/h)",
    "Incline (%)",
    "Body Weight (kg)",
  ];
  const rows = [header.map(csvValue).join(",")];

  const sessionKeys = Object.keys(sessions || {})
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort();

  sessionKeys.forEach((dateKey) => {
    const session = sessions[dateKey] || {};
    const workout = getWorkoutById(plan, session._workoutId);
    const workoutLabel = session._label || workout?.label || "Session";

    getLoggedSessionEntries(session, cardioConfig).forEach((entry) => {
      if (entry.kind === "cardio") {
        if (!hasCardioValues(entry.entry)) return;
        const values = normalizeCardioValues(entry.entry);
        const durationSeconds = parseInt(values.durationSec, 10) || 0;
        rows.push(
          [
            dateKey,
            workoutLabel,
            "Cardio",
            entry.name,
            "",
            "",
            "",
            "",
            "",
            durationSeconds > 0
              ? Math.round((durationSeconds / 60) * 100) / 100
              : "",
            values.distance,
            values.speed,
            values.incline,
            "",
          ]
            .map(csvValue)
            .join(","),
        );
        return;
      }

      if (entry.kind === "weight") {
        const kg = String(entry.entry?.kg ?? "").trim();
        if (!kg) return;
        rows.push(
          [
            dateKey,
            workoutLabel,
            "Weight",
            entry.name,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            kg,
          ]
            .map(csvValue)
            .join(","),
        );
        return;
      }

      const sets = cleanWorkoutSets(entry.entry);
      sets.forEach((set, index) => {
        const weight = parseFloat(set.w) || 0;
        const reps = parseInt(set.r, 10) || 0;
        const seconds = parseInt(set.t, 10) || 0;
        const volume = weight * reps;
        rows.push(
          [
            dateKey,
            workoutLabel,
            getExerciseMuscle(entry.name, catalog),
            entry.name,
            set.label || `Set ${index + 1}`,
            weight || "",
            reps || "",
            seconds || "",
            volume > 0 ? Math.round(volume) : "",
            "",
            "",
            "",
            "",
            "",
          ]
            .map(csvValue)
            .join(","),
        );
      });
    });
  });

  return rows.join("\n");
}

function percentageChange(previous, current) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

export function buildLLMExportPayload(
  sessions,
  plan,
  catalog,
  cardioConfig = DEFAULT_CARDIO_CONFIG,
) {
  const sessionKeys = Object.keys(sessions || {})
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort();

  const muscles = getPlanMuscles(plan);
  if (!muscles.includes("Other")) muscles.push("Other");

  const byMuscle = {};
  muscles.forEach((muscle) => {
    byMuscle[muscle] = {
      total_volume_kg: 0,
      total_sets: 0,
      timed_seconds: 0,
      sessions_touched: 0,
      per_week_volume_kg: {},
      recent_28d_volume_kg: 0,
      previous_28d_volume_kg: 0,
    };
  });

  const byWeek = {};
  const byWorkout = {};
  let totalVolume = 0;
  let totalSets = 0;
  let totalTimedSeconds = 0;
  let restDays = 0;

  const now = new Date();
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 28);
  const previousStart = new Date(now);
  previousStart.setDate(previousStart.getDate() - 56);

  sessionKeys.forEach((dateKey) => {
    const session = sessions[dateKey] || {};
    const workout = getWorkoutById(plan, session._workoutId);
    const workoutLabel = session._label || workout?.label || "Session";
    const weekKey = getWeekKey(dateKey);
    const sessionDate = parseDateKey(dateKey);

    if (session._rest) restDays += 1;

    const muscleVolumes = getSessionMuscleVolumes(session, catalog);
    const sessionVolume = Object.values(muscleVolumes).reduce(
      (sum, value) => sum + value,
      0,
    );

    if (!byWorkout[workoutLabel]) {
      byWorkout[workoutLabel] = {
        sessions: 0,
        rest_days: 0,
        volume_kg: 0,
        sets: 0,
        timed_seconds: 0,
      };
    }
    byWorkout[workoutLabel].sessions += 1;
    if (session._rest) byWorkout[workoutLabel].rest_days += 1;

    if (!byWeek[weekKey]) {
      byWeek[weekKey] = { total_volume_kg: 0, total_sets: 0, sessions: 0 };
    }
    byWeek[weekKey].sessions += 1;

    Object.entries(muscleVolumes).forEach(([muscle, volume]) => {
      if (!byMuscle[muscle]) {
        byMuscle[muscle] = {
          total_volume_kg: 0,
          total_sets: 0,
          timed_seconds: 0,
          sessions_touched: 0,
          per_week_volume_kg: {},
          recent_28d_volume_kg: 0,
          previous_28d_volume_kg: 0,
        };
      }
      byMuscle[muscle].total_volume_kg += volume;
      byMuscle[muscle].per_week_volume_kg[weekKey] =
        (byMuscle[muscle].per_week_volume_kg[weekKey] || 0) + volume;
      if (sessionDate >= recentStart) {
        byMuscle[muscle].recent_28d_volume_kg += volume;
      } else if (sessionDate >= previousStart && sessionDate < recentStart) {
        byMuscle[muscle].previous_28d_volume_kg += volume;
      }
    });

    Object.keys(session).forEach((key) => {
      if (key.startsWith("_")) return;
      const sets = session[key];
      if (!Array.isArray(sets)) return;
      const loggedSets = cleanWorkoutSets(sets);
      if (loggedSets.length === 0) return;
      const muscle = getExerciseMuscle(key, catalog);
      if (!byMuscle[muscle]) {
        byMuscle[muscle] = {
          total_volume_kg: 0,
          total_sets: 0,
          timed_seconds: 0,
          sessions_touched: 0,
          per_week_volume_kg: {},
          recent_28d_volume_kg: 0,
          previous_28d_volume_kg: 0,
        };
      }
      const volume = getSetsVolume(loggedSets);
      const timedSeconds = getSetsDuration(loggedSets);
      byMuscle[muscle].total_sets += loggedSets.length;
      byMuscle[muscle].timed_seconds += timedSeconds;
      byWeek[weekKey].total_sets += loggedSets.length;
      totalSets += loggedSets.length;
      totalTimedSeconds += timedSeconds;
      byWorkout[workoutLabel].sets += loggedSets.length;
      byWorkout[workoutLabel].timed_seconds += timedSeconds;
    });

    const touched = new Set(
      Object.keys(session).filter((key) => {
        if (key.startsWith("_")) return false;
        return Array.isArray(session[key]) && hasLoggedSets(session[key]);
      }).map((key) => getExerciseMuscle(key, catalog)),
    );
    touched.forEach((muscle) => {
      if (byMuscle[muscle]) byMuscle[muscle].sessions_touched += 1;
    });

    totalVolume += sessionVolume;
    byWeek[weekKey].total_volume_kg += sessionVolume;
    byWorkout[workoutLabel].volume_kg += sessionVolume;
  });

  Object.values(byMuscle).forEach((entry) => {
    entry.total_volume_kg = Math.round(entry.total_volume_kg);
    entry.recent_28d_volume_kg = Math.round(entry.recent_28d_volume_kg);
    entry.previous_28d_volume_kg = Math.round(entry.previous_28d_volume_kg);
    Object.keys(entry.per_week_volume_kg).forEach((week) => {
      entry.per_week_volume_kg[week] = Math.round(
        entry.per_week_volume_kg[week],
      );
    });
    entry.trend_28d_vs_prev_28d_pct = percentageChange(
      entry.previous_28d_volume_kg,
      entry.recent_28d_volume_kg,
    );
  });

  Object.values(byWeek).forEach((entry) => {
    entry.total_volume_kg = Math.round(entry.total_volume_kg);
  });
  Object.values(byWorkout).forEach((entry) => {
    entry.volume_kg = Math.round(entry.volume_kg);
  });

  const muscleVolumes = muscles.map(
    (muscle) => byMuscle[muscle]?.total_volume_kg || 0,
  );
  const average = muscleVolumes.length
    ? muscleVolumes.reduce((sum, value) => sum + value, 0) /
      muscleVolumes.length
    : 0;

  const balance = muscles.map((muscle) => {
    const volume = byMuscle[muscle]?.total_volume_kg || 0;
    const ratio = average > 0 ? volume / average : 1;
    return {
      muscle,
      total_volume_kg: volume,
      volume_vs_avg_ratio: Math.round(ratio * 100) / 100,
      status:
        ratio < 0.8
          ? "undertrained"
          : ratio > 1.2
            ? "overemphasized"
            : "balanced",
    };
  });

  const cardio = {};
  const cardioSamples = {};
  sessionKeys.forEach((dateKey) => {
    const session = sessions[dateKey] || {};
    getLoggedSessionEntries(session, cardioConfig).forEach((entry) => {
      if (entry.kind !== "cardio" || !hasCardioValues(entry.entry)) return;
      const values = normalizeCardioValues(entry.entry);
      if (!cardio[entry.name]) {
        cardio[entry.name] = {
          sessions: 0,
          duration_min: 0,
          distance_km: 0,
          avg_speed_kmh: 0,
          avg_incline_pct: 0,
        };
        cardioSamples[entry.name] = { speed: 0, incline: 0 };
      }
      const summary = cardio[entry.name];
      const samples = cardioSamples[entry.name];
      summary.sessions += 1;
      summary.duration_min += (parseInt(values.durationSec, 10) || 0) / 60;
      summary.distance_km += parseFloat(values.distance) || 0;
      if (String(values.speed).trim() !== "") {
        summary.avg_speed_kmh += parseFloat(values.speed) || 0;
        samples.speed += 1;
      }
      if (String(values.incline).trim() !== "") {
        summary.avg_incline_pct += parseFloat(values.incline) || 0;
        samples.incline += 1;
      }
    });
  });
  Object.entries(cardio).forEach(([name, entry]) => {
    entry.duration_min = Math.round(entry.duration_min * 10) / 10;
    entry.distance_km = Math.round(entry.distance_km * 10) / 10;
    const samples = cardioSamples[name] || { speed: 0, incline: 0 };
    if (samples.speed > 0) {
      entry.avg_speed_kmh =
        Math.round((entry.avg_speed_kmh / samples.speed) * 10) / 10;
    }
    if (samples.incline > 0) {
      entry.avg_incline_pct =
        Math.round((entry.avg_incline_pct / samples.incline) * 10) / 10;
    }
  });

  return {
    metadata: {
      schema_version: "llm_export_v2",
      generated_at_iso: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      units: {
        weight: "kg",
        volume: "kg_reps",
        duration: "seconds",
        distance: "km",
        speed: "km/h",
        incline: "percent",
      },
      split: "PPL-UL (flexible 5-workout rotation)",
    },
    annotations: {
      purpose:
        "Analyze progression, muscle balance, and cardiorespiratory work over time.",
      interpretation_notes: [
        "total_volume_kg is sum(weight * reps) over all logged sets.",
        "Timed exercises store duration in seconds and do not contribute to volume.",
        "trend_28d_vs_prev_28d_pct compares the last 28 days against the prior 28 days.",
        "balance.status uses total volume vs the average across muscles (0.8 / 1.2 thresholds).",
        "Rest days are counted but contribute no training volume.",
      ],
      caveats: [
        "This export reflects logged data only; missed logs look like lower volume.",
        "Exercise names are canonicalized through raw.exercise_catalog, so renamed or removed exercises keep their history.",
      ],
    },
    raw: {
      workout_plan: plan,
      exercise_catalog: catalog,
      cardio_config: cardioConfig,
      sessions,
    },
    derived: {
      totals: {
        session_count: sessionKeys.length,
        rest_days: restDays,
        total_sets: totalSets,
        total_volume_kg: Math.round(totalVolume),
        total_timed_seconds: totalTimedSeconds,
      },
      by_muscle: byMuscle,
      by_workout: byWorkout,
      by_week: byWeek,
      cardio_summary: cardio,
      balance_summary: balance,
      potential_focus_muscles: balance
        .filter((entry) => entry.status === "undertrained")
        .map((entry) => entry.muscle),
    },
  };
}

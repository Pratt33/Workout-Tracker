import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_VERSION, DEFAULT_CARDIO_CONFIG, PLAN_VERSION } from "./data";
import { STORAGE_KEYS, SCHEMA_VERSION } from "./keys";
import {
  ensureStorageReady,
  loadCatalog,
  loadDayOverrides,
  loadRestDays,
  loadSessions,
  loadWorkoutPlan,
  resetStorageCache,
  readStorageJSON,
  writeStorageJSON,
} from "./storage";

export const BACKUP_FORMAT = "workout-tracker-backup";

export async function createBackup() {
  await ensureStorageReady();
  const [sessions, plan, cardioConfig, restDays, assignments, catalog] =
    await Promise.all([
      loadSessions(),
      loadWorkoutPlan(),
      readStorageJSON(STORAGE_KEYS.cardioConfig, null),
      loadRestDays(),
      loadDayOverrides(),
      loadCatalog(),
    ]);

  return {
    format: BACKUP_FORMAT,
    backupVersion: 1,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      sessions,
      plan,
      cardioConfig: cardioConfig || DEFAULT_CARDIO_CONFIG,
      restDays,
      assignments,
      catalog,
    },
  };
}

export async function createBackupJSON() {
  return JSON.stringify(await createBackup(), null, 2);
}

function extractBackupData(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.format === BACKUP_FORMAT && parsed.data) return parsed.data;
  if (parsed.data && (parsed.data.sessions || parsed.data.plan)) {
    return parsed.data;
  }
  if (parsed.sessions || parsed.plan) return parsed;
  return null;
}

export async function restoreBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That text is not valid JSON.");
  }

  const data = extractBackupData(parsed);
  if (!data) {
    throw new Error("This does not look like a Workout Tracker backup.");
  }
  if (!data.sessions || typeof data.sessions !== "object") {
    throw new Error("Backup is missing workout sessions.");
  }

  const clears = [
    STORAGE_KEYS.sessions,
    STORAGE_KEYS.plan,
    STORAGE_KEYS.cardioConfig,
    STORAGE_KEYS.restDays,
    STORAGE_KEYS.assignments,
    STORAGE_KEYS.catalog,
  ];
  await Promise.all(clears.map((key) => AsyncStorage.removeItem(key)));

  await writeStorageJSON(STORAGE_KEYS.sessions, data.sessions);
  if (data.plan) {
    await writeStorageJSON(STORAGE_KEYS.plan, {
      _planVersion: PLAN_VERSION,
      plan: data.plan,
    });
  }
  if (data.cardioConfig) {
    await writeStorageJSON(STORAGE_KEYS.cardioConfig, data.cardioConfig);
  }
  if (data.restDays) {
    await writeStorageJSON(STORAGE_KEYS.restDays, data.restDays);
  }
  if (data.assignments) {
    await writeStorageJSON(STORAGE_KEYS.assignments, data.assignments);
  }
  if (data.catalog) {
    await writeStorageJSON(STORAGE_KEYS.catalog, data.catalog);
  }
  await writeStorageJSON(STORAGE_KEYS.meta, {
    schemaVersion: SCHEMA_VERSION,
    restoredAt: new Date().toISOString(),
  });

  resetStorageCache();
  await ensureStorageReady();

  return {
    sessionCount: Object.keys(data.sessions).length,
    planWorkouts: data.plan?.workouts?.length || 0,
  };
}

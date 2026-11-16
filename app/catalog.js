import { DEFAULT_TIMED_EXERCISES, MUSCLE_ALIASES } from "./data";

export const TRACKING_REPS = "reps";
export const TRACKING_TIME = "time";

export function normalizeExerciseKey(name) {
  return String(name || "").trim().toLowerCase();
}

export function getDefaultTracking(name) {
  return DEFAULT_TIMED_EXERCISES.includes(name) ? TRACKING_TIME : TRACKING_REPS;
}

export function createCatalog(entries) {
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return {};
  }
  const next = {};
  Object.entries(entries).forEach(([name, value]) => {
    if (!name || !value || typeof value !== "object") return;
    next[name] = {
      muscle: MUSCLE_ALIASES[value.muscle] || value.muscle || "Other",
      tracking:
        value.tracking === TRACKING_TIME ? TRACKING_TIME : TRACKING_REPS,
    };
  });
  return next;
}

function addExercise(catalog, name, muscle, tracking) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return;
  const existing = catalog[trimmed];
  catalog[trimmed] = {
    muscle: MUSCLE_ALIASES[muscle] || muscle || existing?.muscle || "Other",
    tracking:
      tracking ||
      existing?.tracking ||
      getDefaultTracking(trimmed),
  };
}

export function catalogFromPlan(plan, existingCatalog = {}) {
  const catalog = { ...createCatalog(existingCatalog) };
  (plan?.workouts || []).forEach((workout) => {
    (workout.groups || []).forEach((group) => {
      if (group.name === "Cardio" || group.name === "Weight") return;
      (group.exercises || []).forEach((exercise) => {
        addExercise(catalog, exercise, group.name);
      });
    });
  });
  return catalog;
}

export function getExerciseMuscle(exerciseName, catalog) {
  return catalog?.[exerciseName]?.muscle || "Other";
}

export function getExerciseTracking(exerciseName, catalog) {
  const tracking = catalog?.[exerciseName]?.tracking;
  if (tracking === TRACKING_TIME) return TRACKING_TIME;
  if (tracking === TRACKING_REPS) return TRACKING_REPS;
  return getDefaultTracking(exerciseName);
}

export function isTimedExercise(exerciseName, catalog) {
  return getExerciseTracking(exerciseName, catalog) === TRACKING_TIME;
}

export function setExerciseTracking(catalog, exerciseName, tracking) {
  if (!exerciseName) return catalog;
  const next = { ...catalog };
  const existing = next[exerciseName] || {
    muscle: "Other",
  };
  next[exerciseName] = {
    ...existing,
    tracking: tracking === TRACKING_TIME ? TRACKING_TIME : TRACKING_REPS,
  };
  return next;
}

export function renameCatalogEntry(catalog, oldName, newName, updates = {}) {
  if (!oldName || !newName || oldName === newName) return catalog;
  const next = { ...catalog };
  const existing = next[oldName] || { muscle: "Other", tracking: getDefaultTracking(newName) };
  delete next[oldName];
  next[newName] = {
    ...existing,
    ...updates,
  };
  return next;
}

// Resolves chained renames such as { A: B, B: C }.
export function resolveRenameMap(renameMap, name) {
  let current = name;
  const seen = new Set();
  while (renameMap[current] && !seen.has(current)) {
    seen.add(current);
    current = renameMap[current];
  }
  return current;
}

export const WORKOUT_SET_COUNT = 3;

export function getWorkoutSetLabel(index) {
  return `Set ${index + 1}`;
}

export function createWorkoutSets(values = []) {
  return Array.from({ length: WORKOUT_SET_COUNT }, (_, index) => {
    const existing = values[index] || {};
    return {
      label: getWorkoutSetLabel(index),
      w: existing.w != null ? String(existing.w) : "",
      r: existing.r != null ? String(existing.r) : "",
    };
  });
}

export function normalizeWorkoutSets(values) {
  return createWorkoutSets(Array.isArray(values) ? values : []);
}
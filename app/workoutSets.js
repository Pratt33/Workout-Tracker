export const WORKOUT_SET_COUNT = 3;

export function getWorkoutSetLabel(index) {
  return `Set ${index + 1}`;
}

function withOptionalTime(target, source) {
  if (source.t != null && String(source.t) !== "") {
    target.t = String(source.t);
  }
  return target;
}

// Preserve any extra sets that already exist rather than truncating to 3.
// This is important for history editing: opening a 4-set session and saving it
// must not silently delete the fourth set.
export function createWorkoutSets(values = []) {
  const list = Array.isArray(values) ? values : [];
  const count = Math.max(WORKOUT_SET_COUNT, list.length);

  return Array.from({ length: count }, (_, index) => {
    const existing = list[index] || {};
    return withOptionalTime(
      {
        label: existing.label || getWorkoutSetLabel(index),
        w: existing.w != null ? String(existing.w) : "",
        r: existing.r != null ? String(existing.r) : "",
      },
      existing,
    );
  });
}

export function normalizeWorkoutSets(values) {
  return createWorkoutSets(Array.isArray(values) ? values : []);
}

export function setHasValue(set) {
  if (!set || typeof set !== "object") return false;
  return ["w", "r", "t"].some((key) => String(set[key] ?? "").trim() !== "");
}

export function hasLoggedSets(sets) {
  return Array.isArray(sets) && sets.some(setHasValue);
}

// Drops blank rows before persisting. A blank set is not workout data.
export function cleanWorkoutSets(values) {
  return normalizeWorkoutSets(values).filter(setHasValue);
}

export function getSetVolume(set) {
  if (!set) return 0;
  return (parseFloat(set.w) || 0) * (parseInt(set.r, 10) || 0);
}

export function getSetsVolume(sets) {
  if (!Array.isArray(sets)) return 0;
  return sets.reduce((sum, set) => sum + getSetVolume(set), 0);
}

export function getSetsDuration(sets) {
  if (!Array.isArray(sets)) return 0;
  return sets.reduce((sum, set) => sum + (parseInt(set?.t, 10) || 0), 0);
}

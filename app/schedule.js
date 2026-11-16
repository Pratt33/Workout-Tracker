import { getWorkoutById, getWorkouts } from "./data";
import { parseDateKey } from "./dates";

// A long break means the old cycle no longer reflects the user's current
// training. Restarting at the first workout keeps a skipped week simple.
export const ROTATION_RESET_DAYS = 7;

export function isValidWorkoutId(plan, workoutId) {
  return !!getWorkoutById(plan, workoutId);
}

export function getLastWorkoutIdBefore(plan, sessions, dateKey) {
  const workouts = getWorkouts(plan);
  if (!workouts.length) return null;
  const valid = new Set(workouts.map((workout) => workout.id));
  const keys = Object.keys(sessions || {})
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key < dateKey)
    .sort();

  for (let index = keys.length - 1; index >= 0; index -= 1) {
    const session = sessions[keys[index]];
    if (!session?._workoutId) continue;
    if (!valid.has(session._workoutId)) continue;

    const lastDate = parseDateKey(keys[index]);
    const currentDate = parseDateKey(dateKey);
    if (lastDate && currentDate) {
      const gapDays = Math.round(
        (currentDate.getTime() - lastDate.getTime()) / 86400000,
      );
      if (gapDays >= ROTATION_RESET_DAYS) return null;
    }

    return session._workoutId;
  }
  return null;
}

// Rotation is based on the last *logged* workout, not on weekdays. Rest days
// therefore do not consume a slot: the next training day continues the cycle.
// After ROTATION_RESET_DAYS without a logged workout the cycle restarts.
export function getNextWorkoutId(plan, sessions, dateKey) {
  const workouts = getWorkouts(plan);
  if (!workouts.length) return null;

  const lastWorkoutId = getLastWorkoutIdBefore(plan, sessions, dateKey);
  if (!lastWorkoutId) return workouts[0].id;

  const lastIndex = workouts.findIndex(
    (workout) => workout.id === lastWorkoutId,
  );
  if (lastIndex < 0) return workouts[0].id;
  return workouts[(lastIndex + 1) % workouts.length].id;
}

export function getWorkoutForDate(
  plan,
  sessions,
  assignments,
  dateKey,
  explicitWorkoutId = null,
) {
  if (explicitWorkoutId && isValidWorkoutId(plan, explicitWorkoutId)) {
    return {
      workout: getWorkoutById(plan, explicitWorkoutId),
      source: "explicit",
    };
  }

  const session = sessions?.[dateKey];
  if (session?._workoutId && isValidWorkoutId(plan, session._workoutId)) {
    return {
      workout: getWorkoutById(plan, session._workoutId),
      source: "logged",
    };
  }

  const assigned = assignments?.[dateKey];
  if (assigned && assigned !== "auto" && isValidWorkoutId(plan, assigned)) {
    return {
      workout: getWorkoutById(plan, assigned),
      source: "assigned",
    };
  }

  return {
    workout: getWorkoutById(plan, getNextWorkoutId(plan, sessions, dateKey)),
    source: "rotation",
  };
}

export function getWorkoutOrdinal(plan, workoutId) {
  const workouts = getWorkouts(plan);
  const index = workouts.findIndex((workout) => workout.id === workoutId);
  if (index < 0) return null;
  return { index: index + 1, total: workouts.length };
}

import { DEFAULT_PLAN, MUSCLE_ALIASES, PLAN_VERSION } from "./data";

export function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

// Maps retired muscle names (for example "Abs, Wrist & Forearms") forward so
// stored plans keep working with one color and one Progress category.
function withCurrentMuscleNames(plan) {
  const next = clonePlan(plan);
  (next.workouts || []).forEach((workout) => {
    (workout.groups || []).forEach((group) => {
      if (group && MUSCLE_ALIASES[group.name]) {
        group.name = MUSCLE_ALIASES[group.name];
      }
    });
  });
  return next;
}

export function isPlanV3(plan) {
  return !!plan && plan.version === PLAN_VERSION && Array.isArray(plan.workouts);
}

export function normalizePlan(rawPlan) {
  if (!rawPlan) return withCurrentMuscleNames(DEFAULT_PLAN);

  if (isPlanV3(rawPlan)) return withCurrentMuscleNames(rawPlan);

  if (Array.isArray(rawPlan)) {
    return withCurrentMuscleNames({
      version: PLAN_VERSION,
      workouts: clonePlan(rawPlan),
    });
  }

  if (Array.isArray(rawPlan.workouts)) {
    return withCurrentMuscleNames({
      ...clonePlan(rawPlan),
      version: PLAN_VERSION,
    });
  }

  return withCurrentMuscleNames(DEFAULT_PLAN);
}

export function renameExerciseInPlan(plan, oldName, newName) {
  if (!plan || !oldName || !newName || oldName === newName) {
    return { plan, changed: false };
  }
  const next = clonePlan(plan);
  let changed = false;

  (next.workouts || []).forEach((workout) => {
    (workout.groups || []).forEach((group) => {
      group.exercises = (group.exercises || []).map((exercise) => {
        if (exercise !== oldName) return exercise;
        changed = true;
        return newName;
      });
    });
  });

  return { plan: changed ? next : plan, changed };
}

export function findExerciseInPlan(plan, exerciseName) {
  const lookup = String(exerciseName || "").trim().toLowerCase();
  if (!lookup) return null;
  for (const workout of plan?.workouts || []) {
    for (const group of workout.groups || []) {
      if (group.name === "Cardio" || group.name === "Weight") continue;
      if (
        (group.exercises || []).some(
          (exercise) => String(exercise).trim().toLowerCase() === lookup,
        )
      ) {
        return { workout, group, name: exerciseName };
      }
    }
  }
  return null;
}

export function collectPlanExerciseNames(plan) {
  const names = [];
  (plan?.workouts || []).forEach((workout) => {
    (workout.groups || []).forEach((group) => {
      if (group.name === "Cardio" || group.name === "Weight") return;
      (group.exercises || []).forEach((exercise) => {
        const name = String(exercise || "").trim();
        if (name) names.push(name);
      });
    });
  });
  return names;
}

export function validatePlanExerciseNames(plan) {
  const seen = new Map();
  const duplicates = [];
  (plan?.workouts || []).forEach((workout) => {
    (workout.groups || []).forEach((group) => {
      if (group.name === "Cardio" || group.name === "Weight") return;
      (group.exercises || []).forEach((exercise) => {
        const trimmed = String(exercise || "").trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) duplicates.push(trimmed);
        else seen.set(key, true);
      });
    });
  });
  return duplicates;
}

export const APP_VERSION = "6.0.0";
export const PLAN_VERSION = 3;

// ---------------------------------------------------------------------------
// Cardio configuration
// ---------------------------------------------------------------------------

export const CARDIO_FIELD_DEFS = {
  duration: { key: "duration", label: "Duration", unit: "time" },
  distance: { key: "distance", label: "Distance", unit: "km" },
  speed: { key: "speed", label: "Speed", unit: "km/h" },
  incline: { key: "incline", label: "Incline", unit: "%" },
};

export const CARDIO_FIELD_OPTIONS = Object.values(CARDIO_FIELD_DEFS);

export const DEFAULT_CARDIO_CONFIG = [
  {
    id: "walking",
    name: "Walking",
    fields: ["duration", "distance", "speed", "incline"],
  },
  { id: "plank", name: "Plank", fields: ["duration"] },
];

// Cardio entries that are no longer part of the app. Stored configs are
// filtered so removed entries disappear from Today and Progress.
const RETIRED_CARDIO_NAMES = ["cycling"];

export function normalizeCardioConfig(config) {
  if (!Array.isArray(config)) return DEFAULT_CARDIO_CONFIG;
  const seen = new Set();
  const entries = [];
  config.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const name = String(entry.name || "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    if (RETIRED_CARDIO_NAMES.includes(key)) return;
    seen.add(key);
    const fields = (Array.isArray(entry.fields) ? entry.fields : []).filter(
      (field) => CARDIO_FIELD_DEFS[field],
    );
    entries.push({
      id: entry.id || key.replace(/[^a-z0-9]+/g, "_"),
      name,
      fields: fields.length ? fields : ["duration"],
    });
  });
  return entries.length ? entries : DEFAULT_CARDIO_CONFIG;
}

export function getCardioFields(exerciseName, config = DEFAULT_CARDIO_CONFIG) {
  const entry = getCardioEntry(exerciseName, config);
  if (!entry || !Array.isArray(entry.fields)) return [];
  return entry.fields.filter((field) => CARDIO_FIELD_DEFS[field]);
}

export function isCardioExercise(exerciseName, config = DEFAULT_CARDIO_CONFIG) {
  return config.some((c) => c.name === exerciseName || c.id === exerciseName);
}

export function getCardioEntry(exerciseName, config = DEFAULT_CARDIO_CONFIG) {
  return (
    config.find(
      (c) => c.name === exerciseName || c.id === exerciseName,
    ) || null
  );
}

export function cardioHasField(exerciseName, field, config) {
  return getCardioFields(exerciseName, config).includes(field);
}

// ---------------------------------------------------------------------------
// Plan (5 flexible workout templates, no fixed weekdays)
// ---------------------------------------------------------------------------

export const MUSCLE_COLORS = {
  Chest: "#7B72E8",
  Triceps: "#E8724A",
  Back: "#2DBF8E",
  Biceps: "#4A9FE8",
  Shoulders: "#E8B84A",
  Legs: "#7ABF3A",
  "Abs & Forearms": "#9A9A9A",
  Other: "#8A8A8A",
  Weight: "#A78BFA",
  Cardio: "#F35D8A",
};

// Older builds called this group "Abs, Wrist & Forearms". Stored plans and
// catalogs are mapped forward so history keeps the same color and totals.
export const MUSCLE_ALIASES = {
  "Abs, Wrist & Forearms": "Abs & Forearms",
};

const CARDIO_GROUP = {
  name: "Cardio",
  color: MUSCLE_COLORS.Cardio,
  get exercises() {
    return DEFAULT_CARDIO_CONFIG.map((c) => c.name);
  },
};

export const WEIGHT_GROUP = {
  name: "Weight",
  color: MUSCLE_COLORS.Weight,
  exercises: ["Body Weight"],
};

export function isWeightExercise(exerciseName) {
  return WEIGHT_GROUP.exercises.includes(exerciseName);
}

function strengthGroup(name, color, exercises) {
  return { name, color, exercises };
}

function makeWorkout(id, label, groups) {
  return { id, label, groups: [...groups, CARDIO_GROUP, WEIGHT_GROUP] };
}

export const DEFAULT_PLAN = {
  version: PLAN_VERSION,
  workouts: [
    makeWorkout("push", "Push", [
      strengthGroup("Chest", MUSCLE_COLORS.Chest, [
        "Bench Press (Barbell)",
        "Incline Bench Press (Dumbbell)",
        "Chest Fly (Machine)",
      ]),
      strengthGroup("Triceps", MUSCLE_COLORS.Triceps, [
        "Skullcrusher (Barbell)",
        "Tricep Rope Pushdowns",
      ]),
    ]),
    makeWorkout("pull", "Pull", [
      strengthGroup("Back", MUSCLE_COLORS.Back, [
        "Bent Over Row (Barbell)",
        "Lat Pulldown (Cable)",
        "Dumbbell Row",
      ]),
      strengthGroup("Biceps", MUSCLE_COLORS.Biceps, [
        "Bicep Curl (Cable)",
        "Seated Incline Curl (Dumbbell)",
      ]),
    ]),
    makeWorkout("legs", "Legs", [
      strengthGroup("Shoulders", MUSCLE_COLORS.Shoulders, [
        "Overhead Press (Barbell)",
        "Lateral Raise (Cable)",
      ]),
      strengthGroup("Legs", MUSCLE_COLORS.Legs, [
        "Leg Press (Machine)",
        "Leg Extension (Machine)",
        "Seated Leg Curl (Machine)",
        "Standing Calf Raise (Smith)",
      ]),
    ]),
    makeWorkout("upper", "Upper", [
      strengthGroup("Chest", MUSCLE_COLORS.Chest, [
        "Incline Bench Press (Barbell)",
        "Bench Press (Dumbbell)",
      ]),
      strengthGroup("Back", MUSCLE_COLORS.Back, [
        "Lat Pulldown - Close Grip (Cable)",
        "T Bar Row",
        "Landmine Row",
      ]),
      strengthGroup("Triceps", MUSCLE_COLORS.Triceps, [
        "Overhead Triceps Extension (Cable)",
      ]),
    ]),
    makeWorkout("lower", "Lower", [
      strengthGroup("Shoulders", MUSCLE_COLORS.Shoulders, [
        "Lateral Raise (Dumbbell)",
        "Rear Delt Reverse Fly (Cable)",
      ]),
      strengthGroup("Legs", MUSCLE_COLORS.Legs, [
        "Squats (Smith Machine)",
        "Romanian Deadlifts (Barbell)",
      ]),
      strengthGroup("Biceps", MUSCLE_COLORS.Biceps, [
        "Hammer Curl (Dumbbell)",
      ]),
      strengthGroup(
        "Abs & Forearms",
        MUSCLE_COLORS["Abs & Forearms"],
        [
          "Lying Leg Raise",
          "Reverse Wrist Curl (Dumbbell)",
        ],
      ),
    ]),
  ],
};

// Exercises that are measured by time rather than reps by default. Any
// exercise can still be switched to time tracking in Settings > Exercises.
export const DEFAULT_TIMED_EXERCISES = [];

// ---------------------------------------------------------------------------
// Plan helpers used by several screens
// ---------------------------------------------------------------------------

export function getWorkouts(plan) {
  if (!plan) return [];
  if (Array.isArray(plan.workouts)) return plan.workouts;
  if (Array.isArray(plan)) return plan;
  return [];
}

export function getWorkoutById(plan, workoutId) {
  if (!workoutId) return null;
  return getWorkouts(plan).find((workout) => workout.id === workoutId) || null;
}

export function getWorkoutIndex(plan, workoutId) {
  return getWorkouts(plan).findIndex((workout) => workout.id === workoutId);
}

export function getPlanMuscles(plan) {
  const muscles = [];
  getWorkouts(plan).forEach((workout) => {
    (workout.groups || []).forEach((group) => {
      if (group.name === "Cardio" || group.name === "Weight") return;
      if (!muscles.includes(group.name)) muscles.push(group.name);
    });
  });
  return muscles;
}

export function applyCardioConfigToPlan(plan, cardioConfig) {
  if (!plan || !cardioConfig) return plan;
  const result = JSON.parse(JSON.stringify(plan));
  getWorkouts(result).forEach((workout) => {
    const cardioGroup = (workout.groups || []).find((g) => g.name === "Cardio");
    if (cardioGroup) cardioGroup.exercises = cardioConfig.map((c) => c.name);
  });
  return result;
}

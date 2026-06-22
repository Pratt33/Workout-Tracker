export const DEFAULT_CARDIO_CONFIG = [
  { name: "Walking", metric: "steps+km", stepGoal: 10000 },
  { name: "Cycling", metric: "minutes+km" },
  { name: "Plank", metric: "minutes" },
];

export const PLAN_VERSION = 1;

// These functions accept an optional cardioConfig array.
// If not passed they fall back to DEFAULT_CARDIO_CONFIG.
// All screens should pass the loaded config from AsyncStorage.

export function isCardioExercise(exerciseName, config = DEFAULT_CARDIO_CONFIG) {
  return config.some((c) => c.name === exerciseName);
}

export function getCardioEntry(exerciseName, config = DEFAULT_CARDIO_CONFIG) {
  return config.find((c) => c.name === exerciseName) || null;
}

export function cardioHasDistance(
  exerciseName,
  config = DEFAULT_CARDIO_CONFIG,
) {
  const entry = getCardioEntry(exerciseName, config);
  return entry ? ["minutes+km", "steps+km"].includes(entry.metric) : false;
}

export function cardioHasSteps(exerciseName, config = DEFAULT_CARDIO_CONFIG) {
  const entry = getCardioEntry(exerciseName, config);
  return entry ? entry.metric === "steps+km" : false;
}

export function cardioMetric(exerciseName, config = DEFAULT_CARDIO_CONFIG) {
  const entry = getCardioEntry(exerciseName, config);
  return entry ? entry.metric : null;
}

const CARDIO_GROUP = {
  name: "Cardio",
  color: "#F35D8A",
  get exercises() {
    return DEFAULT_CARDIO_CONFIG.map((c) => c.name);
  },
};

export const WEIGHT_EXERCISES = ["Body Weight"];

export function isWeightExercise(exerciseName) {
  return WEIGHT_EXERCISES.includes(exerciseName);
}

const WEIGHT_GROUP = {
  name: "Weight",
  color: "#A78BFA",
  exercises: WEIGHT_EXERCISES,
};

export const PLAN = {
  1: {
    label: "Monday",
    groups: [
      {
        name: "Chest",
        color: "#7B72E8",
        exercises: [
          "Bench Press (Barbell)",
          "Incline Bench Press (Dumbbell)",
          "Machine Chest Press",
        ],
      },
      {
        name: "Triceps",
        color: "#E8724A",
        exercises: ["Skull Crushers", "Triceps Pressdown (Bar)"],
      },
      CARDIO_GROUP,
      WEIGHT_GROUP,
    ],
  },
  2: {
    label: "Tuesday",
    groups: [
      {
        name: "Back",
        color: "#2DBF8E",
        exercises: [
          "Lat Pulldown",
          "Cable Row",
          "Seated Row Machine (Vertical Grip)",
        ],
      },
      {
        name: "Biceps",
        color: "#4A9FE8",
        exercises: ["Dumbbell Preacher Curl", "Machine Bicep Curl"],
      },
      CARDIO_GROUP,
      WEIGHT_GROUP,
    ],
  },
  3: {
    label: "Wednesday",
    groups: [
      {
        name: "Shoulders",
        color: "#E8B84A",
        exercises: ["Machine Shoulder Press", "Lean Away DB Lateral Raise"],
      },
      {
        name: "Legs",
        color: "#7ABF3A",
        exercises: ["Leg Press", "Leg Extension", "Seated Leg Curl Machine"],
      },
      CARDIO_GROUP,
      WEIGHT_GROUP,
    ],
  },
  4: {
    label: "Thursday",
    groups: [
      {
        name: "Chest",
        color: "#7B72E8",
        exercises: [
          "Incline Bench Press (Barbell)",
          "Bench Press (Dumbbell)",
          "Pec Deck",
        ],
      },
      {
        name: "Triceps",
        color: "#E8724A",
        exercises: [
          "Overhead Tricep Extension (Bar)",
          "Machine Tricep Extension",
        ],
      },
      CARDIO_GROUP,
      WEIGHT_GROUP,
    ],
  },
  5: {
    label: "Friday",
    groups: [
      {
        name: "Back",
        color: "#2DBF8E",
        exercises: [
          "Seated Row Machine (Horizontal Grip)",
          "One Arm Dumbbell Row",
          "Straight-Arm Pulldown",
        ],
      },
      {
        name: "Biceps",
        color: "#4A9FE8",
        exercises: ["Barbell Curl", "Hammer Curl"],
      },
      CARDIO_GROUP,
      WEIGHT_GROUP,
    ],
  },
  6: {
    label: "Saturday",
    groups: [
      {
        name: "Shoulders",
        color: "#E8B84A",
        exercises: ["Reverse Pec Deck", "Machine Lateral Raise"],
      },
      { name: "Legs", color: "#7ABF3A", exercises: ["Squats"] },
      {
        name: "Abs, Wrist & Forearms",
        color: "#9A9A9A",
        exercises: [
          "Lying Leg Raise",
          "Wrist Curl (Dumbbell)",
          "Reverse Wrist Curl (Dumbbell)",
        ],
      },
      CARDIO_GROUP,
      WEIGHT_GROUP,
    ],
  },
  0: null,
};

export const MUSCLE_COLORS = {
  Chest: "#7B72E8",
  Triceps: "#E8724A",
  Back: "#2DBF8E",
  Biceps: "#4A9FE8",
  Shoulders: "#E8B84A",
  Legs: "#7ABF3A",
  "Abs, Wrist & Forearms": "#9A9A9A",
};

export const MUSCLES = Object.keys(MUSCLE_COLORS);

export function applyCardioConfigToPlan(plan, cardioConfig) {
  if (!plan || !cardioConfig) return plan;
  const result = JSON.parse(JSON.stringify(plan));
  Object.keys(result).forEach((dow) => {
    const day = result[dow];
    if (!day?.groups) return;
    const cardioGroup = day.groups.find((g) => g.name === "Cardio");
    if (cardioGroup) cardioGroup.exercises = cardioConfig.map((c) => c.name);
  });
  return result;
}

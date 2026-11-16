import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppLogo from "./AppLogo";
import {
  APP_VERSION,
  CARDIO_FIELD_OPTIONS,
  DEFAULT_CARDIO_CONFIG,
  DEFAULT_PLAN,
  MUSCLE_COLORS,
  PLAN_VERSION,
  applyCardioConfigToPlan,
  getWorkoutById,
  getWorkouts,
} from "./data";
import {
  todayKey,
  loadDayOverrides,
  saveDayOverride,
  loadCardioConfig,
  saveCardioConfig,
  resetCardioConfig,
  loadSessions,
  saveSessions,
  saveRestDay,
  loadRestDays,
  loadCustomPlan,
  saveCustomPlan,
  clearCustomPlan,
  loadCatalog,
  saveCatalog,
} from "./storage";
import {
  TRACKING_REPS,
  TRACKING_TIME,
  isTimedExercise,
} from "./catalog";
import { addDaysToKey, formatDate, parseDateKey } from "./dates";
import { getWorkoutForDate } from "./schedule";
import {
  createBackupJSON,
  restoreBackup,
} from "./backup";

const FIELD_LABELS = CARDIO_FIELD_OPTIONS.reduce((result, field) => {
  result[field.key] = `${field.label} (${field.unit})`;
  return result;
}, {});

// Muscle groups available when adding a strength exercise. Keep this in sync
// with MUSCLE_COLORS in data.js.
const STRENGTH_MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Abs & Forearms",
];

const MENU_ITEMS = [
  {
    id: "workout",
    title: "Workout",
    subtitle: "Choose today's workout or let rotation decide",
    icon: "calendar-outline",
  },
  {
    id: "restday",
    title: "Rest Days",
    subtitle: "Pick any 2 rest days each week",
    icon: "moon-outline",
  },
  {
    id: "cardio",
    title: "Cardio",
    subtitle: "Exercises and tracked metrics",
    icon: "heart-outline",
  },
  {
    id: "exercises",
    title: "Exercises",
    subtitle: "Edit templates, add exercises, reps or time",
    icon: "barbell-outline",
  },
  {
    id: "data",
    title: "Data",
    subtitle: "Backup and restore",
    icon: "server-outline",
  },
  {
    id: "about",
    title: "About",
    subtitle: "App version and release notes",
    icon: "information-circle-outline",
  },
];

const VIEW_TITLES = {
  menu: "Settings",
  workout: "Workout",
  restday: "Rest Days",
  cardio: "Cardio",
  exercises: "Exercises",
  data: "Data",
  about: "About",
};

const clone = (value) => JSON.parse(JSON.stringify(value));

function makeRowId() {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeCardioId(name) {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${slug || "cardio"}_${Date.now().toString(36)}`;
}

function createPlanDraft(plan, catalog) {
  return {
    workouts: getWorkouts(plan).map((workout) => ({
      id: workout.id,
      label: workout.label,
      groups: (workout.groups || []).map((group) => {
        const editable = group.name !== "Cardio" && group.name !== "Weight";
        return {
          name: group.name,
          color: group.color,
          editable,
          exercises: (group.exercises || []).map((exercise, index) => ({
            rowId: `${workout.id}:${group.name}:${index}:${exercise}`,
            originalName: exercise,
            name: exercise,
            timed: editable && isTimedExercise(exercise, catalog),
          })),
        };
      }),
    })),
  };
}

function collectDraftRowsFrom(draft) {
  return draft.workouts.flatMap((workout) =>
    workout.groups
      .filter((group) => group.editable)
      .flatMap((group) =>
        group.exercises.map((row) => ({
          ...row,
          muscle: group.name,
          workoutId: workout.id,
        })),
      ),
  );
}

function buildPlanFromDraft(draft, cardioConfig, sourcePlan) {
  const sourceById = new Map(
    getWorkouts(sourcePlan).map((workout) => [workout.id, workout]),
  );
  const cardioNames = cardioConfig.map((entry) => entry.name);

  return {
    version: PLAN_VERSION,
    workouts: draft.workouts.map((workout) => {
      const source = sourceById.get(workout.id);
      const sourceGroups = source?.groups || [];
      const cardioGroup = sourceGroups.find((group) => group.name === "Cardio");
      const weightGroup = sourceGroups.find((group) => group.name === "Weight");

      const strengthGroups = workout.groups
        .filter((group) => group.editable)
        .map((group) => ({
          name: group.name,
          color: group.color || MUSCLE_COLORS[group.name] || MUSCLE_COLORS.Other,
          exercises: group.exercises
            .map((row) => row.name.trim())
            .filter(Boolean),
        }))
        .filter((group) => group.exercises.length > 0);

      const groups = [...strengthGroups];
      groups.push(
        cardioGroup
          ? { ...cardioGroup, exercises: cardioNames }
          : {
              name: "Cardio",
              color: MUSCLE_COLORS.Cardio,
              exercises: cardioNames,
            },
      );
      groups.push(
        weightGroup
          ? { ...weightGroup }
          : {
              name: "Weight",
              color: MUSCLE_COLORS.Weight,
              exercises: ["Body Weight"],
            },
      );

      return {
        id: workout.id,
        label: workout.label.trim() || workout.id,
        groups,
      };
    }),
  };
}

function mergeSessionValues(existing, incoming) {
  if (Array.isArray(existing) || Array.isArray(incoming)) {
    return [
      ...(Array.isArray(existing) ? existing : []),
      ...(Array.isArray(incoming) ? incoming : []),
    ];
  }
  if (
    existing &&
    typeof existing === "object" &&
    incoming &&
    typeof incoming === "object"
  ) {
    return { ...incoming, ...existing };
  }
  return incoming ?? existing;
}

function applyRenamesToSessions(sessions, renameMap) {
  const next = clone(sessions || {});
  let changed = false;

  Object.keys(next).forEach((dateKey) => {
    const session = next[dateKey];
    if (!session || typeof session !== "object" || Array.isArray(session)) {
      return;
    }

    const rebuilt = {};
    Object.entries(session).forEach(([key, value]) => {
      if (key.startsWith("_")) {
        rebuilt[key] = value;
        return;
      }
      const target = renameMap[key] || key;
      if (target !== key) changed = true;
      if (Object.prototype.hasOwnProperty.call(rebuilt, target)) {
        rebuilt[target] = mergeSessionValues(rebuilt[target], value);
      } else {
        rebuilt[target] = value;
      }
    });
    next[dateKey] = rebuilt;
  });

  return { sessions: next, changed };
}

function entryHasLoggedData(sessions, entry) {
  const keys = [entry?.id, entry?.name].filter(Boolean);
  if (!keys.length) return false;

  return Object.values(sessions || {}).some((session) => {
    if (!session || typeof session !== "object" || Array.isArray(session)) {
      return false;
    }
    return keys.some((key) => {
      const value = session[key];
      if (value == null) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") {
        return Object.values(value).some(
          (field) => String(field ?? "").trim() !== "",
        );
      }
      return String(value).trim() !== "";
    });
  });
}

export default function SettingsModal({
  visible,
  onClose,
  onChanged,
  theme: t,
  dateKey = todayKey(),
}) {
  const [view, setView] = useState("menu");
  const [busy, setBusy] = useState(false);
  const [restDays, setRestDays] = useState({});
  const [assignments, setAssignments] = useState({});
  const [sessions, setSessions] = useState({});
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [catalog, setCatalog] = useState({});
  const [cardioConfig, setCardioConfig] = useState(DEFAULT_CARDIO_CONFIG);
  const [exerciseDraft, setExerciseDraft] = useState(
    createPlanDraft(DEFAULT_PLAN, {}),
  );
  const [expandedWorkouts, setExpandedWorkouts] = useState({});
  const [addExerciseDraft, setAddExerciseDraft] = useState(null);
  const [editingCardio, setEditingCardio] = useState(false);
  const [cardioDraft, setCardioDraft] = useState([]);
  const [importText, setImportText] = useState("");

  const loadData = useCallback(async () => {
    const [
      savedRestDays,
      customPlan,
      savedAssignments,
      savedCardio,
      savedSessions,
      savedCatalog,
    ] = await Promise.all([
      loadRestDays(),
      loadCustomPlan(),
      loadDayOverrides(),
      loadCardioConfig(),
      loadSessions(),
      loadCatalog(),
    ]);

    const liveConfig =
      Array.isArray(savedCardio) && savedCardio.length > 0
        ? savedCardio
        : DEFAULT_CARDIO_CONFIG;
    const livePlan = applyCardioConfigToPlan(
      customPlan && customPlan.workouts ? customPlan : DEFAULT_PLAN,
      liveConfig,
    );
    const liveCatalog = savedCatalog || {};

    setRestDays(savedRestDays || {});
    setAssignments(savedAssignments || {});
    setSessions(savedSessions || {});
    setCatalog(liveCatalog);
    setPlan(livePlan);
    setCardioConfig(liveConfig);
    setExerciseDraft(createPlanDraft(livePlan, liveCatalog));
  }, []);

  useEffect(() => {
    if (!visible) return;
    setView("menu");
    setImportText("");
    setBusy(false);
    setEditingCardio(false);
    setCardioDraft([]);
    setAddExerciseDraft(null);
    loadData();
  }, [visible, dateKey, loadData]);

  const refreshAfterChange = useCallback(async () => {
    await loadData();
    if (onChanged) await onChanged();
  }, [loadData, onChanged]);

  const toggleRestDay = async (key, value) => {
    setBusy(true);
    try {
      await saveRestDay(key, value);
      await refreshAfterChange();
    } catch {
      Alert.alert("Could not update rest day", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const selectWorkout = async (workoutId) => {
    setBusy(true);
    try {
      await saveDayOverride(dateKey, workoutId);
      await refreshAfterChange();
    } catch {
      Alert.alert("Could not update workout", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const weekDays = useMemo(() => {
    const date = parseDateKey(dateKey);
    if (!date) return [];
    const mondayOffset = (date.getDay() + 6) % 7;
    const monday = addDaysToKey(dateKey, -mondayOffset);
    return Array.from({ length: 7 }, (_, index) => {
      const key = addDaysToKey(monday, index);
      const dayDate = parseDateKey(key);
      return {
        key,
        label: formatDate(key, { weekday: "short" }),
        day: dayDate ? dayDate.getDate() : "",
        isRest: !!restDays[key],
      };
    });
  }, [dateKey, restDays]);

  const restCount = weekDays.filter((day) => day.isRest).length;
  const workoutContext = getWorkoutForDate(
    plan,
    sessions,
    assignments,
    dateKey,
  );
  const activeAssignment = getWorkoutById(plan, assignments[dateKey])
    ? assignments[dateKey]
    : null;

  const updateDraftWorkout = (workoutId, updater) => {
    setExerciseDraft((previous) => ({
      ...previous,
      workouts: previous.workouts.map((workout) =>
        workout.id === workoutId ? updater(workout) : workout,
      ),
    }));
  };

  const updateWorkoutLabel = (workoutId, value) => {
    updateDraftWorkout(workoutId, (workout) => ({
      ...workout,
      label: value,
    }));
  };

  const updateDraftGroup = (workoutId, groupName, updater) => {
    updateDraftWorkout(workoutId, (workout) => ({
      ...workout,
      groups: workout.groups.map((group) =>
        group.name === groupName ? updater(group) : group,
      ),
    }));
  };

  const updateDraftExercise = (workoutId, groupName, rowId, patch) => {
    updateDraftGroup(workoutId, groupName, (group) => ({
      ...group,
      exercises: group.exercises.map((row) =>
        row.rowId === rowId ? { ...row, ...patch } : row,
      ),
    }));
  };

  const addDraftExerciseAt = (workoutId, muscleName, name, timed) => {
    updateDraftWorkout(workoutId, (workout) => {
      const row = {
        rowId: makeRowId(),
        originalName: null,
        name,
        timed,
      };
      const existing = workout.groups.find(
        (group) => group.editable && group.name === muscleName,
      );
      if (existing) {
        return {
          ...workout,
          groups: workout.groups.map((group) =>
            group === existing
              ? { ...group, exercises: [...group.exercises, row] }
              : group,
          ),
        };
      }

      // A workout can gain a new muscle group at any time (for example adding
      // Wrist Curls to Push). Insert it before Cardio/Weight so the editable
      // muscle blocks stay together.
      const newGroup = {
        name: muscleName,
        color: MUSCLE_COLORS[muscleName] || MUSCLE_COLORS.Other,
        editable: true,
        exercises: [row],
      };
      const insertAt = workout.groups.findIndex((group) => !group.editable);
      const groups = [...workout.groups];
      groups.splice(insertAt === -1 ? groups.length : insertAt, 0, newGroup);
      return { ...workout, groups };
    });
  };

  const openAddExercise = (workout) => {
    const firstGroup = workout.groups.find((group) => group.editable);
    setAddExerciseDraft({
      workoutId: workout.id,
      name: "",
      muscle: firstGroup?.name || STRENGTH_MUSCLES[0],
      timed: false,
    });
    setExpandedWorkouts((previous) => ({
      ...previous,
      [workout.id]: true,
    }));
  };

  const confirmAddExercise = () => {
    const draft = addExerciseDraft;
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      Alert.alert("Exercise name required", "Enter a name for the new exercise.");
      return;
    }

    const workout = exerciseDraft.workouts.find(
      (item) => item.id === draft.workoutId,
    );
    if (!workout) return;

    const normalized = name.toLowerCase();
    const duplicate = workout.groups
      .filter((group) => group.editable)
      .some((group) =>
        group.exercises.some(
          (row) => row.name.trim().toLowerCase() === normalized,
        ),
      );
    if (duplicate) {
      Alert.alert(
        "Already in this workout",
        `"${name}" is already in ${workout.label}.`,
      );
      return;
    }

    const reserved = new Set([
      "body weight",
      ...cardioConfig.map((entry) =>
        String(entry.name || "").trim().toLowerCase(),
      ),
    ]);
    if (reserved.has(normalized)) {
      Alert.alert(
        "Reserved name",
        `"${name}" is used by cardio or body weight. Pick a different name.`,
      );
      return;
    }

    addDraftExerciseAt(draft.workoutId, draft.muscle, name, draft.timed);
    setAddExerciseDraft(null);
  };

  const removeDraftExercise = (workoutId, groupName, rowId) => {
    updateDraftGroup(workoutId, groupName, (group) => ({
      ...group,
      exercises: group.exercises.filter((row) => row.rowId !== rowId),
    }));
  };

  const collectDraftRows = () => collectDraftRowsFrom(exerciseDraft);

  const saveExercises = async () => {
    setBusy(true);
    try {
      const rows = collectDraftRows();
      if (rows.some((row) => !row.name.trim())) {
        Alert.alert(
          "Empty exercise name",
          "Every exercise needs a name, or remove the row.",
        );
        return;
      }

      // Cardio and body-weight entries are resolved before strength exercises,
      // so a strength exercise must never take one of their names.
      const reservedNames = new Set([
        "body weight",
        ...cardioConfig.map((entry) => String(entry.name || "").trim().toLowerCase()),
      ]);
      const reservedHit = rows.find((row) =>
        reservedNames.has(row.name.trim().toLowerCase()),
      );
      if (reservedHit) {
        Alert.alert(
          "Reserved name",
          `"${reservedHit.name.trim()}" is used by cardio or body weight. Pick a different name.`,
        );
        return;
      }

      // Exercise identity is global. If the same exercise appears in several
      // workouts, every occurrence must be renamed together.
      const namesByOriginal = {};
      rows.forEach((row) => {
        if (!row.originalName) return;
        if (!namesByOriginal[row.originalName]) {
          namesByOriginal[row.originalName] = new Set();
        }
        namesByOriginal[row.originalName].add(row.name.trim());
      });
      const conflict = Object.entries(namesByOriginal).find(
        ([, targets]) => targets.size > 1,
      );
      if (conflict) {
        Alert.alert(
          "Same exercise, different names",
          `"${conflict[0]}" appears in multiple workouts. Give every copy the same new name.`,
        );
        return;
      }

      const renameMap = {};
      Object.entries(namesByOriginal).forEach(([original, targets]) => {
        const [target] = Array.from(targets);
        if (target && target !== original) renameMap[original] = target;
      });

      const effectiveDraft = {
        workouts: exerciseDraft.workouts.map((workout) => ({
          ...workout,
          groups: workout.groups.map((group) => ({
            ...group,
            exercises: group.exercises.map((row) => {
              const renamed = row.originalName
                ? renameMap[row.originalName]
                : null;
              return renamed ? { ...row, name: renamed } : row;
            }),
          })),
        })),
      };
      const finalRows = collectDraftRowsFrom(effectiveDraft);

      // Muscle and tracking are global per exercise, because an exercise keeps
      // one identity everywhere it appears. The same name may repeat across
      // workouts, but it must resolve to the same muscle and tracking type.
      const rowsByName = new Map();
      const spellingsByKey = new Map();
      finalRows.forEach((row) => {
        const name = row.name.trim();
        const key = name.toLowerCase();
        if (!rowsByName.has(key)) rowsByName.set(key, []);
        rowsByName.get(key).push(row);
        if (!spellingsByKey.has(key)) spellingsByKey.set(key, new Set());
        spellingsByKey.get(key).add(name);
      });
      const inconsistentSpelling = Array.from(spellingsByKey.entries()).find(
        ([, spellings]) => spellings.size > 1,
      );
      if (inconsistentSpelling) {
        Alert.alert(
          "Same exercise, different capitalization",
          `"${Array.from(inconsistentSpelling[1]).join('" and "')}" are the same exercise. Use one spelling everywhere.`,
        );
        return;
      }
      const inconsistent = Array.from(rowsByName.values()).find((group) => {
        const muscles = new Set(group.map((row) => row.muscle));
        const tracking = new Set(
          group.map((row) => (row.timed ? TRACKING_TIME : TRACKING_REPS)),
        );
        return muscles.size > 1 || tracking.size > 1;
      });
      if (inconsistent) {
        Alert.alert(
          "Same exercise, different settings",
          `"${inconsistent[0].name.trim()}" appears in more than one workout with a different muscle or tracking type. Use the same muscle and tracking everywhere.`,
        );
        return;
      }

      // Different exercises may not collapse into the same final name.
      const finalToOriginals = new Map();
      rows.forEach((row) => {
        if (!row.originalName) return;
        const finalName = row.name.trim();
        if (!finalToOriginals.has(finalName)) {
          finalToOriginals.set(finalName, new Set());
        }
        finalToOriginals.get(finalName).add(row.originalName);
      });
      const nameCollision = Array.from(finalToOriginals.entries()).find(
        ([, origins]) => origins.size > 1,
      );
      if (nameCollision) {
        Alert.alert(
          "Two exercises would share a name",
          `"${nameCollision[0]}" is already used by a different exercise. Pick a unique name.`,
        );
        return;
      }

      // The same exercise may repeat across workouts (Squats in Legs and Lower),
      // but it should not appear twice inside one workout.
      const repeatedWithinWorkout = exerciseDraft.workouts
        .map((workout) => {
          const counts = {};
          workout.groups
            .filter((group) => group.editable)
            .forEach((group) => {
              group.exercises.forEach((row) => {
                const name = row.name.trim().toLowerCase();
                if (name) counts[name] = (counts[name] || 0) + 1;
              });
            });
          return Object.keys(counts).find((name) => counts[name] > 1);
        })
        .find(Boolean);
      if (repeatedWithinWorkout) {
        Alert.alert(
          "Exercise added twice",
          `"${repeatedWithinWorkout}" appears more than once in the same workout.`,
        );
        return;
      }

      const nextPlan = buildPlanFromDraft(
        effectiveDraft,
        cardioConfig,
        plan,
      );
      const strengthCount = nextPlan.workouts.reduce(
        (total, workout) =>
          total +
          workout.groups
            .filter(
              (group) => group.name !== "Cardio" && group.name !== "Weight",
            )
            .reduce(
              (groupTotal, group) =>
                groupTotal + (group.exercises || []).length,
              0,
            ),
        0,
      );
      if (strengthCount === 0) {
        Alert.alert(
          "No exercises",
          "Keep at least one strength exercise in your plan.",
        );
        return;
      }

      if (Object.keys(renameMap).length > 0) {
        const renamed = applyRenamesToSessions(sessions, renameMap);
        if (renamed.changed) {
          await saveSessions(renamed.sessions);
          setSessions(renamed.sessions);
        }
      }

      const nextCatalog = {};
      Object.entries(catalog).forEach(([name, entry]) => {
        nextCatalog[renameMap[name] || name] = entry;
      });
      finalRows.forEach((row) => {
        const name = row.name.trim();
        const existing = nextCatalog[name] || {};
        nextCatalog[name] = {
          ...existing,
          muscle: row.muscle,
          tracking: row.timed ? TRACKING_TIME : TRACKING_REPS,
        };
      });

      await saveCatalog(nextCatalog);
      await saveCustomPlan(nextPlan);
      await refreshAfterChange();
      setAddExerciseDraft(null);
      Alert.alert(
        "Exercises saved",
        "Templates updated. Renamed exercises keep their full history.",
      );
    } catch {
      Alert.alert("Could not save exercises", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resetExercises = () => {
    Alert.alert(
      "Restore default templates?",
      "This restores the default 5-workout PPL-UL templates with at least 5 starter exercises each. Your history is not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await clearCustomPlan();
              await refreshAfterChange();
              setAddExerciseDraft(null);
              Alert.alert("Templates restored", "Default exercises are back.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const startCardioEditing = () => {
    setCardioDraft(
      cardioConfig.map((entry) => ({
        id: entry.id || makeCardioId(entry.name),
        originalName: entry.name,
        name: entry.name,
        fields:
          Array.isArray(entry.fields) && entry.fields.length > 0
            ? [...entry.fields]
            : ["duration"],
      })),
    );
    setEditingCardio(true);
  };

  const updateCardioDraft = (index, patch) => {
    setCardioDraft((previous) =>
      previous.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const toggleCardioField = (index, fieldKey) => {
    setCardioDraft((previous) =>
      previous.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        const hasField = entry.fields.includes(fieldKey);
        const fields = hasField
          ? entry.fields.filter((field) => field !== fieldKey)
          : [...entry.fields, fieldKey];
        return {
          ...entry,
          fields: CARDIO_FIELD_OPTIONS.map((field) => field.key).filter(
            (key) => fields.includes(key),
          ),
        };
      }),
    );
  };

  const addCardioDraft = () => {
    setCardioDraft((previous) => [
      ...previous,
      {
        id: makeCardioId("cardio"),
        originalName: null,
        name: "",
        fields: ["duration"],
      },
    ]);
  };

  const removeCardioDraft = (index) => {
    if (cardioDraft.length <= 1) {
      Alert.alert(
        "Keep one cardio exercise",
        "Add another cardio exercise before removing the last one.",
      );
      return;
    }
    setCardioDraft((previous) =>
      previous.filter((_, entryIndex) => entryIndex !== index),
    );
  };

  const saveCardio = async () => {
    setBusy(true);
    try {
      const names = cardioDraft.map((entry) => entry.name.trim());
      if (names.some((name) => !name)) {
        Alert.alert("Empty name", "Every cardio exercise needs a name.");
        return;
      }
      if (new Set(names).size !== names.length) {
        Alert.alert(
          "Duplicate names",
          "Each cardio exercise needs a unique name.",
        );
        return;
      }
      if (cardioDraft.some((entry) => entry.fields.length === 0)) {
        Alert.alert(
          "No metric selected",
          "Choose at least one metric for every cardio exercise.",
        );
        return;
      }

      const keptOriginals = new Set(
        cardioDraft
          .map((entry) => entry.originalName)
          .filter((name) => !!name),
      );
      const removed = cardioConfig.filter(
        (entry) => !keptOriginals.has(entry.name),
      );
      const blocked = removed.find((entry) =>
        entryHasLoggedData(sessions, entry),
      );
      if (blocked) {
        Alert.alert(
          "Can't remove logged cardio",
          `${blocked.name} has logged data. Keep it, or remove its history first from the History tab.`,
        );
        return;
      }

      const renameMap = {};
      cardioDraft.forEach((entry) => {
        const nextName = entry.name.trim();
        if (entry.originalName && entry.originalName !== nextName) {
          renameMap[entry.originalName] = nextName;
        }
      });

      if (Object.keys(renameMap).length > 0) {
        const renamed = applyRenamesToSessions(sessions, renameMap);
        if (renamed.changed) {
          await saveSessions(renamed.sessions);
          setSessions(renamed.sessions);
        }
      }

      const nextConfig = cardioDraft.map((entry) => {
        const name = entry.name.trim();
        return {
          id: entry.id || makeCardioId(name),
          name,
          fields: entry.fields,
        };
      });

      await saveCardioConfig(nextConfig);
      const nextPlan = applyCardioConfigToPlan(plan, nextConfig);
      await saveCustomPlan(nextPlan);

      setCardioConfig(nextConfig);
      setPlan(nextPlan);
      setExerciseDraft(createPlanDraft(nextPlan, catalog));
      setEditingCardio(false);
      setCardioDraft([]);
      if (onChanged) await onChanged();
      Alert.alert("Cardio saved", "Metrics updated for future logs.");
    } catch {
      Alert.alert("Could not save cardio", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resetCardio = () => {
    Alert.alert(
      "Reset cardio?",
      "This restores Walking and Plank with their default metrics.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await resetCardioConfig();
              const nextPlan = applyCardioConfigToPlan(
                plan,
                DEFAULT_CARDIO_CONFIG,
              );
              await saveCustomPlan(nextPlan);
              setCardioConfig(DEFAULT_CARDIO_CONFIG);
              setPlan(nextPlan);
              setEditingCardio(false);
              setCardioDraft([]);
              if (onChanged) await onChanged();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const exportBackup = async () => {
    setBusy(true);
    try {
      const json = await createBackupJSON();
      await Share.share({
        title: "Workout Tracker backup",
        message: json,
      });
    } catch {
      Alert.alert(
        "Export failed",
        "Could not create the backup. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const importBackup = () => {
    if (!importText.trim()) {
      Alert.alert("Nothing to restore", "Paste a backup JSON first.");
      return;
    }
    Alert.alert(
      "Replace all data?",
      "Restoring a backup replaces your current sessions, plan, cardio settings, and rest days. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const result = await restoreBackup(importText);
              setImportText("");
              await loadData();
              if (onChanged) await onChanged();
              Alert.alert(
                "Backup restored",
                `${result.sessionCount} session${
                  result.sessionCount === 1 ? "" : "s"
                } restored.`,
              );
            } catch (error) {
              Alert.alert(
                "Restore failed",
                error?.message || "Could not read that backup.",
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const renderMenu = () => (
    <View style={[s.menu, { borderColor: t.border, backgroundColor: t.surface }]}>
      {MENU_ITEMS.map((item, index) => (
        <TouchableOpacity
          key={item.id}
          style={[
            s.menuRow,
            index > 0 && { borderTopWidth: 0.5, borderTopColor: t.border },
          ]}
          onPress={() => setView(item.id)}
          activeOpacity={0.7}
        >
          <View
            style={[
              s.menuIcon,
              { backgroundColor: t.inputBg, borderColor: t.border },
            ]}
          >
            <Ionicons name={item.icon} size={18} color={t.accent} />
          </View>
          <View style={s.menuText}>
            <Text style={[s.menuTitle, { color: t.text }]}>{item.title}</Text>
            <Text style={[s.menuSub, { color: t.textSub }]}>
              {item.subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.textHint} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderWorkout = () => (
    <View
      style={[s.section, { borderColor: t.border, backgroundColor: t.surface }]}
    >
      <Text style={[s.sectionTitle, { color: t.text }]}>Workout for this day</Text>
      <View
        style={[
          s.currentRow,
          { borderTopColor: t.border, backgroundColor: t.inputBg },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.currentLabel, { color: t.textSub }]}>Current</Text>
          <Text style={[s.currentValue, { color: t.text }]}>
            {workoutContext.workout?.label || "No workout preset"}
          </Text>
        </View>
        <View
          style={[
            s.sourceBadge,
            { borderColor: t.border, backgroundColor: t.surface },
          ]}
        >
          <Text style={[s.sourceBadgeText, { color: t.textSub }]}>
            {workoutContext.source === "explicit"
              ? "Chosen"
              : workoutContext.source === "assigned"
                ? "Planned"
                : workoutContext.source === "logged"
                  ? "Logged"
                  : "Rotation"}
          </Text>
        </View>
      </View>

      <View style={s.overrideWrap}>
        <TouchableOpacity
          style={[
            s.overrideBtn,
            { borderColor: t.border, backgroundColor: t.inputBg },
            activeAssignment === null && {
              borderColor: t.accent,
              backgroundColor: t.accent,
            },
          ]}
          onPress={() => selectWorkout(null)}
          disabled={busy}
        >
          <Text
            style={[
              s.overrideBtnText,
              { color: activeAssignment === null ? "#fff" : t.text },
            ]}
          >
            Auto
          </Text>
        </TouchableOpacity>
        {getWorkouts(plan).map((workout) => {
          const selected = activeAssignment === workout.id;
          return (
            <TouchableOpacity
              key={workout.id}
              style={[
                s.overrideBtn,
                { borderColor: t.border, backgroundColor: t.inputBg },
                selected && {
                  borderColor: t.accent,
                  backgroundColor: t.accent,
                },
              ]}
              onPress={() => selectWorkout(workout.id)}
              disabled={busy}
            >
              <Text
                style={[
                  s.overrideBtnText,
                  { color: selected ? "#fff" : t.text },
                ]}
              >
                {workout.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.infoText, { color: t.textSub }]}>
        Auto follows your last logged workout in the order Push, Pull, Legs,
        Upper, Lower. Rest days do not skip a workout. If your last logged
        workout was 7 or more days ago, the rotation restarts at Push.
      </Text>

      {workoutContext.source === "logged" && (
        <Text style={[s.infoText, { color: t.textHint }]}>
          This day is already logged, so it keeps{" "}
          {workoutContext.workout?.label || "its saved workout"}. Changing the
          selection only applies to future logs on this date.
        </Text>
      )}

      {activeAssignment !== null && (
        <TouchableOpacity
          style={[
            s.clearOverrideBtn,
            { borderTopColor: t.border, backgroundColor: t.inputBg },
          ]}
          onPress={() => selectWorkout(null)}
          disabled={busy}
        >
          <Text style={[s.resetText, { color: t.textSub }]}>
            Clear selection and use rotation
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderRestDays = () => (
    <>
      <View
        style={[
          s.section,
          { borderColor: t.border, backgroundColor: t.surface },
        ]}
      >
        <Text style={[s.sectionTitle, { color: t.text }]}>This week</Text>
        <Text style={[s.infoText, { color: t.textSub, marginTop: -4 }]}>
          Tap any day to make it rest. You can choose any 2 days — the rotation
          simply continues on your next training day.
        </Text>
        <View style={s.weekRow}>
          {weekDays.map((day) => (
            <TouchableOpacity
              key={day.key}
              style={[
                s.weekDay,
                {
                  borderColor: day.isRest ? t.accent : t.border,
                  backgroundColor: day.isRest ? t.accent : t.inputBg,
                },
              ]}
              onPress={() => toggleRestDay(day.key, !day.isRest)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`${day.label} ${day.day}, ${
                day.isRest ? "rest day" : "training day"
              }`}
            >
              <Text
                style={[
                  s.weekDayLabel,
                  { color: day.isRest ? "#fff" : t.textSub },
                ]}
              >
                {day.label}
              </Text>
              <Text
                style={[
                  s.weekDayNum,
                  { color: day.isRest ? "#fff" : t.text },
                ]}
              >
                {day.day}
              </Text>
              <View
                style={[
                  s.weekDayDot,
                  {
                    backgroundColor: day.isRest
                      ? "#fff"
                      : day.key === dateKey
                        ? t.accent
                        : "transparent",
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
        <View style={[s.row, { borderTopColor: t.border }]}>
          <Text style={[s.rowText, { color: t.text }]}>Rest days this week</Text>
          <Text
            style={[
              s.rowValue,
              { color: restCount === 2 ? t.success : t.accent },
            ]}
          >
            {restCount}
          </Text>
        </View>
        <Text style={[s.infoText, { color: t.textHint }]}>
          Marking a rest day does not reduce volume or break progress. Log a
          workout on that date any time and the rest mark is removed.
        </Text>
      </View>
    </>
  );

  const renderCardio = () => (
    <View
      style={[s.section, { borderColor: t.border, backgroundColor: t.surface }]}
    >
      <View style={s.sectionHeaderRow}>
        <Text
          style={[s.sectionTitle, s.sectionTitleInline, { color: t.text }]}
        >
          Cardio exercises
        </Text>
        {!editingCardio && (
          <TouchableOpacity
            style={[
              s.editLinkBtn,
              { borderColor: t.border, backgroundColor: t.inputBg },
            ]}
            onPress={startCardioEditing}
          >
            <Text style={[s.editLinkText, { color: t.accent }]}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {!editingCardio ? (
        <>
          {cardioConfig.map((entry) => (
            <View
              key={entry.id || entry.name}
              style={[s.cardioListRow, { borderTopColor: t.border }]}
            >
              <Text style={[s.cardioListName, { color: t.text }]}>
                {entry.name}
              </Text>
              <Text style={[s.cardioListSub, { color: t.textSub }]}>
                {(entry.fields || ["duration"])
                  .map((field) => FIELD_LABELS[field] || field)
                  .join(" · ")}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            style={[
              s.resetBtn,
              {
                borderColor: t.border,
                backgroundColor: t.inputBg,
                marginHorizontal: 14,
              },
            ]}
            onPress={resetCardio}
            disabled={busy}
          >
            <Text style={[s.resetText, { color: t.textSub }]}>
              Reset to defaults
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {cardioDraft.map((entry, index) => (
            <View
              key={`${entry.id}-${index}`}
              style={[s.cardioEditRow, { borderTopColor: t.border }]}
            >
              <View style={s.cardioEditTopRow}>
                <TextInput
                  style={[
                    s.cardioNameInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: t.border,
                      color: t.text,
                    },
                  ]}
                  value={entry.name}
                  onChangeText={(value) =>
                    updateCardioDraft(index, { name: value })
                  }
                  placeholder="Exercise name"
                  placeholderTextColor={t.textHint}
                />
                <TouchableOpacity
                  style={[
                    s.cardioDeleteBtn,
                    { borderColor: t.border, backgroundColor: t.inputBg },
                  ]}
                  onPress={() => removeCardioDraft(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${entry.name || "cardio exercise"}`}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={t.destructiveColor}
                  />
                </TouchableOpacity>
              </View>

              <View style={s.fieldChipRow}>
                {CARDIO_FIELD_OPTIONS.map((field) => {
                  const selected = entry.fields.includes(field.key);
                  return (
                    <TouchableOpacity
                      key={field.key}
                      style={[
                        s.fieldChip,
                        {
                          borderColor: selected ? t.accent : t.border,
                          backgroundColor: selected ? t.accent : t.inputBg,
                        },
                      ]}
                      onPress={() => toggleCardioField(index, field.key)}
                    >
                      <Text
                        style={[
                          s.fieldChipText,
                          { color: selected ? "#fff" : t.textSub },
                        ]}
                      >
                        {field.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[
              s.addCardioBtn,
              { borderColor: t.border, backgroundColor: t.inputBg },
            ]}
            onPress={addCardioDraft}
          >
            <Ionicons name="add" size={16} color={t.accent} />
            <Text style={[s.addCardioText, { color: t.accent }]}>
              Add cardio exercise
            </Text>
          </TouchableOpacity>

          <View style={s.actionRow}>
            <TouchableOpacity
              style={[
                s.cancelBtn,
                { borderColor: t.border, backgroundColor: t.inputBg },
              ]}
              onPress={() => {
                setEditingCardio(false);
                setCardioDraft([]);
              }}
              disabled={busy}
            >
              <Text style={[s.cancelText, { color: t.textSub }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.saveBtn,
                { backgroundColor: t.accent },
                busy && { opacity: 0.6 },
              ]}
              onPress={saveCardio}
              disabled={busy}
            >
              <Text style={[s.saveText, { color: t.accentText }]}>
                Save cardio
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const renderExercises = () => (
    <>
      <View
        style={[
          s.section,
          { borderColor: t.border, backgroundColor: t.surface },
        ]}
      >
        <View style={s.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[s.sectionTitle, s.sectionTitleInline, { color: t.text }]}
            >
              Edit workout templates
            </Text>
            <Text style={[s.sectionSub, { color: t.textSub }]}>
              Each workout starts with 5 or more exercises. Add more to any
              workout and remove any of them later. Changes apply when you tap
              Save. Renames update every workout and all past sessions.
            </Text>
          </View>
        </View>
        <View style={[s.actionRow, { marginTop: 0, paddingHorizontal: 14 }]}>
          <TouchableOpacity
            style={[
              s.cancelBtn,
              { borderColor: t.border, backgroundColor: t.inputBg },
            ]}
            onPress={() => {
              setAddExerciseDraft(null);
              setExerciseDraft(createPlanDraft(plan, catalog));
            }}
            disabled={busy}
          >
            <Text style={[s.cancelText, { color: t.textSub }]}>
              Discard changes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.saveBtn,
              { backgroundColor: t.accent },
              busy && { opacity: 0.6 },
            ]}
            onPress={saveExercises}
            disabled={busy}
          >
            <Text style={[s.saveText, { color: t.accentText }]}>
              Save exercises
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {exerciseDraft.workouts.map((workout) => {
        const expanded = !!expandedWorkouts[workout.id];
        const exerciseCount = workout.groups
          .filter((group) => group.editable)
          .reduce(
            (total, group) => total + group.exercises.length,
            0,
          );
        const muscleOptions = Array.from(
          new Set([
            ...workout.groups
              .filter((group) => group.editable)
              .map((group) => group.name),
            ...STRENGTH_MUSCLES,
          ]),
        );

        return (
          <View
            key={workout.id}
            style={[
              s.section,
              { borderColor: t.border, backgroundColor: t.surface },
            ]}
          >
            <TouchableOpacity
              style={[s.dayHeader, { backgroundColor: t.inputBg }]}
              onPress={() =>
                setExpandedWorkouts((previous) => ({
                  ...previous,
                  [workout.id]: !previous[workout.id],
                }))
              }
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.dayTitle, { color: t.text }]}>
                  {workout.label || workout.id}
                </Text>
                <Text style={[s.daySub, { color: t.textSub }]}>
                  {exerciseCount} strength exercise
                  {exerciseCount === 1 ? "" : "s"}
                </Text>
              </View>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={t.textSub}
              />
            </TouchableOpacity>

            {expanded && (
              <View style={s.dayBody}>
                <Text style={[s.fieldLabel, { color: t.textSub }]}>
                  Workout name
                </Text>
                <TextInput
                  style={[
                    s.exerciseInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: t.border,
                      color: t.text,
                    },
                  ]}
                  value={workout.label}
                  onChangeText={(value) =>
                    updateWorkoutLabel(workout.id, value)
                  }
                  placeholder="Workout name"
                  placeholderTextColor={t.textHint}
                />

                {workout.groups
                  .filter((group) => group.editable)
                  .map((group) => (
                    <View
                      key={`${workout.id}-${group.name}`}
                      style={[s.groupBlock, { borderColor: t.border }]}
                    >
                      <View style={s.groupHeaderRow}>
                        <View
                          style={[
                            s.groupDot,
                            {
                              backgroundColor:
                                group.color ||
                                MUSCLE_COLORS[group.name] ||
                                MUSCLE_COLORS.Other,
                            },
                          ]}
                        />
                        <Text style={[s.groupTitle, { color: t.text }]}>
                          {group.name}
                        </Text>
                        <Text style={[s.groupCount, { color: t.textHint }]}>
                          {group.exercises.length}
                        </Text>
                      </View>

                      {group.exercises.map((row) => (
                        <View key={row.rowId} style={s.exerciseRow}>
                          <TextInput
                            style={[
                              s.exerciseInput,
                              s.exerciseInputInline,
                              {
                                backgroundColor: t.inputBg,
                                borderColor: t.border,
                                color: t.text,
                              },
                            ]}
                            value={row.name}
                            onChangeText={(value) =>
                              updateDraftExercise(
                                workout.id,
                                group.name,
                                row.rowId,
                                { name: value },
                              )
                            }
                            placeholder="Exercise name"
                            placeholderTextColor={t.textHint}
                          />
                          <TouchableOpacity
                            style={[
                              s.timedChip,
                              {
                                borderColor: row.timed ? t.accent : t.border,
                                backgroundColor: row.timed
                                  ? t.accent + "22"
                                  : t.inputBg,
                              },
                            ]}
                            onPress={() =>
                              updateDraftExercise(
                                workout.id,
                                group.name,
                                row.rowId,
                                { timed: !row.timed },
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Toggle time tracking for ${row.name}`}
                          >
                            <Ionicons
                              name={
                                row.timed ? "time-outline" : "repeat-outline"
                              }
                              size={13}
                              color={row.timed ? t.accent : t.textSub}
                            />
                            <Text
                              style={[
                                s.timedChipText,
                                {
                                  color: row.timed ? t.accent : t.textSub,
                                },
                              ]}
                            >
                              {row.timed ? "Time" : "Reps"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              s.removeRowBtn,
                              {
                                borderColor: t.border,
                                backgroundColor: t.inputBg,
                              },
                            ]}
                            onPress={() =>
                              removeDraftExercise(
                                workout.id,
                                group.name,
                                row.rowId,
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${row.name || "exercise"}`}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={15}
                              color={t.destructiveColor}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}

                    </View>
                  ))}

                {addExerciseDraft?.workoutId === workout.id ? (
                  <View
                    style={[
                      s.addExercisePanel,
                      { borderColor: t.border, backgroundColor: t.inputBg },
                    ]}
                  >
                    <Text style={[s.fieldLabel, { color: t.textSub }]}>
                      Exercise name
                    </Text>
                    <TextInput
                      style={[
                        s.exerciseInput,
                        {
                          backgroundColor: t.surface,
                          borderColor: t.border,
                          color: t.text,
                        },
                      ]}
                      value={addExerciseDraft.name}
                      onChangeText={(value) => {
                        const known = catalog[value.trim()];
                        setAddExerciseDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                name: value,
                                ...(known
                                  ? {
                                      muscle:
                                        known.muscle || previous.muscle,
                                      timed:
                                        known.tracking === TRACKING_TIME,
                                    }
                                  : {}),
                              }
                            : previous,
                        );
                      }}
                      placeholder="Exercise name"
                      placeholderTextColor={t.textHint}
                      autoFocus
                    />

                    <Text
                      style={[
                        s.fieldLabel,
                        { color: t.textSub, marginTop: 10 },
                      ]}
                    >
                      Muscle group
                    </Text>
                    <View style={s.muscleChipRow}>
                      {muscleOptions.map((muscle) => {
                        const selected =
                          addExerciseDraft.muscle === muscle;
                        return (
                          <TouchableOpacity
                            key={muscle}
                            style={[
                              s.muscleChip,
                              {
                                borderColor: selected
                                  ? t.accent
                                  : t.border,
                                backgroundColor: selected
                                  ? t.accent + "22"
                                  : t.surface,
                              },
                            ]}
                            onPress={() =>
                              setAddExerciseDraft((previous) =>
                                previous
                                  ? { ...previous, muscle }
                                  : previous,
                              )
                            }
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`Muscle group ${muscle}`}
                          >
                            <View
                              style={[
                                s.groupDot,
                                {
                                  backgroundColor:
                                    MUSCLE_COLORS[muscle] ||
                                    MUSCLE_COLORS.Other,
                                },
                              ]}
                            />
                            <Text
                              style={[
                                s.muscleChipText,
                                {
                                  color: selected
                                    ? t.accent
                                    : t.textSub,
                                },
                              ]}
                            >
                              {muscle}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text
                      style={[
                        s.fieldLabel,
                        { color: t.textSub, marginTop: 10 },
                      ]}
                    >
                      Track as
                    </Text>
                    <View style={s.trackToggleRow}>
                      {[
                        {
                          timed: false,
                          label: "Reps",
                          icon: "repeat-outline",
                        },
                        { timed: true, label: "Time", icon: "time-outline" },
                      ].map((option) => {
                        const selected =
                          addExerciseDraft.timed === option.timed;
                        return (
                          <TouchableOpacity
                            key={option.label}
                            style={[
                              s.trackToggle,
                              {
                                borderColor: selected
                                  ? t.accent
                                  : t.border,
                                backgroundColor: selected
                                  ? t.accent + "22"
                                  : t.surface,
                              },
                            ]}
                            onPress={() =>
                              setAddExerciseDraft((previous) =>
                                previous
                                  ? { ...previous, timed: option.timed }
                                  : previous,
                              )
                            }
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`Track as ${option.label}`}
                          >
                            <Ionicons
                              name={option.icon}
                              size={13}
                              color={selected ? t.accent : t.textSub}
                            />
                            <Text
                              style={[
                                s.trackToggleText,
                                {
                                  color: selected
                                    ? t.accent
                                    : t.textSub,
                                },
                              ]}
                            >
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={[s.addPanelHint, { color: t.textHint }]}>
                      Distance, speed, and incline are logged through Cardio
                      exercises.
                    </Text>

                    <View style={s.addPanelActions}>
                      <TouchableOpacity
                        style={[
                          s.addPanelCancel,
                          {
                            borderColor: t.border,
                            backgroundColor: t.surface,
                          },
                        ]}
                        onPress={() => setAddExerciseDraft(null)}
                      >
                        <Text
                          style={[
                            s.addPanelCancelText,
                            { color: t.textSub },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          s.addPanelSave,
                          { backgroundColor: t.accent },
                        ]}
                        onPress={confirmAddExercise}
                      >
                        <Ionicons
                          name="add"
                          size={15}
                          color={t.accentText}
                        />
                        <Text
                          style={[
                            s.addPanelSaveText,
                            { color: t.accentText },
                          ]}
                        >
                          Add exercise
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      s.addExerciseBtn,
                      { borderColor: t.border, backgroundColor: t.inputBg },
                    ]}
                    onPress={() => openAddExercise(workout)}
                  >
                    <Ionicons name="add" size={15} color={t.accent} />
                    <Text
                      style={[s.addExerciseText, { color: t.accent }]}
                    >
                      Add exercise
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      <TouchableOpacity
        style={[
          s.resetBtn,
          {
            borderColor: t.border,
            backgroundColor: t.surface,
            marginHorizontal: 12,
          },
        ]}
        onPress={resetExercises}
        disabled={busy}
      >
        <Text style={[s.resetText, { color: t.textSub }]}>
          Restore default exercise templates
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderData = () => (
    <>
      <View
        style={[
          s.section,
          { borderColor: t.border, backgroundColor: t.surface },
        ]}
      >
        <Text style={[s.sectionTitle, { color: t.text }]}>Backup</Text>
        <Text style={[s.infoText, { color: t.textSub, marginTop: -4 }]}>
          Export a complete JSON backup of sessions, plan, cardio settings, and
          rest days. Keep it somewhere safe before reinstalling.
        </Text>
        <TouchableOpacity
          style={[
            s.dataBtn,
            { borderColor: t.border, backgroundColor: t.inputBg },
          ]}
          onPress={exportBackup}
          disabled={busy}
        >
          <Ionicons name="share-outline" size={17} color={t.accent} />
          <Text style={[s.dataBtnText, { color: t.text }]}>
            Export backup JSON
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          s.section,
          { borderColor: t.border, backgroundColor: t.surface },
        ]}
      >
        <Text style={[s.sectionTitle, { color: t.text }]}>Restore</Text>
        <Text style={[s.infoText, { color: t.textSub, marginTop: -4 }]}>
          Paste a backup JSON below. Restoring replaces all current data.
        </Text>
        <TextInput
          style={[
            s.dataTextArea,
            {
              backgroundColor: t.inputBg,
              borderColor: t.border,
              color: t.text,
            },
          ]}
          value={importText}
          onChangeText={setImportText}
          placeholder='{"format":"workout-tracker-backup", ...}'
          placeholderTextColor={t.textHint}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[
            s.dataBtn,
            { borderColor: t.border, backgroundColor: t.inputBg },
            busy && { opacity: 0.6 },
          ]}
          onPress={importBackup}
          disabled={busy}
        >
          <Ionicons name="download-outline" size={17} color={t.accent} />
          <Text style={[s.dataBtnText, { color: t.text }]}>
            Restore from JSON
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderAbout = () => (
    <View
      style={[s.section, { borderColor: t.border, backgroundColor: t.surface }]}
    >
      <View style={s.aboutHeader}>
        <AppLogo theme={t} />
      </View>
      <View style={[s.aboutRow, { borderTopColor: t.border }]}>
        <Text style={[s.aboutLabel, { color: t.textSub }]}>Version</Text>
        <Text style={[s.aboutValue, { color: t.text }]}>v{APP_VERSION}</Text>
      </View>
      <View style={[s.aboutRow, { borderTopColor: t.border }]}>
        <Text style={[s.aboutLabel, { color: t.textSub }]}>Release</Text>
        <Text style={[s.aboutValue, { color: t.text }]}>
          Flexible PPL-UL rotation
        </Text>
      </View>
      <View style={[s.aboutNotes, { borderTopColor: t.border }]}>
        <Text style={[s.aboutNotesTitle, { color: t.text }]}>
          What's new in 6.0.0
        </Text>
        {[
          "5 flexible workouts: Push, Pull, Legs, Upper, Lower.",
          "Each workout starts with 5 or more exercises; add or remove exercises any time.",
          "Choose any 2 rest days each week; rotation continues after rest.",
          "After a 7+ day break, the rotation restarts at Push.",
          "Timed exercises store seconds per set; switch any exercise to Time tracking.",
          "Walking tracks duration, distance, speed, and incline.",
          "Fresh start in 6.0: the new data model keeps all future history.",
          "Export and paste-to-restore JSON backups.",
        ].map((note) => (
          <View key={note} style={s.aboutNoteRow}>
            <View style={[s.aboutBullet, { backgroundColor: t.accent }]} />
            <Text style={[s.aboutNoteText, { color: t.textSub }]}>
              {note}
            </Text>
          </View>
        ))}
      </View>
      <Text
        style={[
          s.aboutFooter,
          { color: t.textSub, borderTopColor: t.border },
        ]}
      >
        A practical workout logging app for consistency, progression tracking,
        and LLM-ready insights.
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[s.overlay, { backgroundColor: t.scrim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            s.sheet,
            { backgroundColor: t.surface, borderTopColor: t.border },
          ]}
        >
          <View style={s.handleWrap}>
            <View style={[s.handle, { backgroundColor: t.border }]} />
          </View>

          <View style={[s.header, { borderBottomColor: t.border }]}>
            <View style={s.headerLeft}>
              {view !== "menu" && (
                <TouchableOpacity
                  onPress={() => setView("menu")}
                  style={[
                    s.backBtn,
                    { backgroundColor: t.inputBg, borderColor: t.border },
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-back" size={18} color={t.text} />
                </TouchableOpacity>
              )}
              <Text style={[s.title, { color: t.text }]}>
                {VIEW_TITLES[view] || "Settings"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                s.closeBtn,
                { backgroundColor: t.inputBg, borderColor: t.border },
              ]}
            >
              <Ionicons name="close" size={18} color={t.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.content}
            contentContainerStyle={{ paddingBottom: 22 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {view === "menu" && renderMenu()}
            {view === "workout" && renderWorkout()}
            {view === "restday" && renderRestDays()}
            {view === "cardio" && renderCardio()}
            {view === "exercises" && renderExercises()}
            {view === "data" && renderData()}
            {view === "about" && renderAbout()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    height: "82%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 0.5,
    overflow: "hidden",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 99,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  title: { fontSize: 18, fontWeight: "600" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  content: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  section: {
    borderWidth: 0.5,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sectionTitleInline: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
  },
  sectionSub: {
    fontSize: 11,
    lineHeight: 16,
    paddingBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  infoText: {
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  currentLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  currentValue: { fontSize: 15, fontWeight: "600", marginTop: 2 },
  sourceBadge: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourceBadgeText: { fontSize: 10, fontWeight: "600" },
  editLinkBtn: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editLinkText: { fontSize: 12, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowText: { fontSize: 13, fontWeight: "500", flex: 1, paddingRight: 10 },
  rowValue: { fontSize: 15, fontWeight: "700" },
  overrideWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  overrideBtn: {
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  overrideBtnText: { fontSize: 12, fontWeight: "600" },
  clearOverrideBtn: {
    borderTopWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    marginTop: 2,
  },
  weekRow: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  weekDay: {
    flex: 1,
    minHeight: 66,
    borderRadius: 12,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  weekDayLabel: { fontSize: 9, fontWeight: "600" },
  weekDayNum: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  weekDayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 5 },
  cardioListRow: {
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardioListName: { fontSize: 13, fontWeight: "600" },
  cardioListSub: { fontSize: 11, marginTop: 2, lineHeight: 16 },
  cardioEditRow: {
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  cardioEditTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardioNameInput: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  cardioDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  fieldChip: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fieldChipText: { fontSize: 11, fontWeight: "600" },
  addCardioBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 0.5,
    borderRadius: 12,
    marginHorizontal: 14,
    marginTop: 4,
    paddingVertical: 11,
  },
  addCardioText: { fontSize: 13, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { fontSize: 13, fontWeight: "600" },
  saveBtn: {
    flex: 1.4,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveText: { fontSize: 13, fontWeight: "700" },
  resetBtn: {
    borderWidth: 0.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  resetText: { fontSize: 13, fontWeight: "600" },
  menu: {
    borderWidth: 0.5,
    borderRadius: 14,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 0,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 14, fontWeight: "600" },
  menuSub: { fontSize: 12, marginTop: 2 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  dayTitle: { fontSize: 14, fontWeight: "600" },
  daySub: { fontSize: 11, marginTop: 2 },
  dayBody: { paddingHorizontal: 12, paddingBottom: 12 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 5,
  },
  groupBlock: {
    borderWidth: 0.5,
    borderRadius: 12,
    marginTop: 10,
    padding: 10,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  groupDot: { width: 7, height: 7, borderRadius: 4 },
  groupTitle: { flex: 1, fontSize: 12, fontWeight: "600" },
  groupCount: { fontSize: 10, fontWeight: "600" },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 7,
  },
  exerciseInput: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  exerciseInputInline: { flex: 1 },
  timedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  timedChipText: { fontSize: 10, fontWeight: "600" },
  removeRowBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  addExerciseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 0.5,
    borderRadius: 10,
    marginTop: 9,
    paddingVertical: 9,
  },
  addExerciseText: { fontSize: 12, fontWeight: "600" },
  addExercisePanel: {
    borderWidth: 0.5,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  muscleChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  muscleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  muscleChipText: { fontSize: 10, fontWeight: "600" },
  trackToggleRow: { flexDirection: "row", gap: 8 },
  trackToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  trackToggleText: { fontSize: 11, fontWeight: "600" },
  addPanelHint: { fontSize: 10, lineHeight: 14, marginTop: 6 },
  addPanelActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  addPanelCancel: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addPanelCancelText: { fontSize: 12, fontWeight: "600" },
  addPanelSave: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    paddingVertical: 10,
  },
  addPanelSaveText: { fontSize: 12, fontWeight: "700" },
  dataBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 0.5,
    borderRadius: 12,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 12,
  },
  dataBtnText: { fontSize: 13, fontWeight: "600" },
  dataTextArea: {
    minHeight: 130,
    borderWidth: 0.5,
    borderRadius: 12,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 11,
    lineHeight: 16,
  },
  aboutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  aboutLabel: { fontSize: 13, fontWeight: "500" },
  aboutValue: { fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  aboutNotes: {
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  aboutNotesTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  aboutNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  aboutBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 6,
  },
  aboutNoteText: { flex: 1, fontSize: 11, lineHeight: 16 },
  aboutFooter: {
    fontSize: 12,
    lineHeight: 17,
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
});

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  TextInput,
  Alert,
  Animated,
  BackHandler,
  Easing,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../app/theme";
import AppLogo from "../app/AppLogo";
import CardioLogger from "./CardioLogger";
import SettingsModal from "./SettingsModal";
import SetInputs from "./SetInputs";
import {
  DEFAULT_PLAN,
  DEFAULT_CARDIO_CONFIG,
  applyCardioConfigToPlan,
  getCardioEntry,
  getWorkoutById,
  isWeightExercise,
} from "../app/data";
import {
  loadSessions,
  saveSessions,
  getLatestExerciseSets,
  formatDate,
  loadCustomPlan,
  loadRestDays,
  loadDayOverrides,
  loadCardioConfig,
  loadCatalog,
  renameExerciseGlobally,
  saveRestDay,
} from "../app/storage";
import { findExerciseInPlan } from "../app/planUtils";
import {
  getExerciseTracking,
  isTimedExercise,
} from "../app/catalog";
import {
  getNextWorkoutId,
  getWorkoutForDate,
  getWorkoutOrdinal,
} from "../app/schedule";
import {
  getCardioStorageKey,
  getSessionEntry,
  hasCardioValues,
  isEntryLogged,
  normalizeCardioValues,
} from "../app/sessionUtils";
import {
  cleanWorkoutSets,
  createWorkoutSets,
  normalizeWorkoutSets,
} from "./workoutSets";

function AnimatedExRow({
  ex,
  isDone,
  timed,
  canEdit,
  onPress,
  onEdit,
  index,
  t,
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(isDone ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      delay: index * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: isDone ? 1 : 0,
      useNativeDriver: true,
      damping: 10,
      stiffness: 200,
    }).start();
  }, [checkScale, isDone]);

  const handlePressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
    }).start();
  const handlePressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
    }).start();

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
          { scale },
        ],
      }}
    >
      <View
        style={[
          s.exRow,
          { borderTopColor: t.border },
          isDone && { borderLeftWidth: 3, borderLeftColor: t.success },
        ]}
      >
        <TouchableOpacity
          style={s.exMainTap}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <Text style={[s.exName, { color: t.text }]}>{ex}</Text>
        </TouchableOpacity>
        {timed && (
          <Ionicons
            name="time-outline"
            size={14}
            color={t.textHint}
            accessibilityLabel="Timed exercise"
          />
        )}
        {canEdit && (
          <TouchableOpacity
            style={[
              s.editBtn,
              { borderColor: t.border, backgroundColor: t.inputBg },
            ]}
            onPress={onEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${ex}`}
          >
            <Text style={[s.editBtnText, { color: t.textSub }]}>Edit</Text>
          </TouchableOpacity>
        )}
        <Animated.View
          style={[
            s.check,
            { borderColor: t.borderStrong },
            isDone && { backgroundColor: t.success, borderColor: t.success },
            {
              transform: [
                {
                  scale: checkScale.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {isDone && <Text style={s.checkMark}>✓</Text>}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function GearIcon({ color, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.2 3.9c.5-1.1 2.1-1.1 2.6 0l.4.9c.2.4.6.7 1 .9.4.2.9.2 1.3 0l.9-.4c1.1-.5 2.3.7 1.8 1.8l-.4.9c-.2.4-.2.9 0 1.3.2.4.5.8.9 1l.9.4c1.1.5 1.1 2.1 0 2.6l-.9.4c-.4.2-.7.6-.9 1-.2.4-.2.9 0 1.3l.4.9c.5 1.1-.7 2.3-1.8 1.8l-.9-.4c-.4-.2-.9-.2-1.3 0-.4.2-.8.5-1 1l-.4.9c-.5 1.1-2.1 1.1-2.6 0l-.4-.9c-.2-.5-.6-.8-1-1-.4-.2-.9-.2-1.3 0l-.9.4c-1.1.5-2.3-.7-1.8-1.8l.4-.9c.2-.4.2-.9 0-1.3-.2-.4-.5-.8-1-1l-.9-.4c-1.1-.5-1.1-2.1 0-2.6l.9-.4c.4-.2.8-.6 1-1 .2-.4.2-.9 0-1.3l-.4-.9c-.5-1.1.7-2.3 1.8-1.8l.9.4c.4.2.9.2 1.3 0 .4-.2.8-.5 1-1l.4-.9Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="2.6" stroke={color} strokeWidth="1.6" />
    </Svg>
  );
}

export default function DayLogger({
  dateKey,
  onClose,
  isPastLog = false,
  initialWorkoutId = null,
}) {
  const t = useTheme();
  const [sessions, setSessions] = useState({});
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [catalog, setCatalog] = useState({});
  const [cardioConfig, setCardioConfig] = useState(DEFAULT_CARDIO_CONFIG);
  const [workoutInfo, setWorkoutInfo] = useState(null);
  const [activeEx, setActiveEx] = useState(null);
  const [activeSets, setActiveSets] = useState([]);
  const [cardioValues, setCardioValues] = useState({});
  const [weightKg, setWeightKg] = useState("");
  const [prefillDate, setPrefillDate] = useState(null);
  const [editingEx, setEditingEx] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isRestDay, setIsRestDay] = useState(false);
  const [showRestBanner, setShowRestBanner] = useState(true);
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const saveScaleAnim = useRef(new Animated.Value(1)).current;

  const workout = workoutInfo?.workout || null;
  const ordinal = workout ? getWorkoutOrdinal(plan, workout.id) : null;

  const loadScreenData = useCallback(async () => {
    const [
      loadedSessions,
      customPlan,
      savedCardioConfig,
      restDays,
      assignments,
      loadedCatalog,
    ] = await Promise.all([
      loadSessions(),
      loadCustomPlan(),
      loadCardioConfig(),
      loadRestDays(),
      loadDayOverrides(),
      loadCatalog(),
    ]);

    const liveConfig = savedCardioConfig || DEFAULT_CARDIO_CONFIG;
    const basePlan =
      customPlan && typeof customPlan === "object" ? customPlan : DEFAULT_PLAN;
    const nextPlan = applyCardioConfigToPlan(basePlan, liveConfig);
    const context = getWorkoutForDate(
      nextPlan,
      loadedSessions,
      assignments,
      dateKey,
      initialWorkoutId,
    );

    const restStatus =
      !!restDays[dateKey] || !!loadedSessions[dateKey]?._rest;

    setSessions(loadedSessions);
    setPlan(nextPlan);
    setCardioConfig(liveConfig);
    setCatalog(loadedCatalog || {});
    setWorkoutInfo(context);
    setIsRestDay(restStatus);
    setShowRestBanner(restStatus);
  }, [dateKey, initialWorkoutId]);

  useFocusEffect(
    useCallback(() => {
      loadScreenData();
    }, [loadScreenData]),
  );

  const closeLogger = useCallback(() => {
    setActiveEx(null);
    setActiveSets([]);
    setCardioValues({});
    setWeightKg("");
    setPrefillDate(null);
  }, []);

  const cancelEditingExercise = useCallback(() => {
    setEditingEx(null);
    setEditingName("");
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 80,
      }),
    ]).start();
  }, [
    activeEx,
    editingEx,
    isRestDay,
    showRestBanner,
    workout?.id,
    fadeAnim,
    slideAnim,
  ]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBackPress = () => {
        if (editingEx) {
          cancelEditingExercise();
          return true;
        }
        if (activeEx) {
          closeLogger();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onHardwareBackPress,
      );
      return () => subscription.remove();
    }, [activeEx, editingEx, cancelEditingExercise, closeLogger]),
  );

  const openLogger = (exerciseName) => {
    const info = getSessionEntry(sessions[dateKey], exerciseName, cardioConfig);
    setActiveEx(exerciseName);
    setPrefillDate(null);

    if (info.kind === "cardio") {
      setActiveSets([]);
      setCardioValues(normalizeCardioValues(info.entry));
      setWeightKg("");
    } else if (info.kind === "weight") {
      setActiveSets([]);
      setCardioValues({});
      setWeightKg(String(info.entry?.kg ?? ""));
    } else {
      const current = sessions[dateKey]?.[exerciseName];
      const latest =
        Array.isArray(current) && current.length > 0
          ? { sets: current, dateKey }
          : getLatestExerciseSets(sessions, exerciseName, dateKey);

      setActiveSets(
        latest?.sets?.length
          ? normalizeWorkoutSets(latest.sets)
          : createWorkoutSets(),
      );
      setPrefillDate(latest?.dateKey ?? null);
      setCardioValues({});
      setWeightKg("");
    }

    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 0,
    }).start();
    Animated.spring(fadeAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 0,
    }).start();
  };

  const updateSet = (index, key, value) => {
    setActiveSets((prev) =>
      prev.map((set, i) => (i === index ? { ...set, [key]: value } : set)),
    );
  };

  const saveExercise = async () => {
    if (!activeEx || !workout) return;

    const nextSessions = JSON.parse(JSON.stringify(sessions));
    const existing = nextSessions[dateKey] || {};

    const info = getSessionEntry(existing, activeEx, cardioConfig);
    let didLog = false;

    if (info.kind === "cardio") {
      const storageKey = getCardioStorageKey(activeEx, cardioConfig);
      didLog = hasCardioValues(cardioValues);
      if (didLog) {
        existing[storageKey] = normalizeCardioValues(cardioValues);
      } else {
        delete existing[storageKey];
      }
      if (storageKey !== activeEx) delete existing[activeEx];
    } else if (info.kind === "weight") {
      const kg = String(weightKg || "").trim();
      didLog = kg !== "";
      if (didLog) existing[activeEx] = { kg };
      else delete existing[activeEx];
    } else {
      const sets = cleanWorkoutSets(activeSets);
      didLog = sets.length > 0;
      if (didLog) existing[activeEx] = sets;
      else delete existing[activeEx];
    }

    // Cardio and body weight can be logged on a rest day without turning it
    // into a strength session. Only real strength work clears a rest mark.
    const isStrengthLog = didLog && info.kind === "strength";

    if (didLog) {
      existing._workoutId = workout.id;
      if (isStrengthLog || !existing._rest) existing._label = workout.label;
      if (isStrengthLog) delete existing._rest;
    }

    // Saving an untouched logger must not leave a metadata-only session behind:
    // it would show up in History and consume a rotation slot.
    const hasLoggedData = Object.keys(existing).some(
      (key) => !key.startsWith("_"),
    );
    if (hasLoggedData || existing._rest) {
      nextSessions[dateKey] = existing;
    } else {
      delete nextSessions[dateKey];
    }

    await saveSessions(nextSessions);
    if (isStrengthLog && isRestDay) {
      await saveRestDay(dateKey, false);
      setIsRestDay(false);
    }
    setSessions(nextSessions);
    closeLogger();
  };

  const startEditingExercise = (exerciseName) => {
    setEditingEx({ oldName: exerciseName });
    setEditingName(exerciseName);
  };

  const saveEditedExercise = async () => {
    if (!editingEx || !workout) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      Alert.alert("Invalid name", "Exercise name cannot be empty.");
      return;
    }
    if (trimmed === editingEx.oldName) {
      cancelEditingExercise();
      return;
    }

    const existsInPlan = findExerciseInPlan(plan, trimmed);
    const existsInHistory = Object.keys(sessions).some((key) =>
      Object.keys(sessions[key] || {}).some(
        (exercise) =>
          !exercise.startsWith("_") &&
          exercise !== editingEx.oldName &&
          exercise.toLowerCase() === trimmed.toLowerCase(),
      ),
    );
    const clashesWithCardio = cardioConfig.some(
      (entry) =>
        String(entry.name || "").trim().toLowerCase() ===
          trimmed.toLowerCase() ||
        String(entry.id || "").toLowerCase() === trimmed.toLowerCase(),
    );
    if (
      existsInPlan ||
      existsInHistory ||
      clashesWithCardio ||
      isWeightExercise(trimmed)
    ) {
      Alert.alert(
        "Already exists",
        "An exercise with that name already exists. Pick a unique name.",
      );
      return;
    }

    try {
      const result = await renameExerciseGlobally(editingEx.oldName, trimmed);
      setSessions(result.sessions);
      setPlan(result.plan);
      setCatalog(result.catalog);
      setWorkoutInfo((prev) => ({
        ...prev,
        workout: getWorkoutById(result.plan, prev?.workout?.id),
      }));
      cancelEditingExercise();
    } catch {
      Alert.alert("Rename failed", "Could not rename this exercise.");
    }
  };

  const activeInfo = activeEx
    ? getSessionEntry(sessions[dateKey], activeEx, cardioConfig)
    : null;
  const activeIsCardio = activeInfo?.kind === "cardio";
  const activeIsWeight = activeInfo?.kind === "weight";
  const activeTimed =
    !!activeEx && !activeIsCardio && !activeIsWeight
      ? isTimedExercise(activeEx, catalog)
      : false;
  const activeCardioConfig = activeIsCardio
    ? getCardioEntry(activeEx, cardioConfig)
    : null;
  // Past logs always show the workout, even when that date was marked as rest.
  const showRestView =
    !isPastLog && ((isRestDay && showRestBanner) || !workout);
  const nextWorkoutId = getNextWorkoutId(plan, sessions, dateKey);
  const nextWorkout = getWorkoutById(plan, nextWorkoutId);

  const isExerciseDone = (exerciseName) => {
    const info = getSessionEntry(sessions[dateKey], exerciseName, cardioConfig);
    return isEntryLogged(info);
  };

  const renderRestBanner = () =>
    showRestBanner && isRestDay ? (
      <TouchableWithoutFeedback onPress={() => setShowRestBanner(false)}>
        <View
          style={[
            s.restBanner,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
        >
          <View style={s.restBannerTextWrap}>
            <Text style={[s.restBannerTitle, { color: t.text }]}>
              Rest day
            </Text>
            <Text style={[s.restBannerSub, { color: t.textSub }]}>
              {nextWorkout ? `Next up: ${nextWorkout.label}` : "Recover well"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowRestBanner(false)}
            style={[
              s.restClose,
              { backgroundColor: t.inputBg, borderColor: t.border },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss rest reminder"
          >
            <Ionicons name="close" size={16} color={t.textSub} />
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    ) : null;

  const headerDateLabel = formatDate(dateKey, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Past-log mode never shows the rest view, so guard this render while the
  // plan/session data is still loading. Without it, opening a past date could
  // read workout.groups on null and close the app.
  if (!workout) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
        <View
          style={[
            s.topbar,
            { backgroundColor: t.surface, borderBottomColor: t.border },
          ]}
        >
          <View style={s.topbarRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.topTitle, { color: t.text }]}>
                Loading workout
              </Text>
              <Text style={[s.topSub, { color: t.textSub }]}>
                {headerDateLabel}
              </Text>
            </View>
            <View style={s.topBarRight}>
              <AppLogo theme={t} compact />
              {onClose && (
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    s.closeBtn,
                    { backgroundColor: t.inputBg, borderColor: t.border },
                  ]}
                >
                  <Ionicons name="close" size={16} color={t.textSub} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (editingEx && workout) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
        <View
          style={[
            s.topbar,
            { backgroundColor: t.surface, borderBottomColor: t.border },
          ]}
        >
          <View style={s.topbarRow}>
            <View>
              <Text style={[s.topTitle, { color: t.text }]}>Rename exercise</Text>
              <Text style={[s.topSub, { color: t.textSub }]}>
                {workout.label} · updates history everywhere
              </Text>
            </View>
            <AppLogo theme={t} compact />
          </View>
        </View>
        <View style={s.editWrap}>
          <View
            style={[
              s.editCard,
              { backgroundColor: t.surface, borderColor: t.border },
            ]}
          >
            <Text style={[s.editLabel, { color: t.textSub }]}>
              Exercise name
            </Text>
            <TextInput
              style={[
                s.editInput,
                {
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.text,
                },
              ]}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="Exercise name"
              placeholderTextColor={t.textHint}
              autoFocus
            />
            <Text style={[s.editHint, { color: t.textHint }]}>
              The new name is applied to every workout and all past sessions, so
              progress charts stay connected.
            </Text>
            <View style={s.editActions}>
              <TouchableOpacity
                style={[
                  s.secondaryBtn,
                  { backgroundColor: t.inputBg, borderColor: t.border },
                ]}
                onPress={cancelEditingExercise}
              >
                <Text style={[s.secondaryBtnText, { color: t.textSub }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: t.accent }]}
                onPress={saveEditedExercise}
              >
                <Text style={[s.primaryBtnText, { color: t.accentText }]}>
                  Save name
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (activeEx) {
    const loggerScale = fadeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.98, 1],
    });

    return (
      <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
        <Animated.View
          style={[
            s.loggerWrap,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: loggerScale }],
            },
          ]}
        >
          <View
            style={[
              s.loggerTopbar,
              { backgroundColor: t.surface, borderBottomColor: t.border },
            ]}
          >
            <View style={s.loggerTopbarRow}>
              <TouchableOpacity
                onPress={closeLogger}
                style={[
                  s.backChip,
                  { backgroundColor: t.inputBg, borderColor: t.border },
                ]}
              >
                <Ionicons name="chevron-back" size={16} color={t.accent} />
                <Text style={[s.backChipText, { color: t.accent }]}>
                  Workout
                </Text>
              </TouchableOpacity>
              <View style={s.loggerTitleWrap}>
                <Text
                  style={[s.loggerTitle, { color: t.text }]}
                  numberOfLines={1}
                >
                  {activeEx}
                </Text>
                {onClose && (
                  <TouchableOpacity
                    onPress={onClose}
                    style={[
                      s.closeBtn,
                      { backgroundColor: t.inputBg, borderColor: t.border },
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={16} color={t.textSub} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text style={[s.loggerSub, { color: t.textSub }]}>
              {activeIsCardio
                ? "Log duration and the metrics that matter"
                : activeIsWeight
                  ? "Log your body weight for today"
                  : activeTimed
                    ? "Log weight (optional) and time per set"
                    : "Track each set with clean form and controlled tempo"}
            </Text>
            {isPastLog && (
              <View
                style={[
                  s.prefillBadge,
                  { borderColor: t.border, backgroundColor: t.inputBg },
                ]}
              >
                <Ionicons name="time-outline" size={12} color={t.accent} />
                <Text style={[s.prefillBadgeText, { color: t.textSub }]}>
                  Logging past session
                </Text>
              </View>
            )}
            {!!prefillDate && (
              <View
                style={[
                  s.prefillBadge,
                  { borderColor: t.border, backgroundColor: t.inputBg },
                ]}
              >
                <Ionicons name="sparkles-outline" size={12} color={t.accent} />
                <Text style={[s.prefillBadgeText, { color: t.textSub }]}>
                  Prefilled from {formatDate(prefillDate)}
                </Text>
              </View>
            )}
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            <View
              style={[
                s.card,
                { backgroundColor: t.surface, borderColor: t.border },
              ]}
            >
              {activeIsCardio && (
                <CardioLogger
                  entry={cardioValues}
                  onChange={setCardioValues}
                  configEntry={activeCardioConfig}
                  theme={t}
                  styles={s}
                />
              )}

              {!activeIsCardio && activeIsWeight && (
                <>
                  <View
                    style={[
                      s.setHeader,
                      {
                        borderBottomColor: t.border,
                        backgroundColor: t.inputBg,
                      },
                    ]}
                  >
                    <Text style={[s.setColHdr, { flex: 1, color: t.textHint }]}>
                      Today's weight
                    </Text>
                  </View>
                  <View
                    style={[s.weightCardBody, { borderTopColor: t.border }]}
                  >
                    <TextInput
                      style={[
                        s.numInput,
                        s.weightInput,
                        {
                          backgroundColor: t.inputBg,
                          borderColor: t.border,
                          color: t.text,
                        },
                      ]}
                      value={weightKg}
                      onChangeText={setWeightKg}
                      placeholder="kg"
                      placeholderTextColor={t.textHint}
                      keyboardType="decimal-pad"
                      accessibilityLabel="Body weight in kilograms"
                    />
                  </View>
                </>
              )}

              {!activeIsCardio && !activeIsWeight && (
                <SetInputs
                  sets={activeSets}
                  timed={activeTimed}
                  onChange={updateSet}
                  theme={t}
                  styles={s}
                />
              )}
            </View>

            <Animated.View style={{ transform: [{ scale: saveScaleAnim }] }}>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: t.accent }]}
                onPress={saveExercise}
                onPressIn={() =>
                  Animated.spring(saveScaleAnim, {
                    toValue: 0.98,
                    useNativeDriver: true,
                  }).start()
                }
                onPressOut={() =>
                  Animated.spring(saveScaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                  }).start()
                }
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={t.accentText}
                />
                <Text style={[s.saveBtnText, { color: t.accentText }]}>
                  {activeIsWeight ? "Save weight" : "Save exercise"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <Text style={[s.saveHint, { color: t.textHint }]}>
              Saving with empty fields removes this entry from the session.
            </Text>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const totalDone = workout
    ? workout.groups.reduce(
        (sum, group) =>
          sum + group.exercises.filter((ex) => isExerciseDone(ex)).length,
        0,
      )
    : 0;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
      <View
        style={[
          s.topbar,
          { backgroundColor: t.surface, borderBottomColor: t.border },
        ]}
      >
        <View style={s.topbarRow}>
          <View style={{ flex: 1 }}>
            <View style={s.titleRow}>
              <Text style={[s.topTitle, { color: t.text }]}>
                {!isPastLog && isRestDay && showRestBanner
                  ? "Rest Day"
                  : workout.label}
              </Text>
              {!!ordinal && !(!isPastLog && isRestDay && showRestBanner) && (
                <View
                  style={[
                    s.ordinalBadge,
                    { backgroundColor: t.inputBg, borderColor: t.border },
                  ]}
                >
                  <Text style={[s.ordinalText, { color: t.textSub }]}>
                    {ordinal.index}/{ordinal.total}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[s.topSub, { color: t.textSub }]}>
              {headerDateLabel}
              {totalDone > 0 ? `  ·  ${totalDone} logged` : ""}
            </Text>
          </View>
          <View style={s.topBarRight}>
            <AppLogo theme={t} compact />
            {onClose && (
              <TouchableOpacity
                onPress={onClose}
                style={[
                  s.closeBtn,
                  { backgroundColor: t.inputBg, borderColor: t.border },
                ]}
              >
                <Ionicons name="close" size={16} color={t.textSub} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                s.settingsBtn,
                { backgroundColor: t.inputBg, borderColor: t.border },
              ]}
              onPress={() => setSettingsVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <GearIcon color={t.textSub} size={18} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[s.quote, { color: t.textHint }]}>
          Things will never get serious until you decide to take them serious.
        </Text>
        {isPastLog && (
          <View
            style={[
              s.prefillBadge,
              { borderColor: t.border, backgroundColor: t.inputBg, marginTop: 8 },
            ]}
          >
            <Ionicons name="time-outline" size={12} color={t.accent} />
            <Text style={[s.prefillBadgeText, { color: t.textSub }]}>
              Logging past session
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {showRestView ? renderRestBanner() : null}
        {!showRestView &&
          workout.groups
            .filter((group) => (group.exercises || []).length > 0)
            .map((group) => {
            const done = group.exercises.filter((ex) =>
              isExerciseDone(ex),
            ).length;
            const canEdit =
              group.name !== "Cardio" && group.name !== "Weight";

            return (
              <View
                key={group.name}
                style={[
                  s.card,
                  { backgroundColor: t.surface, borderColor: t.border },
                ]}
              >
                <View style={[s.groupHdr, { borderBottomColor: t.border }]}>
                  <View
                    style={[
                      s.dot,
                      {
                        backgroundColor:
                          done > 0 ? t.success : group.color,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      s.groupName,
                      {
                        color: t.text,
                      },
                    ]}
                  >
                    {group.name}
                  </Text>
                  <View
                    style={[
                      s.badge,
                      {
                        backgroundColor:
                          done > 0 ? t.success + "22" : t.inputBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.badgeText,
                        {
                          color:
                            done > 0
                              ? t.success
                              : t.textSub,
                        },
                      ]}
                    >
                      {done} logged
                    </Text>
                  </View>
                </View>
                {group.exercises.map((ex, exerciseIndex) => (
                  <AnimatedExRow
                    key={ex}
                    ex={ex}
                    isDone={isExerciseDone(ex)}
                    timed={
                      canEdit &&
                      getExerciseTracking(ex, catalog) === "time"
                    }
                    canEdit={canEdit}
                    onPress={() => openLogger(ex)}
                    onEdit={() => startEditingExercise(ex)}
                    index={exerciseIndex}
                    t={t}
                  />
                ))}
              </View>
            );
          })}
      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => {
          setSettingsVisible(false);
          loadScreenData();
        }}
        onChanged={loadScreenData}
        theme={t}
        dateKey={dateKey}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  topbar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  topbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  topTitle: { fontSize: 20, fontWeight: "600" },
  topSub: { fontSize: 12, marginTop: 3 },
  quote: { fontSize: 11, fontStyle: "italic", lineHeight: 15, marginTop: 8 },
  ordinalBadge: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ordinalText: { fontSize: 10, fontWeight: "600" },
  scroll: { flex: 1, padding: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  groupHdr: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
  },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  groupName: { flex: 1, fontSize: 14, fontWeight: "500" },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "500" },
  exRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
    gap: 8,
  },
  exMainTap: { flex: 1, flexDirection: "row", alignItems: "center" },
  exName: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  editBtn: {
    borderWidth: 0.5,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 34,
    justifyContent: "center",
  },
  editBtnText: { fontSize: 11, fontWeight: "500" },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  loggerWrap: { flex: 1 },
  loggerTopbar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  loggerTopbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  loggerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flex: 1,
  },
  backChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backChipText: { fontSize: 12, fontWeight: "600" },
  loggerTitle: { fontSize: 20, fontWeight: "700", flexShrink: 1 },
  loggerSub: { fontSize: 11, marginTop: 8 },
  prefillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  prefillBadgeText: { fontSize: 10, fontWeight: "500" },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  setHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
  },
  setColHdr: { fontSize: 10 },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
  },
  setLabel: { fontSize: 12 },
  numInput: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 7,
    fontSize: 13,
    textAlign: "center",
  },
  setVol: { fontSize: 11, textAlign: "right", fontWeight: "500" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
  },
  totalLabel: { fontSize: 12 },
  totalVal: { fontSize: 16, fontWeight: "600" },
  weightCardBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    alignItems: "center",
  },
  weightInput: { width: "72%", maxWidth: 280 },
  saveBtn: {
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 4,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: "600" },
  saveHint: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 18,
  },
  restBanner: {
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  restBannerTextWrap: { flex: 1, paddingRight: 10 },
  restBannerTitle: { fontSize: 16, fontWeight: "700" },
  restBannerSub: { fontSize: 12, marginTop: 3 },
  restClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  editWrap: { flex: 1, padding: 12 },
  editCard: { borderRadius: 14, borderWidth: 0.5, padding: 14 },
  editLabel: { fontSize: 12, marginBottom: 6 },
  editHint: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  editInput: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  editActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 13, fontWeight: "500" },
  primaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { fontSize: 13, fontWeight: "600" },
});

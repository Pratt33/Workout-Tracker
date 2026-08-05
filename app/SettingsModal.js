import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import AppLogo from "./AppLogo";
import { PLAN, PLAN_VERSION, DEFAULT_CARDIO_CONFIG } from "./data";
import {
  todayKey,
  loadDayOverrides,
  saveDayOverride,
  loadCardioConfig,
  saveCardioConfig,
  resetCardioConfig,
  loadSessions,
  saveSessions,
  renameExerciseInSessions,
  saveRestDay,
  loadRestDays,
  loadCustomPlan,
  saveCustomPlan,
  clearCustomPlan,
} from "./storage";

const REST_KEY = "rest_days_v1";
const CUSTOM_KEY = "custom_exercises_v1";
const DAY_OPTIONS = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
];

const DAY_ORDER = [1, 2, 3, 4, 5, 6];

const METRIC_OPTIONS = [
  { value: "steps+km", label: "Steps+Km" },
  { value: "minutes+km", label: "Min+Km" },
  { value: "minutes", label: "Min only" },
];

function metricLabel(metric) {
  if (metric === "steps+km") return "Steps + Km";
  if (metric === "minutes+km") return "Minutes + Km";
  if (metric === "minutes") return "Minutes only";
  return metric;
}

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

const MENU_ITEMS = [
  {
    id: "workout",
    title: "Workout Settings",
    subtitle: "Replace a scheduled workout day",
    icon: "calendar-outline",
  },
  {
    id: "restday",
    title: "Rest Day",
    subtitle: "Mark a day as rest",
    icon: "moon-outline",
  },
  {
    id: "cardio",
    title: "Cardio Settings",
    subtitle: "Manage cardio exercises & metrics",
    icon: "heart-outline",
  },
  {
    id: "exercises",
    title: "Exercise Management",
    subtitle: "Edit workout exercises by day",
    icon: "barbell-outline",
  },
  {
    id: "about",
    title: "About",
    subtitle: "App version & info",
    icon: "information-circle-outline",
  },
];

const VIEW_TITLES = {
  menu: "Settings",
  workout: "Workout Settings",
  restday: "Rest Day",
  cardio: "Cardio Settings",
  exercises: "Exercise Management",
  about: "About",
};

export default function SettingsModal({
  visible,
  onClose,
  onChanged,
  theme: t,
  dateKey = todayKey(),
}) {
  const [view, setView] = useState("menu");
  const [todayRest, setTodayRest] = useState(false);
  const [expandedDays, setExpandedDays] = useState({});
  const [plan, setPlan] = useState(clonePlan(PLAN));
  const [dayOverride, setDayOverride] = useState(null);
  const [cardioConfig, setCardioConfig] = useState(DEFAULT_CARDIO_CONFIG);
  const [editingCardio, setEditingCardio] = useState(false);
  const [cardioEdits, setCardioEdits] = useState([]);

  const dayEntries = useMemo(
    () => DAY_ORDER.map((dayNum) => ({ dayNum, day: plan[dayNum] })),
    [plan],
  );

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setView("menu");
    Promise.all([
      loadRestDays(),
      loadCustomPlan(),
      loadDayOverrides(),
      loadCardioConfig(),
    ]).then(([restDays, customPlan, overrides, savedCardio]) => {
      if (!active) return;
      const storedRest = restDays[dateKey];
      setTodayRest(!!storedRest && (storedRest === true || storedRest.isRest === true));
      setDayOverride(overrides[dateKey] ?? null);
      setPlan(
        customPlan && typeof customPlan === "object"
          ? customPlan
          : clonePlan(PLAN),
      );
      setCardioConfig(savedCardio || DEFAULT_CARDIO_CONFIG);
      setEditingCardio(false);
      setCardioEdits([]);
    });

    return () => {
      active = false;
    };
  }, [visible, dateKey]);

  const persistPlan = async (nextPlan) => {
    setPlan(nextPlan);
    await saveCustomPlan(nextPlan);
  };

  const toggleTodayRest = async (value) => {
    setTodayRest(value);
    await saveRestDay(dateKey, value);
    if (onChanged) await onChanged();
  };

  const selectDayOverride = async (dow) => {
    const key = dateKey;
    await saveDayOverride(key, dow);
    setDayOverride(dow);
    if (onChanged) await onChanged();
  };

  const clearDayOverride = async () => {
    const key = dateKey;
    await saveDayOverride(key, null);
    setDayOverride(null);
    if (onChanged) await onChanged();
  };

  const updateGroupName = (dayNum, groupIndex, value) => {
    const next = clonePlan(plan);
    next[dayNum].groups[groupIndex].name = value;
    persistPlan(next);
  };

  const updateExerciseName = (dayNum, groupIndex, exerciseIndex, value) => {
    const next = clonePlan(plan);
    next[dayNum].groups[groupIndex].exercises[exerciseIndex] = value;
    persistPlan(next);
  };

  const resetToDefaults = async () => {
    await clearCustomPlan();
    setPlan(clonePlan(PLAN));
    if (onChanged) await onChanged();
  };

  const startEditingCardio = () => {
    setCardioEdits(
      cardioConfig.map((item) => ({
        ...item,
        originalName: item.name,
      }))
    );
    setEditingCardio(true);
  };

  const updateCardioEdit = (index, field, value) => {
    setCardioEdits((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value };
        if (field === "metric" && value !== "steps+km") {
          delete next.stepGoal;
        }
        if (field === "metric" && value === "steps+km" && !next.stepGoal) {
          next.stepGoal = 10000;
        }
        return next;
      }),
    );
  };

  const addCardioExercise = () => {
    setCardioEdits((prev) => [
      ...prev,
      {
        id: `cardio_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: "",
        metric: "minutes",
      },
    ]);
  };

  const removeCardioExercise = (index) => {
    setCardioEdits((prev) => prev.filter((_, i) => i !== index));
  };

  const saveCardioEdits = async () => {
    const names = cardioEdits.map((c) => c.name.trim()).filter(Boolean);
    if (names.length === 0) {
      Alert.alert(
        "Invalid config",
        "You must have at least one cardio exercise.",
      );
      return;
    }
    const hasDuplicates = names.length !== new Set(names).size;
    if (hasDuplicates) {
      Alert.alert(
        "Duplicate names",
        "Each cardio exercise must have a unique name.",
      );
      return;
    }
    const hasEmpty = cardioEdits.some((c) => !c.name.trim());
    if (hasEmpty) {
      Alert.alert("Empty name", "All cardio exercises must have a name.");
      return;
    }

    const oldNames = cardioConfig.map((c) => c.name);
    const newNames = cardioEdits.map((c) => c.name.trim());

    let migratedSessions = null;
    for (let i = 0; i < Math.min(oldNames.length, newNames.length); i++) {
      if (oldNames[i] !== newNames[i] && oldNames[i] && newNames[i]) {
        if (!migratedSessions) {
          migratedSessions = await loadSessions();
        }
        const result = renameExerciseInSessions(
          migratedSessions,
          oldNames[i],
          newNames[i],
        );
        if (result.changed) migratedSessions = result.sessions;
      }
    }
    if (migratedSessions) {
      await saveSessions(migratedSessions);
    }

    const nextConfig = cardioEdits
      .map((entry) => {
        const trimmed = {
          id: entry.id || `cardio_${entry.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`,
          name: entry.name.trim(),
          metric: entry.metric,
        };
        if (entry.metric === "steps+km") {
          trimmed.stepGoal = parseInt(entry.stepGoal, 10) || 10000;
        }
        return trimmed;
      })
      .filter((entry) => entry.name);

    await saveCardioConfig(nextConfig);
    setCardioConfig(nextConfig);
    setEditingCardio(false);
    setCardioEdits([]);
    if (onChanged) await onChanged();
  };

  const resetCardioToDefaults = async () => {
    await resetCardioConfig();
    setCardioConfig(DEFAULT_CARDIO_CONFIG);
    setEditingCardio(false);
    setCardioEdits([]);
    if (onChanged) await onChanged();
  };

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
            contentContainerStyle={{ paddingBottom: 18 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {view === "menu" && (
              <View
                style={[
                  s.menu,
                  { borderColor: t.border, backgroundColor: t.surface },
                ]}
              >
                {MENU_ITEMS.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      s.menuRow,
                      index > 0 && {
                        borderTopWidth: 0.5,
                        borderTopColor: t.border,
                      },
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
                      <Text style={[s.menuTitle, { color: t.text }]}>
                        {item.title}
                      </Text>
                      <Text style={[s.menuSub, { color: t.textSub }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={t.textHint}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {view === "restday" && (
            <View
              style={[
                s.section,
                { borderColor: t.border, backgroundColor: t.surface },
              ]}
            >
              <Text style={[s.sectionTitle, { color: t.text }]}>
                Mark Rest Day
              </Text>
              <View style={[s.row, { borderTopColor: t.border }]}>
                <Text style={[s.rowText, { color: t.text }]}>
                  {dateKey === todayKey() ? "Mark today as rest day" : "Mark this day as rest day"}
                </Text>
                <Switch
                  value={todayRest}
                  onValueChange={toggleTodayRest}
                  trackColor={{ false: t.border, true: t.accent }}
                  thumbColor={Platform.OS === "android" ? "#fff" : undefined}
                />
              </View>
            </View>
            )}

            {view === "workout" && (
            <View
              style={[
                s.section,
                { borderColor: t.border, backgroundColor: t.surface },
              ]}
            >
              <Text style={[s.sectionTitle, { color: t.text }]}>
                {dateKey === todayKey() ? "Replace Today's Day" : "Replace Day's Workout"}
              </Text>
              <View style={s.overrideWrap}>
                {DAY_OPTIONS.map((option) => {
                  const selected = dayOverride === option.dow;
                  return (
                    <TouchableOpacity
                      key={option.dow}
                      style={[
                        s.overrideBtn,
                        { borderColor: t.border, backgroundColor: t.inputBg },
                        selected && {
                          borderColor: t.accent,
                          backgroundColor: t.accent,
                        },
                      ]}
                      onPress={() => selectDayOverride(option.dow)}
                    >
                      <Text
                        style={[
                          s.overrideBtnText,
                          { color: selected ? "#fff" : t.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={[s.row, { borderTopColor: t.border }]}>
                <Text style={[s.rowText, { color: t.text }]}>
                  Active override
                </Text>
                <Text
                  style={[
                    s.overrideValue,
                    { color: dayOverride !== null ? t.accent : t.textSub },
                  ]}
                >
                  {dayOverride !== null
                    ? DAY_OPTIONS.find((option) => option.dow === dayOverride)
                      ?.label
                    : "None"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  s.clearOverrideBtn,
                  { borderColor: t.border, backgroundColor: t.inputBg },
                ]}
                onPress={clearDayOverride}
              >
                <Text style={[s.resetText, { color: t.textSub }]}>
                  Clear override
                </Text>
              </TouchableOpacity>
            </View>
            )}

            {view === "cardio" && (
            <View
              style={[
                s.section,
                { borderColor: t.border, backgroundColor: t.surface },
              ]}
            >
              <View style={s.sectionHeaderRow}>
                <Text
                  style={[
                    s.sectionTitle,
                    s.sectionTitleInline,
                    { color: t.text },
                  ]}
                >
                  Cardio Exercises
                </Text>
                {!editingCardio && (
                  <TouchableOpacity
                    style={[
                      s.editLinkBtn,
                      { borderColor: t.border, backgroundColor: t.inputBg },
                    ]}
                    onPress={startEditingCardio}
                  >
                    <Text style={[s.editLinkText, { color: t.accent }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {!editingCardio ? (
                <>
                  {cardioConfig.map((entry, index) => (
                    <View
                      key={`${entry.name}-${index}`}
                      style={[s.cardioListRow, { borderTopColor: t.border }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.cardioListName, { color: t.text }]}>
                          {entry.name}
                        </Text>
                        <Text style={[s.cardioListSub, { color: t.textSub }]}>
                          {metricLabel(entry.metric)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[
                      s.resetBtn,
                      { borderColor: t.border, backgroundColor: t.inputBg },
                    ]}
                    onPress={resetCardioToDefaults}
                  >
                    <Text style={[s.resetText, { color: t.textSub }]}>
                      Reset to defaults
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {cardioEdits.map((entry, index) => (
                    <View
                      key={index}
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
                            updateCardioEdit(index, "name", value)
                          }
                          placeholder="Exercise name"
                          placeholderTextColor={t.textHint}
                        />
                        <TouchableOpacity
                          style={[
                            s.cardioDeleteBtn,
                            {
                              borderColor: t.border,
                              backgroundColor: t.inputBg,
                            },
                          ]}
                          onPress={() => removeCardioExercise(index)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={t.destructiveColor}
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={s.metricChipRow}>
                        {METRIC_OPTIONS.map((option) => {
                          const selected = entry.metric === option.value;
                          return (
                            <TouchableOpacity
                              key={option.value}
                              style={[
                                s.metricChip,
                                {
                                  borderColor: t.border,
                                  backgroundColor: t.inputBg,
                                },
                                selected && {
                                  borderColor: t.accent,
                                  backgroundColor: t.accent,
                                },
                              ]}
                              onPress={() =>
                                updateCardioEdit(index, "metric", option.value)
                              }
                            >
                              <Text
                                style={[
                                  s.metricChipText,
                                  { color: selected ? "#fff" : t.textSub },
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {entry.metric === "steps+km" && (
                        <View
                          style={[
                            s.stepGoalRow,
                            {
                              borderColor: t.border,
                              backgroundColor: t.inputBg,
                            },
                          ]}
                        >
                          <Text style={[s.stepGoalLabel, { color: t.textSub }]}>
                            Step goal
                          </Text>
                          <TextInput
                            style={[
                              s.stepGoalInput,
                              {
                                backgroundColor: t.surface,
                                borderColor: t.border,
                                color: t.text,
                              },
                            ]}
                            value={
                              entry.stepGoal != null
                                ? String(entry.stepGoal)
                                : ""
                            }
                            onChangeText={(value) =>
                              updateCardioEdit(index, "stepGoal", value)
                            }
                            placeholder="10000"
                            placeholderTextColor={t.textHint}
                            keyboardType="number-pad"
                          />
                        </View>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[
                      s.addCardioBtn,
                      { borderColor: t.border, backgroundColor: t.inputBg },
                    ]}
                    onPress={addCardioExercise}
                  >
                    <Ionicons name="add" size={16} color={t.accent} />
                    <Text style={[s.addCardioText, { color: t.accent }]}>
                      Add exercise
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.saveCardioBtn, { backgroundColor: t.accent }]}
                    onPress={saveCardioEdits}
                  >
                    <Text style={[s.saveCardioText, { color: t.accentText }]}>
                      Save cardio config
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      s.resetBtn,
                      { borderColor: t.border, backgroundColor: t.inputBg },
                    ]}
                    onPress={resetCardioToDefaults}
                  >
                    <Text style={[s.resetText, { color: t.textSub }]}>
                      Reset to defaults
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            )}

            {view === "exercises" && (
            <View
              style={[
                s.section,
                { borderColor: t.border, backgroundColor: t.surface },
              ]}
            >
              <Text style={[s.sectionTitle, { color: t.text }]}>
                Edit Exercises
              </Text>
              {dayEntries.map(({ dayNum, day }) => {
                const expanded = !!expandedDays[dayNum];
                return (
                  <View
                    key={dayNum}
                    style={[s.dayBlock, { borderTopColor: t.border }]}
                  >
                    <TouchableOpacity
                      style={[s.dayHeader, { backgroundColor: t.inputBg }]}
                      onPress={() =>
                        setExpandedDays((prev) => ({
                          ...prev,
                          [dayNum]: !prev[dayNum],
                        }))
                      }
                      activeOpacity={0.85}
                    >
                      <Text style={[s.dayTitle, { color: t.text }]}>
                        {day?.label || `Day ${dayNum}`}
                      </Text>
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={t.textSub}
                      />
                    </TouchableOpacity>

                    {expanded &&
                      day?.groups?.map((group, groupIndex) => (
                        <View
                          key={`${dayNum}-${groupIndex}`}
                          style={[s.groupBlock, { borderColor: t.border }]}
                        >
                          <TextInput
                            style={[
                              s.groupInput,
                              {
                                backgroundColor: t.inputBg,
                                borderColor: t.border,
                                color: t.text,
                              },
                            ]}
                            value={group.name}
                            onChangeText={(value) =>
                              updateGroupName(dayNum, groupIndex, value)
                            }
                            placeholder="Muscle group"
                            placeholderTextColor={t.textHint}
                          />
                          {group.exercises.map((exercise, exerciseIndex) => (
                            <TextInput
                              key={`${dayNum}-${groupIndex}-${exerciseIndex}`}
                              style={[
                                s.exerciseInput,
                                {
                                  backgroundColor: t.inputBg,
                                  borderColor: t.border,
                                  color: t.text,
                                },
                              ]}
                              value={exercise}
                              onChangeText={(value) =>
                                updateExerciseName(
                                  dayNum,
                                  groupIndex,
                                  exerciseIndex,
                                  value,
                                )
                              }
                              placeholder="Exercise"
                              placeholderTextColor={t.textHint}
                            />
                          ))}
                        </View>
                      ))}
                  </View>
                );
              })}

              <TouchableOpacity
                style={[
                  s.resetBtn,
                  { borderColor: t.border, backgroundColor: t.inputBg },
                ]}
                onPress={resetToDefaults}
              >
                <Text style={[s.resetText, { color: t.textSub }]}>
                  Reset to defaults
                </Text>
              </TouchableOpacity>
            </View>
            )}

            {view === "about" && (
              <View
                style={[
                  s.section,
                  { borderColor: t.border, backgroundColor: t.surface },
                ]}
              >
                <View style={s.aboutHeader}>
                  <AppLogo theme={t} />
                </View>
                <View style={[s.aboutRow, { borderTopColor: t.border }]}>
                  <Text style={[s.aboutLabel, { color: t.textSub }]}>
                    Version
                  </Text>
                  <Text style={[s.aboutValue, { color: t.text }]}>v5.1</Text>
                </View>
                <View style={[s.aboutRow, { borderTopColor: t.border }]}>
                  <Text style={[s.aboutLabel, { color: t.textSub }]}>
                    Release
                  </Text>
                  <Text style={[s.aboutValue, { color: t.text }]}>
                    UI polish & data consistency
                  </Text>
                </View>
                <Text
                  style={[
                    s.aboutFooter,
                    { color: t.textSub, borderTopColor: t.border },
                  ]}
                >
                  A practical workout logging app for consistency, progression
                  tracking, and LLM-ready insights.
                </Text>
              </View>
            )}
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
    height: "75%",
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
    paddingBottom: 0,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  editLinkBtn: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editLinkText: { fontSize: 12, fontWeight: "600" },
  cardioListRow: {
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardioListName: { fontSize: 13, fontWeight: "600" },
  cardioListSub: { fontSize: 11, marginTop: 2 },
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
  metricChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metricChip: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metricChipText: { fontSize: 11, fontWeight: "600" },
  stepGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  stepGoalLabel: { fontSize: 12, fontWeight: "500" },
  stepGoalInput: {
    minWidth: 88,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    textAlign: "center",
  },
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
  saveCardioBtn: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 14,
    marginTop: 8,
    paddingVertical: 12,
  },
  saveCardioText: { fontSize: 13, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowText: { fontSize: 13, fontWeight: "500", flex: 1, paddingRight: 10 },
  overrideWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  overrideBtn: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  overrideBtnText: { fontSize: 12, fontWeight: "600" },
  overrideValue: { fontSize: 12, fontWeight: "600" },
  clearOverrideBtn: {
    borderTopWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    marginTop: 2,
  },
  dayBlock: {
    borderTopWidth: 0.5,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayTitle: { fontSize: 13, fontWeight: "600" },
  groupBlock: {
    borderWidth: 0.5,
    borderRadius: 12,
    marginTop: 10,
    padding: 10,
  },
  groupInput: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  exerciseInput: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    marginTop: 8,
  },
  resetBtn: {
    borderWidth: 0.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 2,
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
  },
  aboutLabel: { fontSize: 13, fontWeight: "500" },
  aboutValue: { fontSize: 13, fontWeight: "600" },
  aboutFooter: {
    fontSize: 12,
    lineHeight: 17,
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
});

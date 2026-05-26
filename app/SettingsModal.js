import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, Switch, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { PLAN } from './data';
import { todayKey, loadDayOverrides, saveDayOverride } from './storage';

const REST_KEY = 'rest_days_v1';
const CUSTOM_KEY = 'custom_exercises_v1';
const DAY_OPTIONS = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
];

const DAY_ORDER = [1, 2, 3, 4, 5, 6];

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

async function loadRestDays() {
  try {
    const raw = await AsyncStorage.getItem(REST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveRestDays(restDays) {
  try {
    await AsyncStorage.setItem(REST_KEY, JSON.stringify(restDays));
  } catch {}
}

async function loadCustomExercises() {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveCustomExercises(plan) {
  try {
    await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(plan));
  } catch {}
}

async function clearCustomExercises() {
  try {
    await AsyncStorage.removeItem(CUSTOM_KEY);
  } catch {}
}

export default function SettingsModal({ visible, onClose, onChanged, theme: t }) {
  const [todayRest, setTodayRest] = useState(false);
  const [expandedDays, setExpandedDays] = useState({});
  const [plan, setPlan] = useState(clonePlan(PLAN));
  const [dayOverride, setDayOverride] = useState(null);

  const dayEntries = useMemo(
    () => DAY_ORDER.map(dayNum => ({ dayNum, day: plan[dayNum] })),
    [plan]
  );

  useEffect(() => {
    if (!visible) return;

    let active = true;
    Promise.all([loadRestDays(), loadCustomExercises(), loadDayOverrides()]).then(([restDays, customPlan, overrides]) => {
      if (!active) return;
      setTodayRest(!!restDays[todayKey()]?.isRest);
      setDayOverride(overrides[todayKey()] ?? null);
      setPlan(customPlan && typeof customPlan === 'object' ? customPlan : clonePlan(PLAN));
    });

    return () => {
      active = false;
    };
  }, [visible]);

  const persistPlan = async (nextPlan) => {
    setPlan(nextPlan);
    await saveCustomExercises(nextPlan);
  };

  const toggleTodayRest = async (value) => {
    setTodayRest(value);
    const restDays = await loadRestDays();
    const key = todayKey();
    if (value) restDays[key] = { date: key, isRest: true };
    else delete restDays[key];
    await saveRestDays(restDays);
  };

  const selectDayOverride = async (dow) => {
    const key = todayKey();
    await saveDayOverride(key, dow);
    setDayOverride(dow);
    if (onChanged) await onChanged();
  };

  const clearDayOverride = async () => {
    const key = todayKey();
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
    await clearCustomExercises();
    setPlan(clonePlan(PLAN));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: t.surface, borderTopColor: t.border }]}> 
          <View style={s.handleWrap}>
            <View style={[s.handle, { backgroundColor: t.border }]} />
          </View>

          <View style={[s.header, { borderBottomColor: t.border }]}> 
            <Text style={[s.title, { color: t.text }]}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: t.inputBg, borderColor: t.border }]}> 
              <Ionicons name="close" size={18} color={t.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
            <View style={[s.section, { borderColor: t.border, backgroundColor: t.surface }]}> 
              <Text style={[s.sectionTitle, { color: t.text }]}>Mark Rest Day</Text>
              <View style={[s.row, { borderTopColor: t.border }]}> 
                <Text style={[s.rowText, { color: t.text }]}>Mark today as rest day</Text>
                <Switch
                  value={todayRest}
                  onValueChange={toggleTodayRest}
                  trackColor={{ false: t.border, true: t.accent }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                />
              </View>
            </View>

            <View style={[s.section, { borderColor: t.border, backgroundColor: t.surface }]}> 
              <Text style={[s.sectionTitle, { color: t.text }]}>Replace Today's Day</Text>
              <View style={s.overrideWrap}>
                {DAY_OPTIONS.map(option => {
                  const selected = dayOverride === option.dow;
                  return (
                    <TouchableOpacity
                      key={option.dow}
                      style={[
                        s.overrideBtn,
                        { borderColor: t.border, backgroundColor: t.inputBg },
                        selected && { borderColor: t.accent, backgroundColor: t.accent },
                      ]}
                      onPress={() => selectDayOverride(option.dow)}
                    >
                      <Text style={[s.overrideBtnText, { color: selected ? '#fff' : t.text }]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={[s.row, { borderTopColor: t.border }]}> 
                <Text style={[s.rowText, { color: t.text }]}>Active override</Text>
                <Text style={[s.overrideValue, { color: dayOverride !== null ? t.accent : t.textSub }]}>
                  {dayOverride !== null ? DAY_OPTIONS.find(option => option.dow === dayOverride)?.label : 'None'}
                </Text>
              </View>
              <TouchableOpacity style={[s.clearOverrideBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={clearDayOverride}>
                <Text style={[s.resetText, { color: t.textSub }]}>Clear override</Text>
              </TouchableOpacity>
            </View>

            <View style={[s.section, { borderColor: t.border, backgroundColor: t.surface }]}> 
              <Text style={[s.sectionTitle, { color: t.text }]}>Edit Exercises</Text>
              {dayEntries.map(({ dayNum, day }) => {
                const expanded = !!expandedDays[dayNum];
                return (
                  <View key={dayNum} style={[s.dayBlock, { borderTopColor: t.border }]}> 
                    <TouchableOpacity
                      style={[s.dayHeader, { backgroundColor: t.inputBg }]}
                      onPress={() => setExpandedDays(prev => ({ ...prev, [dayNum]: !prev[dayNum] }))}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.dayTitle, { color: t.text }]}>{day?.label || `Day ${dayNum}`}</Text>
                      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={t.textSub} />
                    </TouchableOpacity>

                    {expanded && day?.groups?.map((group, groupIndex) => (
                      <View key={`${dayNum}-${groupIndex}`} style={[s.groupBlock, { borderColor: t.border }]}> 
                        <TextInput
                          style={[s.groupInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                          value={group.name}
                          onChangeText={value => updateGroupName(dayNum, groupIndex, value)}
                          placeholder="Muscle group"
                          placeholderTextColor={t.textHint}
                        />
                        {group.exercises.map((exercise, exerciseIndex) => (
                          <TextInput
                            key={`${dayNum}-${groupIndex}-${exerciseIndex}`}
                            style={[s.exerciseInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                            value={exercise}
                            onChangeText={value => updateExerciseName(dayNum, groupIndex, exerciseIndex, value)}
                            placeholder="Exercise"
                            placeholderTextColor={t.textHint}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })}

              <TouchableOpacity style={[s.resetBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={resetToDefaults}>
                <Text style={[s.resetText, { color: t.textSub }]}>Reset to defaults</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '75%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 0.5,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 99,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  title: { fontSize: 18, fontWeight: '600' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  content: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  section: {
    borderWidth: 0.5,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowText: { fontSize: 13, fontWeight: '500', flex: 1, paddingRight: 10 },
  overrideWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  overrideBtn: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overrideBtnText: { fontSize: 12, fontWeight: '600' },
  overrideValue: { fontSize: 12, fontWeight: '600' },
  clearOverrideBtn: {
    borderTopWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayTitle: { fontSize: 13, fontWeight: '600' },
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
    fontWeight: '600',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 2,
  },
  resetText: { fontSize: 13, fontWeight: '600' },
});

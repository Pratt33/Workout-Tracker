import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert,
  Animated, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../app/theme';
import AppLogo from '../app/AppLogo';
import { PLAN } from '../app/data';
import {
  loadSessions,
  saveSessions,
  todayKey,
  loadWorkoutPlan,
  saveWorkoutPlan,
  renameExerciseInSessions,
  getLatestExerciseSets,
  formatDate,
} from '../app/storage';

const EMPTY_SETS = () => [
  { label: 'Set 1',  w: '', r: '10', dead: false },
  { label: 'Set 2',  w: '', r: '10', dead: false },
  { label: 'Set 3',  w: '', r: '',   dead: true  },
  { label: 'Drop 1', w: '', r: '',   dead: true  },
  { label: 'Drop 2', w: '', r: '',   dead: true  },
];

function AnimatedExRow({ ex, isDone, onPress, onEdit, index, t }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      delay: index * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const checkScale = useRef(new Animated.Value(isDone ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: isDone ? 1 : 0,
      useNativeDriver: true,
      damping: 10,
      stiffness: 200,
    }).start();
  }, [isDone]);

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        { scale },
      ]
    }}>
      <View style={[s.exRow, { borderTopColor: t.border }]}> 
        <TouchableOpacity
          style={s.exMainTap}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <Text style={[s.exName, { color: t.text }]}>{ex}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.editBtn, { borderColor: t.border, backgroundColor: t.inputBg }]}
          onPress={onEdit}
        >
          <Text style={[s.editBtnText, { color: t.textSub }]}>Edit</Text>
        </TouchableOpacity>
        <Animated.View style={[s.check, { borderColor: t.borderStrong }, isDone && { backgroundColor: t.success, borderColor: t.success }, { transform: [{ scale: checkScale.interpolate({ inputRange: [0,1], outputRange: [0.6, 1] }) }] }]}>
          {isDone && <Text style={s.checkMark}>✓</Text>}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function TodayScreen() {
  const t = useTheme();
  const [sessions, setSessions] = useState({});
  const [planMap, setPlanMap] = useState(PLAN);
  const [activeEx, setActiveEx] = useState(null);
  const [activeSets, setActiveSets] = useState([]);
  const [prefillDate, setPrefillDate] = useState(null);
  const [editingEx, setEditingEx] = useState(null);
  const [editingName, setEditingName] = useState('');
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const saveScaleAnim = useRef(new Animated.Value(1)).current;
  const dow = new Date().getDay();
  const day = planMap[dow];
  const tk = todayKey();

  useFocusEffect(useCallback(() => {
    Promise.all([loadSessions(), loadWorkoutPlan()]).then(([s, savedPlan]) => {
      if (!s[tk]) s[tk] = { _dow: dow };
      setSessions({ ...s });
      if (savedPlan && typeof savedPlan === 'object') {
        setPlanMap(savedPlan);
      } else {
        setPlanMap(PLAN);
      }
    });
  }, []));

  const openLogger = (ex) => {
    const existing = sessions[tk]?.[ex];
    if (existing?.length) {
      setActiveSets(JSON.parse(JSON.stringify(existing)));
      setPrefillDate(null);
    } else {
      const last = getLatestExerciseSets(sessions, ex, tk);
      if (last.sets?.length) {
        setActiveSets(last.sets);
        setPrefillDate(last.dateKey);
      } else {
        setActiveSets(EMPTY_SETS());
        setPrefillDate(null);
      }
    }
    setActiveEx(ex);
    slideAnim.setValue(60);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeLogger = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 60, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setActiveEx(null);
      setPrefillDate(null);
    });
  };

  const handleSavePressIn = () => {
    Animated.spring(saveScaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 35 }).start();
  };

  const handleSavePressOut = () => {
    Animated.spring(saveScaleAnim, { toValue: 1, useNativeDriver: true, speed: 35 }).start();
  };

  const updateSet = (i, field, val) => {
    const next = [...activeSets];
    next[i] = { ...next[i], [field]: val };
    setActiveSets(next);
  };

  const saveExercise = async () => {
    const next = { ...sessions };
    if (!next[tk]) next[tk] = { _dow: dow };
    next[tk][activeEx] = activeSets;
    setSessions(next);
    await saveSessions(next);
    closeLogger();
  };

  const startEditingExercise = (groupIndex, exerciseIndex, ex) => {
    setEditingEx({ groupIndex, exerciseIndex, oldName: ex });
    setEditingName(ex);
  };

  const cancelEditingExercise = () => {
    setEditingEx(null);
    setEditingName('');
  };

  const saveEditedExercise = async () => {
    if (!editingEx || !day) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      Alert.alert('Invalid name', 'Exercise name cannot be empty.');
      return;
    }
    const group = day.groups[editingEx.groupIndex];
    const duplicate = group.exercises.some((n, i) => i !== editingEx.exerciseIndex && n.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      Alert.alert('Already exists', 'That exercise already exists in this muscle group.');
      return;
    }

    const nextPlan = JSON.parse(JSON.stringify(planMap));
    nextPlan[dow].groups[editingEx.groupIndex].exercises[editingEx.exerciseIndex] = trimmed;
    await saveWorkoutPlan(nextPlan);

    const migrated = renameExerciseInSessions(sessions, editingEx.oldName, trimmed);
    if (migrated.changed) await saveSessions(migrated.sessions);

    setPlanMap(nextPlan);
    setSessions({ ...migrated.sessions });
    if (activeEx === editingEx.oldName) setActiveEx(trimmed);
    cancelEditingExercise();
  };

  const totalVol = activeSets.reduce((a, s) => a + (parseFloat(s.w) || 0) * (parseInt(s.r) || 0), 0);

  if (editingEx && day) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}> 
        <View style={[s.topbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}> 
          <View style={s.topbarRow}>
            <View>
              <Text style={[s.topTitle, { color: t.text }]}>Edit exercise</Text>
              <Text style={[s.topSub, { color: t.textSub }]}>{day.label}</Text>
            </View>
            <AppLogo theme={t} compact />
          </View>
        </View>
        <View style={s.editWrap}>
          <View style={[s.editCard, { backgroundColor: t.surface, borderColor: t.border }]}> 
            <Text style={[s.editLabel, { color: t.textSub }]}>Exercise name</Text>
            <TextInput
              style={[s.editInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="Exercise name"
              placeholderTextColor={t.textHint}
              autoFocus
            />
            <View style={s.editActions}>
              <TouchableOpacity
                style={[s.secondaryBtn, { backgroundColor: t.inputBg, borderColor: t.border }]}
                onPress={cancelEditingExercise}
              >
                <Text style={[s.secondaryBtnText, { color: t.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: t.accent }]}
                onPress={saveEditedExercise}
              >
                <Text style={[s.primaryBtnText, { color: t.accentText }]}>Save name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (activeEx) {
    const loggerScale = fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });

    return (
      <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
        <Animated.View style={[s.loggerWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: loggerScale }] }]}> 
          <View style={[s.loggerTopbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
            <View style={s.loggerTopbarRow}>
              <TouchableOpacity
                onPress={closeLogger}
                style={[s.backChip, { backgroundColor: t.inputBg, borderColor: t.border }]}
              >
                <Ionicons name="chevron-back" size={16} color={t.accent} />
                <Text style={[s.backChipText, { color: t.accent }]}>Workout</Text>
              </TouchableOpacity>
              <Text style={[s.loggerTitle, { color: t.text }]} numberOfLines={1}>{activeEx}</Text>
            </View>
            <Text style={[s.loggerSub, { color: t.textSub }]}>Track each set with clean form and controlled tempo</Text>
            {!!prefillDate && (
              <View style={[s.prefillBadge, { borderColor: t.border, backgroundColor: t.inputBg }]}> 
                <Ionicons name="sparkles-outline" size={12} color={t.accent} />
                <Text style={[s.prefillBadgeText, { color: t.textSub }]}>Prefilled from {formatDate(prefillDate)}</Text>
              </View>
            )}
          </View>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[s.setHeader, { borderBottomColor: t.border, backgroundColor: t.inputBg }]}>
                <Text style={[s.setColHdr, { flex: 1.4, color: t.textHint }]}>Set</Text>
                <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Weight kg</Text>
                <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Reps</Text>
                <Text style={[s.setColHdr, { flex: 0.8, textAlign: 'right', color: t.textHint }]}>Vol</Text>
              </View>
              {activeSets.map((set, i) => {
                const vol = (parseFloat(set.w) || 0) * (parseInt(set.r) || 0);
                return (
                  <View key={i} style={[s.setRow, { borderTopColor: t.border }]}>
                    <Text style={[s.setLabel, { color: set.dead ? t.deadColor : t.textSub }, { flex: 1.4 }]}>{set.label}</Text>
                    <View style={{ flex: 1, paddingHorizontal: 4 }}>
                      <TextInput
                        style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                        value={set.w}
                        onChangeText={v => updateSet(i, 'w', v)}
                        placeholder="kg"
                        placeholderTextColor={t.textHint}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 4 }}>
                      <TextInput
                        style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                        value={set.r}
                        onChangeText={v => updateSet(i, 'r', v)}
                        placeholder="reps"
                        placeholderTextColor={t.textHint}
                        keyboardType="number-pad"
                      />
                    </View>
                    <Text style={[s.setVol, { flex: 0.8, color: vol > 0 ? t.accent : t.textHint }]}>
                      {vol > 0 ? Math.round(vol) + '' : '—'}
                    </Text>
                  </View>
                );
              })}
              <View style={[s.totalRow, { borderTopColor: t.border }]}>
                <Text style={[s.totalLabel, { color: t.textSub }]}>Total volume</Text>
                <Text style={[s.totalVal, { color: t.text }]}>{Math.round(totalVol).toLocaleString()} kg</Text>
              </View>
            </View>
            <View style={s.deadNote}>
              <Text style={[s.deadNoteText, { color: t.textHint }]}>Set 3 → Drop 1 → Drop 2 are dead sets — no rest between them</Text>
            </View>
            <Animated.View style={{ transform: [{ scale: saveScaleAnim }] }}>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: t.accent }]}
                onPress={saveExercise}
                onPressIn={handleSavePressIn}
                onPressOut={handleSavePressOut}
              >
                <Ionicons name="checkmark-circle" size={18} color={t.accentText} />
                <Text style={[s.saveBtnText, { color: t.accentText }]}>Save exercise</Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (!day) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
        <View style={[s.topbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
          <View style={s.topbarRow}>
            <Text style={[s.topTitle, { color: t.text }]}>Rest day</Text>
            <AppLogo theme={t} compact />
          </View>
        </View>
        <View style={s.restScreen}>
          <Text style={[s.restDash, { color: t.textHint }]}>—</Text>
          <Text style={[s.restTitle, { color: t.text }]}>Rest day</Text>
          <Text style={[s.restSub, { color: t.textSub }]}>Recovery is part of the process.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalDone = day.groups.reduce((a, g) =>
    a + g.exercises.filter(ex => sessions[tk]?.[ex]?.length > 0).length, 0);
  const totalEx = day.groups.reduce((a, g) => a + g.exercises.length, 0);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
      <View style={[s.topbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
        <View style={s.topbarRow}>
          <View>
            <Text style={[s.topTitle, { color: t.text }]}>{day.label}</Text>
            <Text style={[s.topSub, { color: t.textSub }]}> 
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              {totalDone > 0 ? `  ·  ${totalDone}/${totalEx} done` : ''}
            </Text>
          </View>
          <AppLogo theme={t} compact />
        </View>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
        {day.groups.map((g, gi) => {
          const done = g.exercises.filter(ex => sessions[tk]?.[ex]?.length > 0).length;
          return (
            <View key={gi} style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[s.groupHdr, { borderBottomColor: t.border }]}>
                <View style={[s.dot, { backgroundColor: g.color }]} />
                <Text style={[s.groupName, { color: t.text }]}>{g.name}</Text>
                <View style={[s.badge, { backgroundColor: done === g.exercises.length ? t.success + '22' : t.inputBg }]}>
                  <Text style={[s.badgeText, { color: done === g.exercises.length ? t.success : t.textSub }]}>
                    {done}/{g.exercises.length}
                  </Text>
                </View>
              </View>
              {g.exercises.map((ex, ei) => (
                <AnimatedExRow
                  key={ei}
                  ex={ex}
                  isDone={sessions[tk]?.[ex]?.length > 0}
                  onPress={() => openLogger(ex)}
                  onEdit={() => startEditingExercise(gi, ei, ex)}
                  index={ei}
                  t={t}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  topbar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  topbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  topTitle: { fontSize: 20, fontWeight: '600' },
  topSub: { fontSize: 12, marginTop: 3 },
  scroll: { flex: 1, padding: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  groupHdr: { flexDirection: 'row', alignItems: 'center', padding: 13, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  groupName: { flex: 1, fontSize: 14, fontWeight: '500' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  exRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderTopWidth: 0.5, gap: 8 },
  exMainTap: { flex: 1 },
  exName: { flex: 1, fontSize: 13, lineHeight: 18 },
  editBtn: { borderWidth: 0.5, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontSize: 11, fontWeight: '500' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loggerWrap: { flex: 1 },
  loggerTopbar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 0.5 },
  loggerTopbarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backChipText: { fontSize: 12, fontWeight: '600' },
  loggerTitle: { fontSize: 17, fontWeight: '600' },
  loggerSub: { fontSize: 11, marginTop: 8 },
  prefillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  prefillBadgeText: { fontSize: 10, fontWeight: '500' },
  setHeader: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  setColHdr: { fontSize: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderTopWidth: 0.5 },
  setLabel: { fontSize: 12 },
  numInput: { borderWidth: 0.5, borderRadius: 8, paddingVertical: 7, fontSize: 13, textAlign: 'center' },
  setVol: { fontSize: 11, textAlign: 'right', fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 0.5 },
  totalLabel: { fontSize: 12 },
  totalVal: { fontSize: 16, fontWeight: '600' },
  deadNote: { padding: 10, alignItems: 'center' },
  deadNoteText: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  saveBtn: {
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 4,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '600' },
  restScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  restDash: { fontSize: 48, marginBottom: 16 },
  restTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  restSub: { fontSize: 13, textAlign: 'center' },
  editWrap: { flex: 1, padding: 12 },
  editCard: { borderRadius: 14, borderWidth: 0.5, padding: 14 },
  editLabel: { fontSize: 12, marginBottom: 6 },
  editInput: { borderWidth: 0.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryBtn: { flex: 1, borderWidth: 0.5, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 13, fontWeight: '500' },
  primaryBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '600' },
});

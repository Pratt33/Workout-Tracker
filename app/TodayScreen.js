import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Animated,
  Easing,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../app/theme';
import AppLogo from '../app/AppLogo';
import SettingsModal from './SettingsModal';
import { PLAN as DEFAULT_PLAN, isCardioExercise, isWeightExercise } from '../app/data';
import {
  loadSessions,
  saveSessions,
  todayKey,
  renameExerciseInSessions,
  getLatestExerciseSets,
  formatDate,
  loadCustomPlan,
  loadRestDays,
  saveCustomPlan,
} from '../app/storage';

const EMPTY_SETS = () => [
  { label: 'Set 1', w: '', r: '10', dead: false },
  { label: 'Set 2', w: '', r: '10', dead: false },
  { label: 'Set 3', w: '', r: '', dead: true },
  { label: 'Drop 1', w: '', r: '', dead: true },
  { label: 'Drop 2', w: '', r: '', dead: true },
];

function AnimatedExRow({ ex, isDone, onPress, onEdit, index, t }) {
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

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale },
        ],
      }}
    >
      <View style={[s.exRow, { borderTopColor: t.border }, isDone && { borderLeftWidth: 3, borderLeftColor: t.success }]}> 
        <TouchableOpacity
          style={s.exMainTap}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <Text style={[s.exName, { color: t.text }]}>{ex}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.editBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={onEdit}>
          <Text style={[s.editBtnText, { color: t.textSub }]}>Edit</Text>
        </TouchableOpacity>
        <Animated.View
          style={[
            s.check,
            { borderColor: t.borderStrong },
            isDone && { backgroundColor: t.success, borderColor: t.success },
            { transform: [{ scale: checkScale.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
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

export default function TodayScreen() {
  const t = useTheme();
  const [sessions, setSessions] = useState({});
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [activeEx, setActiveEx] = useState(null);
  const [activeSets, setActiveSets] = useState([]);
  const [cardioMinutes, setCardioMinutes] = useState('');
  const [cardioKm, setCardioKm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [prefillDate, setPrefillDate] = useState(null);
  const [editingEx, setEditingEx] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isRestDay, setIsRestDay] = useState(false);
  const [showRestBanner, setShowRestBanner] = useState(true);
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const saveScaleAnim = useRef(new Animated.Value(1)).current;

  const dow = new Date().getDay();
  const tk = todayKey();
  const day = plan[dow];

  const loadScreenData = useCallback(async () => {
    const loadedSessions = await loadSessions();
    const customPlan = await loadCustomPlan();
    const restDays = await loadRestDays();
    if (!loadedSessions[tk]) loadedSessions[tk] = { _dow: dow };
    const nextPlan = customPlan && typeof customPlan === 'object' ? customPlan : DEFAULT_PLAN;
    const restStatus = !!restDays[tk];
    setSessions({ ...loadedSessions });
    setPlan(nextPlan);
    setIsRestDay(restStatus || !nextPlan[dow]);
    setShowRestBanner(restStatus || !nextPlan[dow]);
  }, [dow, tk]);

  useFocusEffect(
    useCallback(() => {
      loadScreenData();
    }, [loadScreenData])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 9, tension: 80 }),
    ]).start();
  }, [activeEx, editingEx, isRestDay, showRestBanner, day, fadeAnim, slideAnim]);

  const openLogger = ex => {
    const current = sessions[tk]?.[ex];
    setActiveEx(ex);
    
    if (isCardioExercise(ex)) {
      setActiveSets([]);
      setCardioMinutes(current && typeof current === 'object' ? String(current.minutes ?? '') : '');
      setCardioKm(current && typeof current === 'object' ? String(current.km ?? '') : '');
      setWeightKg('');
    } else if (isWeightExercise(ex)) {
      setActiveSets([]);
      setCardioMinutes('');
      setCardioKm('');
      setWeightKg(current && typeof current === 'object' ? String(current.kg ?? '') : '');
    } else {
      const latestResult = Array.isArray(current) && current.length > 0
        ? { sets: current }
        : getLatestExerciseSets(sessions, ex, tk);
      const latestSets = Array.isArray(latestResult?.sets) && latestResult.sets.length > 0
        ? latestResult.sets
        : EMPTY_SETS();
      setActiveSets(latestSets.map(set => ({ ...set })));
      setPrefillDate(latestResult?.dateKey ?? null);
      setCardioMinutes('');
      setCardioKm('');
      setWeightKg('');
    }
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 0 }).start();
    Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 0 }).start();
  };

  const closeLogger = () => {
    setActiveEx(null);
    setActiveSets([]);
    setCardioMinutes('');
    setCardioKm('');
    setWeightKg('');
    setPrefillDate(null);
  };

  const updateSet = (index, key, value) => {
    setActiveSets(prev => prev.map((set, i) => (i === index ? { ...set, [key]: value } : set)));
  };

  const saveExercise = async () => {
    if (!activeEx || !day) return;
    const nextSessions = { ...sessions };
    nextSessions[tk] = { ...(nextSessions[tk] || {}), _dow: dow };
    nextSessions[tk][activeEx] = isCardioExercise(activeEx)
      ? { minutes: cardioMinutes, km: cardioKm }
      : isWeightExercise(activeEx)
        ? { kg: weightKg }
      : activeSets;

    await saveSessions(nextSessions);
    setSessions(nextSessions);
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
    const duplicate = group.exercises.some((name, index) => index !== editingEx.exerciseIndex && name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      Alert.alert('Already exists', 'That exercise already exists in this muscle group.');
      return;
    }

    const nextPlan = JSON.parse(JSON.stringify(plan));
    nextPlan[dow].groups[editingEx.groupIndex].exercises[editingEx.exerciseIndex] = trimmed;
    await saveCustomPlan(nextPlan);

    const migrated = renameExerciseInSessions(sessions, editingEx.oldName, trimmed);
    if (migrated.changed) await saveSessions(migrated.sessions);

    setPlan(nextPlan);
    setSessions({ ...migrated.sessions });
    if (activeEx === editingEx.oldName) setActiveEx(trimmed);
    cancelEditingExercise();
  };

  const activeIsCardio = activeEx ? isCardioExercise(activeEx) : false;
  const activeIsWeight = activeEx ? isWeightExercise(activeEx) : false;
  const totalVol = activeIsCardio ? 0 : activeSets.reduce((sum, set) => sum + (parseFloat(set.w) || 0) * (parseInt(set.r) || 0), 0);
  const showRestView = isRestDay || !day;

  const isExerciseDone = ex => {
    const entry = sessions[tk]?.[ex];
    if (isCardioExercise(ex) || isWeightExercise(ex)) return !!entry;
    return Array.isArray(entry) && entry.length > 0;
  };

  const renderRestBanner = () =>
    showRestBanner ? (
      <TouchableWithoutFeedback onPress={() => setShowRestBanner(false)}>
        <View style={[s.restBanner, { backgroundColor: t.surface, borderColor: t.border }]}> 
          <View style={s.restBannerTextWrap}>
            <Text style={[s.restBannerTitle, { color: t.text }]}>Rest Day</Text>
            <Text style={[s.restBannerSub, { color: t.textSub }]}>Come back tomorrow</Text>
          </View>
          <TouchableOpacity onPress={() => setShowRestBanner(false)} style={[s.restClose, { backgroundColor: t.inputBg, borderColor: t.border }]}> 
            <Ionicons name="close" size={16} color={t.textSub} />
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    ) : null;

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
              <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: t.inputBg, borderColor: t.border }]} onPress={cancelEditingExercise}>
                <Text style={[s.secondaryBtnText, { color: t.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.primaryBtn, { backgroundColor: t.accent }]} onPress={saveEditedExercise}>
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
              <TouchableOpacity onPress={closeLogger} style={[s.backChip, { backgroundColor: t.inputBg, borderColor: t.border }]}> 
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
              {activeIsCardio ? (
                <>
                  <View style={[s.setHeader, { borderBottomColor: t.border, backgroundColor: t.inputBg }]}> 
                    <Text style={[s.setColHdr, { flex: 1.2, color: t.textHint }]}>Exercise</Text>
                    <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Minutes</Text>
                    <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Km</Text>
                  </View>
                  <View style={[s.setRow, { borderTopColor: t.border }]}> 
                    <Text style={[s.setLabel, { color: t.textSub }, { flex: 1.2 }]}>{activeEx}</Text>
                    <View style={{ flex: 1, paddingHorizontal: 4 }}>
                      <TextInput
                        style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                        value={cardioMinutes}
                        onChangeText={setCardioMinutes}
                        placeholder="min"
                        placeholderTextColor={t.textHint}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 4 }}>
                      <TextInput
                        style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                        value={cardioKm}
                        onChangeText={setCardioKm}
                        placeholder="km"
                        placeholderTextColor={t.textHint}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={[s.totalRow, { borderTopColor: t.border }]}> 
                    <Text style={[s.totalLabel, { color: t.textSub }]}>Total minutes</Text>
                    <Text style={[s.totalVal, { color: t.text }]}>{`${cardioMinutes || '0'} min`}</Text>
                  </View>
                </>
              ) : activeIsWeight ? (
                <>
                  <View style={[s.setHeader, { borderBottomColor: t.border, backgroundColor: t.inputBg }]}> 
                    <Text style={[s.setColHdr, { flex: 1, color: t.textHint }]}>Today's weight</Text>
                  </View>
                  <View style={[s.weightCardBody, { borderTopColor: t.border }]}> 
                    <TextInput
                      style={[s.numInput, s.weightInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                      value={weightKg}
                      onChangeText={setWeightKg}
                      placeholder="kg"
                      placeholderTextColor={t.textHint}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </>
              ) : (
                <>
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
                            onChangeText={value => updateSet(i, 'w', value)}
                            placeholder="kg"
                            placeholderTextColor={t.textHint}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View style={{ flex: 1, paddingHorizontal: 4 }}>
                          <TextInput
                            style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                            value={set.r}
                            onChangeText={value => updateSet(i, 'r', value)}
                            placeholder="reps"
                            placeholderTextColor={t.textHint}
                            keyboardType="number-pad"
                          />
                        </View>
                        <Text style={[s.setVol, { flex: 0.8, color: vol > 0 ? t.accent : t.textHint }]}>{vol > 0 ? Math.round(vol) + '' : '—'}</Text>
                      </View>
                    );
                  })}
                  <View style={[s.totalRow, { borderTopColor: t.border }]}> 
                    <Text style={[s.totalLabel, { color: t.textSub }]}>Total volume</Text>
                    <Text style={[s.totalVal, { color: t.text }]}>{`${Math.round(totalVol).toLocaleString()} kg`}</Text>
                  </View>
                </>
              )}
            </View>
            <View style={s.deadNote}>
              {!activeIsCardio && <Text style={[s.deadNoteText, { color: t.textHint }]}>{'Set 3 -> Drop 1 -> Drop 2 are dead sets - no rest between them'}</Text>}
            </View>
            <Animated.View style={{ transform: [{ scale: saveScaleAnim }] }}>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: t.accent }]}
                onPress={saveExercise}
                onPressIn={() => Animated.spring(saveScaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(saveScaleAnim, { toValue: 1, useNativeDriver: true }).start()}
              >
                <Ionicons name="checkmark-circle" size={18} color={t.accentText} />
                <Text style={[s.saveBtnText, { color: t.accentText }]}>{activeIsWeight ? 'Save weight' : 'Save exercise'}</Text>
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
            <View style={s.topBarRight}>
              <AppLogo theme={t} compact />
              <TouchableOpacity style={[s.settingsBtn, { backgroundColor: t.inputBg, borderColor: t.border }]} onPress={() => setSettingsVisible(true)}>
                <GearIcon color={t.textSub} size={18} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
          {renderRestBanner()}
        </ScrollView>
        <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} theme={t} />
      </SafeAreaView>
    );
  }

  const totalDone = day.groups.reduce((sum, group) => sum + group.exercises.filter(ex => isExerciseDone(ex)).length, 0);
  const totalEx = day.groups.reduce((sum, group) => sum + group.exercises.length, 0);

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
          <View style={s.topBarRight}>
            <AppLogo theme={t} compact />
            <TouchableOpacity style={[s.settingsBtn, { backgroundColor: t.inputBg, borderColor: t.border }]} onPress={() => setSettingsVisible(true)}>
              <GearIcon color={t.textSub} size={18} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
        {showRestView ? renderRestBanner() : null}
        {!showRestView &&
          day.groups.map((group, groupIndex) => {
            const done = group.exercises.filter(ex => isExerciseDone(ex)).length;
            return (
              <View key={groupIndex} style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}> 
                <View style={[s.groupHdr, { borderBottomColor: t.border }]}> 
                  <View style={[s.dot, { backgroundColor: done === group.exercises.length ? t.success : group.color }]} />
                  <Text style={[s.groupName, { color: t.text, opacity: done === group.exercises.length ? 0.5 : 1 }]}>{group.name}</Text>
                  <View style={[s.badge, { backgroundColor: done === group.exercises.length ? t.success + '22' : t.inputBg }]}> 
                    <Text style={[s.badgeText, { color: done === group.exercises.length ? t.success : t.textSub }]}>{done}/{group.exercises.length}</Text>
                  </View>
                </View>
                {group.exercises.map((ex, exerciseIndex) => (
                  <AnimatedExRow
                    key={exerciseIndex}
                    ex={ex}
                    isDone={isExerciseDone(ex)}
                    onPress={() => openLogger(ex)}
                    onEdit={() => startEditingExercise(groupIndex, exerciseIndex, ex)}
                    index={exerciseIndex}
                    t={t}
                  />
                ))}
              </View>
            );
          })}
      </ScrollView>
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} theme={t} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  topbar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  topbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topTitle: { fontSize: 20, fontWeight: '600' },
  topSub: { fontSize: 12, marginTop: 3 },
  scroll: { flex: 1, padding: 12 },
  card: { borderRadius: 14, borderWidth: 0.5, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
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
  backChip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 999, borderWidth: 0.5, paddingHorizontal: 10, paddingVertical: 6 },
  backChipText: { fontSize: 12, fontWeight: '600' },
  loggerTitle: { fontSize: 20, fontWeight: '700' },
  loggerSub: { fontSize: 11, marginTop: 8 },
  prefillBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 999, borderWidth: 0.5, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
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
  weightCardBody: { paddingHorizontal: 14, paddingVertical: 18, borderTopWidth: 0.5, alignItems: 'center' },
  weightInput: { width: '72%', maxWidth: 280 },
  deadNote: { padding: 10, alignItems: 'center' },
  deadNoteText: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  saveBtn: { borderRadius: 14, marginHorizontal: 12, marginTop: 4, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '600' },
  restBanner: { borderRadius: 14, borderWidth: 0.5, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  restBannerTextWrap: { flex: 1, paddingRight: 10 },
  restBannerTitle: { fontSize: 16, fontWeight: '700' },
  restBannerSub: { fontSize: 12, marginTop: 3 },
  restClose: { width: 30, height: 30, borderRadius: 15, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  settingsBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
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
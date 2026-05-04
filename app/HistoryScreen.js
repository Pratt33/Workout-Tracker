import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Share, Alert,
  StyleSheet, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { PLAN, MUSCLE_COLORS, isCardioExercise } from '../app/data';
import AppLogo from '../app/AppLogo';
import {
  loadSessions,
  saveSessions,
  formatDate,
  getSessionVolume,
  getFilteredKeys,
  loadWorkoutPlan,
  buildLLMExportPayload,
  buildCSVExport,
} from '../app/storage';
import { useTheme } from '../app/theme';

const FILTERS = [
  { key: '4w', label: '4 weeks' },
  { key: '3m', label: '3 months' },
  { key: 'all', label: 'All time' },
];

const EMPTY_SETS = () => [
  { label: 'Set 1', w: '', r: '10', dead: false },
  { label: 'Set 2', w: '', r: '10', dead: false },
  { label: 'Set 3', w: '', r: '', dead: true },
  { label: 'Drop 1', w: '', r: '', dead: true },
  { label: 'Drop 2', w: '', r: '', dead: true },
];

const EMPTY_CARDIO_SETS = () => [
  { label: 'Minute Slot 1', m: '' },
];

export default function HistoryScreen() {
  const t = useTheme();
  const [sessions, setSessions] = useState({});
  const [planMap, setPlanMap] = useState(PLAN);
  const [filter, setFilter] = useState('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [editSessionKey, setEditSessionKey] = useState(null);
  const [activeEx, setActiveEx] = useState(null);
  const [activeSets, setActiveSets] = useState([]);

  useFocusEffect(useCallback(() => {
    Promise.all([loadSessions(), loadWorkoutPlan()]).then(([s, savedPlan]) => {
      setSessions(s);
      if (savedPlan && typeof savedPlan === 'object') setPlanMap(savedPlan);
      else setPlanMap(PLAN);
    });
  }, []));

  const filteredKeys = getFilteredKeys(sessions, filter).slice().reverse();

  const selectedCount = selectedKeys.length;

  const toggleSelect = (key) => {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const startSelection = (key) => {
    setSelectionMode(true);
    setSelectedKeys([key]);
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedKeys([]);
  };

  const toggleSelectAllVisible = () => {
    if (selectedKeys.length === filteredKeys.length) setSelectedKeys([]);
    else setSelectedKeys([...filteredKeys]);
  };

  const deleteSessionKeys = async (keys) => {
    if (!keys.length) return;
    const next = { ...sessions };
    keys.forEach(k => { delete next[k]; });
    setSessions(next);
    await saveSessions(next);
  };

  const deleteSelected = () => {
    if (!selectedKeys.length) return;
    Alert.alert(
      'Delete sessions',
      `Delete ${selectedKeys.length} selected session${selectedKeys.length > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSessionKeys(selectedKeys);
            clearSelection();
          }
        }
      ]
    );
  };

  const deleteSingleSession = (key) => {
    Alert.alert(
      'Delete session',
      `Delete session from ${formatDate(key)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSessionKeys([key]);
            if (editSessionKey === key) {
              setEditSessionKey(null);
              setActiveEx(null);
            }
          }
        }
      ]
    );
  };

  const openSessionEditor = (key) => {
    setEditSessionKey(key);
    setActiveEx(null);
  };

  const closeSessionEditor = () => {
    setEditSessionKey(null);
    setActiveEx(null);
  };

  const sessionExerciseList = (sessionKey) => {
    const session = sessions[sessionKey] || {};
    const dow = session._dow;
    const day = planMap[dow];
    const planned = day?.groups?.flatMap(g => g.exercises) || [];
    const existing = Object.keys(session).filter(k => !k.startsWith('_') && Array.isArray(session[k]));
    const unique = [];
    [...planned, ...existing].forEach(ex => {
      if (!unique.includes(ex)) unique.push(ex);
    });
    return unique;
  };

  const openExerciseEditor = (exerciseName) => {
    const existing = sessions[editSessionKey]?.[exerciseName];
    const cardio = isCardioExercise(exerciseName);
    const nextDefault = cardio ? EMPTY_CARDIO_SETS() : EMPTY_SETS();
    if (existing?.length) {
      if (cardio) {
        const total = existing.reduce((a, s) => a + (parseFloat(s.m) || 0), 0);
        setActiveSets([{ label: 'Minute Slot 1', m: total > 0 ? String(total) : '' }]);
      } else {
        setActiveSets(JSON.parse(JSON.stringify(existing)));
      }
    } else {
      setActiveSets(nextDefault);
    }
    setActiveEx(exerciseName);
  };

  const updateSet = (i, field, val) => {
    const next = [...activeSets];
    next[i] = { ...next[i], [field]: val };
    setActiveSets(next);
  };

  const saveExerciseEdits = async () => {
    const next = { ...sessions };
    if (!next[editSessionKey]) return;
    next[editSessionKey][activeEx] = activeSets;
    setSessions(next);
    await saveSessions(next);
    setActiveEx(null);
  };

  const deleteExerciseFromSession = () => {
    Alert.alert(
      'Remove exercise data',
      `Delete all logged sets for ${activeEx} in this session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const next = { ...sessions };
            if (next[editSessionKey] && Object.prototype.hasOwnProperty.call(next[editSessionKey], activeEx)) {
              delete next[editSessionKey][activeEx];
              setSessions(next);
              await saveSessions(next);
            }
            setActiveEx(null);
          }
        }
      ]
    );
  };

  const exportForLLM = async () => {
    try {
      const csv = buildCSVExport(sessions, planMap);
      await Share.share({
        title: 'Workout Data Export',
        message: csv,
      });
    } catch {
      Alert.alert('Export failed', 'Could not export workout data. Please try again.');
    }
  };

  if (editSessionKey && activeEx) {
    const activeIsCardio = isCardioExercise(activeEx);
    const totalVol = activeIsCardio
      ? activeSets.reduce((a, s) => a + (parseFloat(s.m) || 0), 0)
      : activeSets.reduce((a, s) => a + (parseFloat(s.w) || 0) * (parseInt(s.r) || 0), 0);
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
        <View style={[s.topbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
          <TouchableOpacity style={[s.backChip, { backgroundColor: t.inputBg, borderColor: t.border }]} onPress={() => setActiveEx(null)}>
            <Ionicons name="chevron-back" size={16} color={t.accent} />
            <Text style={[s.backChipText, { color: t.accent }]}>Session</Text>
          </TouchableOpacity>
          <Text style={[s.topTitle, { color: t.text }]} numberOfLines={1}>{activeEx}</Text>
          <Text style={[s.topSub, { color: t.textSub }]}>Edit past workout entry</Text>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 18 }}>
          <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}> 
            <View style={[s.setHeader, { borderBottomColor: t.border, backgroundColor: t.inputBg }]}> 
              <Text style={[s.setColHdr, { flex: activeIsCardio ? 2 : 1.4, color: t.textHint }]}>Set</Text>
              {activeIsCardio ? (
                <>
                  <Text style={[s.setColHdr, { flex: 1.2, textAlign: 'center', color: t.textHint }]}>Minutes</Text>
                  <Text style={[s.setColHdr, { flex: 0.8, textAlign: 'right', color: t.textHint }]}>Total</Text>
                </>
              ) : (
                <>
                  <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Weight kg</Text>
                  <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Reps</Text>
                  <Text style={[s.setColHdr, { flex: 0.8, textAlign: 'right', color: t.textHint }]}>Vol</Text>
                </>
              )}
            </View>

            {activeSets.map((set, i) => {
              const vol = activeIsCardio
                ? (parseFloat(set.m) || 0)
                : (parseFloat(set.w) || 0) * (parseInt(set.r) || 0);
              return (
                <View key={i} style={[s.setRow, { borderTopColor: t.border }]}> 
                  <Text style={[s.setLabel, { color: set.dead ? t.deadColor : t.textSub }, { flex: activeIsCardio ? 2 : 1.4 }]}>{set.label}</Text>
                  {activeIsCardio ? (
                    <>
                      <View style={{ flex: 1.2, paddingHorizontal: 4 }}>
                        <TextInput
                          style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                          value={set.m}
                          onChangeText={v => updateSet(i, 'm', v)}
                          placeholder="min"
                          placeholderTextColor={t.textHint}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <Text style={[s.setVol, { flex: 0.8, color: vol > 0 ? t.accent : t.textHint }]}>{vol > 0 ? Math.round(vol) + 'm' : '-'} </Text>
                    </>
                  ) : (
                    <>
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
                      <Text style={[s.setVol, { flex: 0.8, color: vol > 0 ? t.accent : t.textHint }]}>{vol > 0 ? Math.round(vol) + '' : '-'} </Text>
                    </>
                  )}
                </View>
              );
            })}

            <View style={[s.totalRow, { borderTopColor: t.border }]}> 
              <Text style={[s.totalLabel, { color: t.textSub }]}>{activeIsCardio ? 'Total minutes' : 'Total volume'}</Text>
              <Text style={[s.totalVal, { color: t.text }]}>{activeIsCardio ? `${Math.round(totalVol).toLocaleString()} min` : `${Math.round(totalVol).toLocaleString()} kg`}</Text>
            </View>
          </View>

          <View style={s.actionRow}>
            <TouchableOpacity style={[s.secondaryBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={deleteExerciseFromSession}>
              <Text style={[s.secondaryBtnText, { color: t.textSub }]}>Delete exercise data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: t.accent }]} onPress={saveExerciseEdits}>
              <Text style={[s.primaryBtnText, { color: t.accentText }]}>Save changes</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (editSessionKey) {
    const session = sessions[editSessionKey] || {};
    const dow = session._dow;
    const day = planMap[dow];
    const exercises = sessionExerciseList(editSessionKey);
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
        <View style={[s.topbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
          <TouchableOpacity style={[s.backChip, { backgroundColor: t.inputBg, borderColor: t.border }]} onPress={closeSessionEditor}>
            <Ionicons name="chevron-back" size={16} color={t.accent} />
            <Text style={[s.backChipText, { color: t.accent }]}>History</Text>
          </TouchableOpacity>
          <Text style={[s.topTitle, { color: t.text }]}>Edit session</Text>
          <Text style={[s.topSub, { color: t.textSub }]}>{formatDate(editSessionKey)}{day ? ` · ${day.label}` : ''}</Text>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 18 }}>
          {exercises.map(ex => {
                const sets = Array.isArray(session[ex]) ? session[ex] : [];
                const cardio = isCardioExercise(ex);
                const cardioEntry = cardio && !Array.isArray(session[ex]) ? session[ex] : null;
                const vol = cardio
                  ? sets.reduce((a, row) => a + (parseFloat(row.m) || 0), 0)
                  : sets.reduce((a, row) => a + (parseFloat(row.w) || 0) * (parseInt(row.r) || 0), 0);
            return (
              <TouchableOpacity
                key={ex}
                style={[s.editRow, { backgroundColor: t.surface, borderColor: t.border }]}
                onPress={() => openExerciseEditor(ex)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.editRowTitle, { color: t.text }]}>{ex}</Text>
                  <Text style={[s.editRowSub, { color: t.textSub }]}>
                      {cardio
                        ? `${cardioEntry?.minutes ?? '0'} min · ${cardioEntry?.km ?? '0'} km`
                        : `${sets.length} set${sets.length !== 1 ? 's' : ''} · ${Math.round(vol).toLocaleString()} kg`}
                  </Text>
                </View>
                <Ionicons name="create-outline" size={18} color={t.accent} />
              </TouchableOpacity>
            );
          })}

          {exercises.length === 0 && (
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: t.text }]}>No exercise data</Text>
              <Text style={[s.emptySub, { color: t.textSub }]}>This session has no logged sets to edit.</Text>
            </View>
          )}

          <TouchableOpacity style={[s.deleteSessionBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={() => deleteSingleSession(editSessionKey)}>
            <Ionicons name="trash-outline" size={16} color={t.deadColor} />
            <Text style={[s.deleteSessionBtnText, { color: t.deadColor }]}>Delete this session</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
      <View style={[s.topbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
        <View style={s.topbarRow}>
          <View style={{ flex: 1 }}>
            <View style={s.titleWrap}>
              <AppLogo theme={t} compact />
              <Text style={[s.topTitle, { color: t.text }]}>{selectionMode ? `${selectedCount} selected` : 'History'}</Text>
            </View>
            <Text style={[s.topSub, { color: t.textSub }]}> 
              {selectionMode ? 'Tap sessions to select or unselect' : `${filteredKeys.length} session${filteredKeys.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          {selectionMode ? (
            <View style={s.selectionActions}>
              <TouchableOpacity style={[s.smallBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={toggleSelectAllVisible}>
                <Text style={[s.smallBtnText, { color: t.text }]}>{selectedKeys.length === filteredKeys.length ? 'Clear' : 'All'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.smallBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={deleteSelected}>
                <Ionicons name="trash-outline" size={14} color={t.deadColor} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.smallBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={clearSelection}>
                <Text style={[s.smallBtnText, { color: t.textSub }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.selectionActions}>
              <TouchableOpacity
                style={[s.exportBtn, { borderColor: t.border, backgroundColor: t.inputBg }]}
                onPress={exportForLLM}
              >
                <Text style={[s.exportBtnText, { color: t.text }]}>Export CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.smallBtn, { borderColor: t.border, backgroundColor: t.inputBg }]}
                onPress={() => setSelectionMode(true)}
              >
                <Text style={[s.smallBtnText, { color: t.text }]}>Select</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, { borderColor: t.border, backgroundColor: t.surface }, filter === f.key && { backgroundColor: t.accent, borderColor: t.accent }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterText, { color: t.textSub }, filter === f.key && { color: '#fff' }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredKeys.length === 0 && (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: t.text }]}>No sessions yet</Text>
            <Text style={[s.emptySub, { color: t.textSub }]}>Head to Today and log your first workout.</Text>
          </View>
        )}

        {filteredKeys.map(k => {
          const dow = sessions[k]?._dow;
          const day = planMap[dow];
          const isRest = !!sessions[k]?._rest;
          const vol = getSessionVolume(sessions[k]);
          const selected = selectedKeys.includes(k);
          const musclesDone = day?.groups.filter(g =>
            g.exercises.some(ex => sessions[k]?.[ex]?.length > 0)
          ) || [];

          return (
            <TouchableOpacity
              key={k}
              style={[s.histItem, { backgroundColor: t.surface, borderColor: selected ? t.accent : t.border }]}
              onLongPress={() => startSelection(k)}
              onPress={() => selectionMode ? toggleSelect(k) : openSessionEditor(k)}
              activeOpacity={0.9}
            >
              <View style={s.histTopRow}>
                <View style={s.histTopLeft}>
                  {selectionMode && (
                    <View style={[s.checkbox, { borderColor: selected ? t.accent : t.borderStrong, backgroundColor: selected ? t.accent : 'transparent' }]}>
                      {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                  )}
                  <Text style={[s.histDate, { color: t.textHint }]}>{formatDate(k)}</Text>
                </View>
                <View style={s.histRightRow}>
                  {vol > 0 && (
                    <Text style={[s.histVol, { color: t.accent }]}>{vol.toLocaleString()} kg</Text>
                  )}
                  {!selectionMode && <Ionicons name="create-outline" size={16} color={t.accent} />}
                </View>
              </View>
              <Text style={[s.histDay, { color: t.text }]}>{day ? day.label : 'Session'}</Text>
              {isRest && (
                <View style={[s.restBadge, { backgroundColor: t.inputBg, borderColor: t.border }]}> 
                  <Ionicons name="moon-outline" size={12} color={t.textSub} />
                  <Text style={[s.restBadgeText, { color: t.textSub }]}>Rest day declared</Text>
                </View>
              )}
              <View style={s.tagRow}>
                {musclesDone.map(g => (
                  <View key={g.name} style={[s.tag, { backgroundColor: ((MUSCLE_COLORS[g.name] || g.color || '#888888') + '28') }]}> 
                    <View style={[s.tagDot, { backgroundColor: (MUSCLE_COLORS[g.name] || g.color || '#888888') }]} />
                    <Text style={[s.tagText, { color: (MUSCLE_COLORS[g.name] || g.color || '#888888') }]}>{g.name}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
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
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topTitle: { fontSize: 20, fontWeight: '600' },
  topSub: { fontSize: 12, marginTop: 3 },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exportBtn: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  exportBtnText: { fontSize: 12, fontWeight: '600' },
  smallBtn: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minWidth: 48,
  },
  smallBtnText: { fontSize: 11, fontWeight: '600' },
  scroll: { flex: 1, padding: 12 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5 },
  filterText: { fontSize: 12 },
  histItem: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  histTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  histDate: { fontSize: 11 },
  histVol: { fontSize: 12, fontWeight: '600' },
  histDay: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  restBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  restBadgeText: { fontSize: 11, fontWeight: '500' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  tagDot: { width: 5, height: 5, borderRadius: 3 },
  tagText: { fontSize: 11, fontWeight: '500' },
  empty: { padding: 48, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backChipText: { fontSize: 12, fontWeight: '600' },
  editRow: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editRowTitle: { fontSize: 13, fontWeight: '600' },
  editRowSub: { fontSize: 11, marginTop: 2 },
  deleteSessionBtn: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  deleteSessionBtnText: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  setHeader: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  setColHdr: { fontSize: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderTopWidth: 0.5 },
  setLabel: { fontSize: 12 },
  numInput: { borderWidth: 0.5, borderRadius: 8, paddingVertical: 7, fontSize: 13, textAlign: 'center' },
  setVol: { fontSize: 11, textAlign: 'right', fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 0.5 },
  totalLabel: { fontSize: 12 },
  totalVal: { fontSize: 16, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  secondaryBtn: { flex: 1, borderWidth: 0.5, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 12, fontWeight: '600' },
  primaryBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { fontSize: 12, fontWeight: '700' },
});

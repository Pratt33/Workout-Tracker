import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Share, Alert,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { PLAN, MUSCLE_COLORS } from '../app/data';
import AppLogo from '../app/AppLogo';
import {
  loadSessions,
  formatDate,
  getSessionVolume,
  getFilteredKeys,
  loadWorkoutPlan,
  buildLLMExportPayload,
} from '../app/storage';
import { useTheme } from '../app/theme';

const FILTERS = [
  { key: '4w', label: '4 weeks' },
  { key: '3m', label: '3 months' },
  { key: 'all', label: 'All time' },
];

export default function HistoryScreen() {
  const t = useTheme();
  const [sessions, setSessions] = useState({});
  const [planMap, setPlanMap] = useState(PLAN);
  const [filter, setFilter] = useState('all');

  useFocusEffect(useCallback(() => {
    Promise.all([loadSessions(), loadWorkoutPlan()]).then(([s, savedPlan]) => {
      setSessions(s);
      if (savedPlan && typeof savedPlan === 'object') setPlanMap(savedPlan);
      else setPlanMap(PLAN);
    });
  }, []));

  const filteredKeys = getFilteredKeys(sessions, filter).slice().reverse();

  const exportForLLM = async () => {
    try {
      const payload = buildLLMExportPayload(sessions, planMap);
      const json = JSON.stringify(payload, null, 2);
      await Share.share({
        title: 'Workout Data Export (LLM)',
        message: json,
      });
    } catch {
      Alert.alert('Export failed', 'Could not export workout data. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
      <View style={[s.topbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
        <View style={s.topbarRow}>
          <View>
            <View style={s.titleWrap}>
              <AppLogo theme={t} compact />
              <Text style={[s.topTitle, { color: t.text }]}>History</Text>
            </View>
            <Text style={[s.topSub, { color: t.textSub }]}>{filteredKeys.length} session{filteredKeys.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={[s.exportBtn, { borderColor: t.border, backgroundColor: t.inputBg }]}
            onPress={exportForLLM}
          >
            <Text style={[s.exportBtnText, { color: t.text }]}>Export</Text>
          </TouchableOpacity>
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
          const vol = getSessionVolume(sessions[k]);
          const musclesDone = day?.groups.filter(g =>
            g.exercises.some(ex => sessions[k]?.[ex]?.length > 0)
          ) || [];

          return (
            <View key={k} style={[s.histItem, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={s.histTopRow}>
                <Text style={[s.histDate, { color: t.textHint }]}>{formatDate(k)}</Text>
                {vol > 0 && (
                  <Text style={[s.histVol, { color: t.accent }]}>{vol.toLocaleString()} kg</Text>
                )}
              </View>
              <Text style={[s.histDay, { color: t.text }]}>{day ? day.label : 'Session'}</Text>
              <View style={s.tagRow}>
                {musclesDone.map(g => (
                  <View key={g.name} style={[s.tag, { backgroundColor: MUSCLE_COLORS[g.name] + '28' }]}>
                    <View style={[s.tagDot, { backgroundColor: MUSCLE_COLORS[g.name] }]} />
                    <Text style={[s.tagText, { color: MUSCLE_COLORS[g.name] }]}>{g.name}</Text>
                  </View>
                ))}
              </View>
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
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topTitle: { fontSize: 20, fontWeight: '600' },
  topSub: { fontSize: 12, marginTop: 3 },
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
  histTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  histDate: { fontSize: 11 },
  histVol: { fontSize: 12, fontWeight: '600' },
  histDay: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  tagDot: { width: 5, height: 5, borderRadius: 3 },
  tagText: { fontSize: 11, fontWeight: '500' },
  empty: { padding: 48, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});

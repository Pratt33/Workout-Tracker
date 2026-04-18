import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import AppLogo from '../app/AppLogo';
import { PLAN, MUSCLE_COLORS, MUSCLES } from '../app/data';
import { loadSessions, formatDate, getMuscleVolume, getFilteredKeys, loadWorkoutPlan } from '../app/storage';
import { useTheme } from '../app/theme';

const W = Dimensions.get('window').width - 48;
const FILTERS = [
  { key: '4w', label: '4 weeks' },
  { key: '3m', label: '3 months' },
  { key: 'all', label: 'All time' },
];

export default function ProgressScreen() {
  const t = useTheme();
  const [sessions, setSessions] = useState({});
  const [planMap, setPlanMap] = useState(PLAN);
  const [filter, setFilter] = useState('all');
  const [selectedMuscle, setSelectedMuscle] = useState('Chest');

  useFocusEffect(useCallback(() => {
    Promise.all([loadSessions(), loadWorkoutPlan()]).then(([s, savedPlan]) => {
      setSessions(s);
      if (savedPlan && typeof savedPlan === 'object') setPlanMap(savedPlan);
      else setPlanMap(PLAN);
    });
  }, []));

  const filteredKeys = getFilteredKeys(sessions, filter);

  const getAllMusclesData = () => {
    const byMuscle = {};
    MUSCLES.forEach(m => { byMuscle[m] = {}; });
    filteredKeys.forEach(k => {
      const dow = sessions[k]?._dow;
      const day = planMap[dow];
      if (!day) return;
      day.groups.forEach(g => {
        const vol = getMuscleVolume(sessions[k], g.name, day);
        if (vol > 0) byMuscle[g.name][k] = vol;
      });
    });
    const labelKeys = filteredKeys.filter(k => MUSCLES.some(m => byMuscle[m][k] > 0));
    if (labelKeys.length < 2) return null;
    const datasets = MUSCLES.filter(m => Object.keys(byMuscle[m]).length > 0).map(m => ({
      data: labelKeys.map(k => byMuscle[m][k] || 0),
      color: () => MUSCLE_COLORS[m],
      strokeWidth: 2,
    }));
    return datasets.length > 0 ? { labels: labelKeys.map(formatDate), datasets } : null;
  };

  const getDrillData = () => {
    const pts = [];
    filteredKeys.forEach(k => {
      const dow = sessions[k]?._dow;
      const day = planMap[dow];
      if (!day) return;
      const vol = getMuscleVolume(sessions[k], selectedMuscle, day);
      if (vol > 0) pts.push({ key: k, vol });
    });
    if (pts.length < 2) return null;
    const col = MUSCLE_COLORS[selectedMuscle];
    return {
      labels: pts.map(p => formatDate(p.key)),
      datasets: [{ data: pts.map(p => p.vol), color: () => col, strokeWidth: 2.5 }]
    };
  };

  const overviewData = getAllMusclesData();
  const drillData = getDrillData();

  const makeChartConfig = (lineColor) => ({
    backgroundGradientFrom: t.surface,
    backgroundGradientTo: t.surface,
    backgroundGradientFromOpacity: 1,
    backgroundGradientToOpacity: 1,
    decimalPlaces: 0,
    color: (opacity = 1) => lineColor || `rgba(123,114,232,${opacity})`,
    labelColor: () => t.textSub,
    propsForDots: { r: '4', strokeWidth: '0' },
    propsForLabels: { fontSize: 9 },
    propsForBackgroundLines: { stroke: t.border, strokeWidth: 0.5 },
  });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: t.bg }]}>
      <View style={[s.topbar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
        <View style={s.topbarRow}>
          <View>
            <Text style={[s.topTitle, { color: t.text }]}>Progress</Text>
            <Text style={[s.topSub, { color: t.textSub }]}>Volume over time per muscle</Text>
          </View>
          <AppLogo theme={t} compact />
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

        <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[s.cardTitle, { color: t.text }]}>All muscles</Text>
          <Text style={[s.cardSub, { color: t.textSub }]}>Volume per session (kg)</Text>
          <View style={s.legendRow}>
            {MUSCLES.map(m => (
              <View key={m} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: MUSCLE_COLORS[m] }]} />
                <Text style={[s.legendText, { color: t.textSub }]}>{m}</Text>
              </View>
            ))}
          </View>
          {overviewData ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={overviewData}
                width={Math.max(W, overviewData.labels.length * 64)}
                height={200}
                chartConfig={makeChartConfig()}
                bezier
                style={{ borderRadius: 8 }}
                withDots={false}
                withInnerLines={true}
                withOuterLines={false}
              />
            </ScrollView>
          ) : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: t.textHint }]}>Log at least 2 sessions to see chart</Text>
            </View>
          )}
        </View>

        <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[s.cardTitle, { color: t.text }]}>Muscle drilldown</Text>
          <Text style={[s.cardSub, { color: t.textSub }]}>Tap a muscle to inspect its curve</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={s.chipRow}>
              {MUSCLES.map(m => {
                const active = selectedMuscle === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[s.chip, { borderColor: active ? MUSCLE_COLORS[m] : t.border, backgroundColor: active ? MUSCLE_COLORS[m] + '22' : t.inputBg }]}
                    onPress={() => setSelectedMuscle(m)}
                  >
                    <View style={[s.chipDot, { backgroundColor: MUSCLE_COLORS[m] }]} />
                    <Text style={[s.chipText, { color: active ? MUSCLE_COLORS[m] : t.textSub, fontWeight: active ? '600' : '400' }]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          {drillData ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={drillData}
                width={Math.max(W, drillData.labels.length * 64)}
                height={180}
                chartConfig={makeChartConfig(MUSCLE_COLORS[selectedMuscle])}
                bezier
                style={{ borderRadius: 8 }}
                withDots={true}
                withInnerLines={true}
                withOuterLines={false}
                withShadow={false}
              />
            </ScrollView>
          ) : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: t.textHint }]}>
                Log at least 2 {selectedMuscle} sessions to see chart
              </Text>
            </View>
          )}
        </View>
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
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterText: { fontSize: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  cardSub: { fontSize: 11, marginBottom: 10 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10 },
  chipRow: { flexDirection: 'row', gap: 6, paddingRight: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11 },
  empty: { height: 100, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});

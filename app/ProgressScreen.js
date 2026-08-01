import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import AppLogo from '../app/AppLogo';
import {
  PLAN,
  MUSCLE_COLORS,
  DEFAULT_CARDIO_CONFIG,
  applyCardioConfigToPlan,
  isWeightExercise,
  cardioMetric,
} from '../app/data';
import {
  loadSessions,
  formatDate,
  getMuscleVolume,
  getFilteredKeys,
  loadWorkoutPlan,
  loadCardioConfig,
} from '../app/storage';
import { useTheme } from '../app/theme';


const FILTERS = [
  { key: '4w', label: '4 weeks' },
  { key: '3m', label: '3 months' },
  { key: 'all', label: 'All time' },
];

function getCardioChartValue(entry, exerciseName, config) {
  if (!entry || typeof entry !== 'object') return null;
  const metric = cardioMetric(exerciseName, config);
  if (metric === 'steps+km') {
    const steps = parseInt(entry.steps) || 0;
    return steps > 0 ? steps : null;
  } else if (metric === 'minutes+km') {
    const minutes = parseFloat(entry.minutes) || 0;
    const km = parseFloat(entry.km) || 0;
    if (minutes === 0 || km === 0) return null;
    return Math.round((km / minutes) * 60 * 10) / 10;
  } else {
    const minutes = parseFloat(entry.minutes) || 0;
    return minutes > 0 ? minutes : null;
  }
}

function getCardioChartSubtitle(metric) {
  if (metric === 'steps+km') return 'Steps — higher is better';
  if (metric === 'minutes+km') return 'Speed (km/h) — higher is better';
  return 'Duration (min) — higher is better';
}

function getPlanMuscles(planMap) {
  const muscles = [];
  Object.values(planMap || {}).forEach((day) => {
    day?.groups?.forEach((group) => {
      if (group.name === 'Cardio' || group.name === 'Weight') return;
      if (!muscles.includes(group.name)) muscles.push(group.name);
    });
  });
  return muscles;
}

function getWeightChartValue(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const kg = parseFloat(entry.kg ?? entry.weight ?? entry.value) || 0;
  return kg > 0 ? kg : null;
}

function getMuscleColor(muscleName, index = 0) {
  return MUSCLE_COLORS[muscleName] || ['#7B72E8', '#E8724A', '#2DBF8E', '#4A9FE8', '#E8B84A', '#7ABF3A', '#9A9A9A'][index % 7];
}

function ChartViewport({ scrollKey, style, children }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [scrollKey]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }}
      style={style}
    >
      {children}
    </ScrollView>
  );
}

export default function ProgressScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const W = width - 48;
  const [sessions, setSessions] = useState({});
  const [planMap, setPlanMap] = useState(PLAN);
  const [filter, setFilter] = useState('all');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [cardioConfig, setCardioConfig] = useState(DEFAULT_CARDIO_CONFIG);
  const [selectedCardioExercise, setSelectedCardioExercise] = useState(DEFAULT_CARDIO_CONFIG[0]?.name || '');

  useFocusEffect(useCallback(() => {
    Promise.all([loadSessions(), loadWorkoutPlan(), loadCardioConfig()]).then(([s, savedPlan, savedCardio]) => {
      const config = savedCardio || DEFAULT_CARDIO_CONFIG;
      setSessions(s);
      setCardioConfig(config);
      const liveConfig = savedCardio || DEFAULT_CARDIO_CONFIG;
      setPlanMap(applyCardioConfigToPlan(savedPlan || PLAN, liveConfig));
      setSelectedCardioExercise(prev => (
        config.some(c => c.name === prev) ? prev : (config[0]?.name || '')
      ));
    });
  }, []));

  const filteredKeys = getFilteredKeys(sessions, filter);
  const muscleGroups = getPlanMuscles(planMap);
  const activeMuscle = muscleGroups.includes(selectedMuscle) ? selectedMuscle : (muscleGroups[0] || '');

  useEffect(() => {
    if (!muscleGroups.length) return;
    if (!muscleGroups.includes(selectedMuscle)) {
      setSelectedMuscle(muscleGroups[0]);
    }
  }, [muscleGroups, selectedMuscle]);

  const getAllMusclesData = () => {
    const byMuscle = {};
    muscleGroups.forEach(m => { byMuscle[m] = {}; });
    filteredKeys.forEach(k => {
      const dow = sessions[k]?._dow;
      const day = planMap[dow];
      if (!day) return;
      day.groups.forEach(g => {
        if (g.name === 'Cardio' || g.name === 'Weight') return;
        const vol = getMuscleVolume(sessions[k], g.name, day);
        if (vol > 0) byMuscle[g.name][k] = vol;
      });
    });
    const labelKeys = filteredKeys.filter(k => muscleGroups.some(m => byMuscle[m][k] > 0));
    if (labelKeys.length < 2) return null;
    const datasets = muscleGroups.filter(m => Object.keys(byMuscle[m]).length > 0).map((m, index) => ({
      data: labelKeys.map(k => byMuscle[m][k] || 0),
      color: () => getMuscleColor(m, index),
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
      const vol = getMuscleVolume(sessions[k], activeMuscle, day);
      if (vol > 0) pts.push({ key: k, vol });
    });
    if (pts.length < 2) return null;
    const col = getMuscleColor(activeMuscle, muscleGroups.indexOf(activeMuscle));
    return {
      labels: pts.map(p => formatDate(p.key)),
      datasets: [{ data: pts.map(p => p.vol), color: () => col, strokeWidth: 2.5 }]
    };
  };

  const overviewData = getAllMusclesData();
  const drillData = getDrillData();

  const weightPoints = [];
  filteredKeys.forEach((k) => {
    const session = sessions[k] || {};
    const entryKey = Object.keys(session).find(
      (exercise) => isWeightExercise(exercise) && session[exercise],
    );
    const value = getWeightChartValue(entryKey ? session[entryKey] : null);
    if (value !== null) weightPoints.push({ key: k, value });
  });
  const weightData = weightPoints.length >= 2
    ? {
      labels: weightPoints.map((p) => formatDate(p.key)),
      datasets: [{ data: weightPoints.map((p) => p.value), color: () => '#A78BFA', strokeWidth: 2.5 }],
    }
    : null;

  const getCardioData = () => {
    const pts = [];
    filteredKeys.forEach(k => {
      const entry = sessions[k]?.[selectedCardioExercise];
      const value = getCardioChartValue(entry, selectedCardioExercise, cardioConfig);
      if (value !== null) pts.push({ key: k, value });
    });
    if (pts.length < 2) return null;
    const metric = cardioMetric(selectedCardioExercise, cardioConfig);
    return {
      labels: pts.map(p => formatDate(p.key)),
      datasets: [{ data: pts.map(p => p.value), color: () => '#F35D8A', strokeWidth: 2.5 }],
      _metric: metric,
    };
  };

  const cardioData = getCardioData();
  const selectedCardioMetric = cardioMetric(selectedCardioExercise, cardioConfig);

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

  const cardioIsDistance = selectedCardioMetric === 'minutes+km';
  const cardioIsSteps = selectedCardioMetric === 'steps+km';

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
            {muscleGroups.map((m, index) => (
              <View key={m} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: getMuscleColor(m, index) }]} />
                <Text style={[s.legendText, { color: t.textSub }]}>{m}</Text>
              </View>
            ))}
          </View>
          {overviewData ? (
            <ChartViewport
              scrollKey={`${overviewData.labels[overviewData.labels.length - 1] || ''}-${overviewData.labels.length}`}
            >
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
            </ChartViewport>
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
              {muscleGroups.map((m, index) => {
                const active = activeMuscle === m;
                const color = getMuscleColor(m, index);
                return (
                  <TouchableOpacity
                    key={m}
                    style={[s.chip, { borderColor: active ? color : t.border, backgroundColor: active ? color + '22' : t.inputBg }]}
                    onPress={() => setSelectedMuscle(m)}
                  >
                    <View style={[s.chipDot, { backgroundColor: color }]} />
                    <Text style={[s.chipText, { color: active ? color : t.textSub, fontWeight: active ? '600' : '400' }]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          {drillData ? (
            <ChartViewport
              scrollKey={`${activeMuscle}-${drillData.labels[drillData.labels.length - 1] || ''}-${drillData.labels.length}`}
            >
              <LineChart
                data={drillData}
                width={Math.max(W, drillData.labels.length * 64)}
                height={180}
                chartConfig={makeChartConfig(getMuscleColor(activeMuscle, muscleGroups.indexOf(activeMuscle)))}
                bezier
                style={{ borderRadius: 8 }}
                withDots={true}
                withInnerLines={true}
                withOuterLines={false}
                withShadow={false}
              />
            </ChartViewport>
          ) : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: t.textHint }]}>
                Log at least 2 {activeMuscle || 'muscle'} sessions to see chart
              </Text>
            </View>
          )}
        </View>

        <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[s.cardTitle, { color: t.text }]}>Weight</Text>
          <Text style={[s.cardSub, { color: t.textSub }]}>Body weight over time (kg)</Text>
          {weightData ? (
            <ChartViewport
              scrollKey={`${weightData.labels[weightData.labels.length - 1] || ''}-${weightData.labels.length}`}
            >
              <LineChart
                data={weightData}
                width={Math.max(W, weightData.labels.length * 64)}
                height={180}
                chartConfig={{
                  ...makeChartConfig('#A78BFA'),
                  decimalPlaces: 1,
                  yAxisSuffix: ' kg',
                }}
                bezier
                style={{ borderRadius: 8 }}
                withDots={true}
                withInnerLines={true}
                withOuterLines={false}
                withShadow={false}
              />
            </ChartViewport>
          ) : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: t.textHint }]}>
                {weightPoints.length === 1
                  ? "Log at least 2 weight entries to see chart"
                  : "Log a weight entry to start tracking"}
              </Text>
            </View>
          )}
        </View>

        <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[s.cardTitle, { color: t.text }]}>{selectedCardioExercise} progress</Text>
          <Text style={[s.cardSub, { color: t.textSub }]}>
            {getCardioChartSubtitle(selectedCardioMetric)}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={s.chipRow}>
              {cardioConfig.map(c => {
                const exercise = c.name;
                const active = selectedCardioExercise === exercise;
                return (
                  <TouchableOpacity
                    key={exercise}
                    style={[
                      s.chip,
                      { borderColor: active ? '#F35D8A' : t.border, backgroundColor: active ? '#F35D8A22' : t.inputBg },
                    ]}
                    onPress={() => setSelectedCardioExercise(exercise)}
                  >
                    <View style={[s.chipDot, { backgroundColor: '#F35D8A' }]} />
                    <Text style={[s.chipText, { color: active ? '#F35D8A' : t.textSub, fontWeight: active ? '600' : '400' }]}>{exercise}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          {cardioData ? (
            <ChartViewport
              scrollKey={`${selectedCardioExercise}-${cardioData.labels[cardioData.labels.length - 1] || ''}-${cardioData.labels.length}`}
            >
              <LineChart
                data={cardioData}
                width={Math.max(W, cardioData.labels.length * 64)}
                height={170}
                chartConfig={{
                  ...makeChartConfig('#F35D8A'),
                  decimalPlaces: selectedCardioMetric === 'minutes' ? 0 : 1,
                  yAxisSuffix: cardioIsSteps ? ' steps' : cardioIsDistance ? ' km/h' : ' min',
                }}
                bezier
                style={{ borderRadius: 8 }}
                withDots={true}
                withInnerLines={true}
                withOuterLines={false}
                withShadow={false}
              />
            </ChartViewport>
          ) : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: t.textHint }]}>Log at least 2 {selectedCardioExercise} sessions to see chart</Text>
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

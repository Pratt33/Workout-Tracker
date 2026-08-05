import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import AppLogo from '../app/AppLogo';
import {
  PLAN,
  MUSCLE_COLORS,
  DEFAULT_CARDIO_CONFIG,
  applyCardioConfigToPlan,
  isWeightExercise,
  cardioMetric,
  getCardioEntry,
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

// Fixed-left Y-axis helpers.
// react-native-chart-kit draws the Y-axis numbers and horizontal (value) grid
// lines inside the same SVG as the plot, so wrapping it in a ScrollView makes
// the axis scroll away too. To keep the Y-axis fixed while the plot scrolls,
// we disable the chart's in-SVG axis (horizontal lines + labels) and instead
// draw a fixed, non-scrolling axis + value grid at the identical computed
// positions. The plot itself still scrolls horizontally (latest stays on the
// right via scrollToEnd).
const Y_AXIS_W = 44;
const PAD_TOP = 8;
const CHART_SEGMENTS = 4;

function getFlatPoints(data) {
  const out = [];
  (data?.datasets || []).forEach((ds) =>
    (ds.data || []).forEach((v) => {
      if (v != null && !Number.isNaN(Number(v))) out.push(Number(v));
    }),
  );
  return out;
}

function computeYAxis(data, height) {
  const points = getFlatPoints(data);
  if (!points.length) return { lines: [], ticks: [] };
  const min = Math.min.apply(null, points);
  const max = Math.max.apply(null, points);
  const scaler = max - min || 1;
  const segs = min === max ? 1 : CHART_SEGMENTS;
  const base = height * 0.75;
  const lines = [];
  const ticks = [];
  for (let i = 0; i <= segs; i++) {
    const y = (base / segs) * i + PAD_TOP;
    lines.push({ y });
    if (segs === 1) {
      // chart-kit shows a single value label for flat data, at the bottom row
      if (i === segs) ticks.push({ y, value: points[0] });
    } else {
      // y increases downward (i=0 is the top); chart-kit places max at the top
      // and min at the bottom, so the value must run opposite to i.
      ticks.push({ y, value: (scaler / segs) * (segs - i) + min });
    }
  }
  return { lines, ticks };
}

function FixedAxisChart({
  data,
  height,
  decimalPlaces,
  chartWidth,
  scrollKey,
  chartConfig,
  showDots = false,
}) {
  const t = useTheme();
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.scrollToEnd({ animated: false });
  }, [scrollKey]);

  const { lines, ticks } = computeYAxis(data, height);

  return (
    <View style={s.chartRow}>
      <View style={[s.yAxis, { height, borderColor: t.border }]}>
        {ticks.map((tk, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[s.tickWrap, { top: tk.y - 7 }]}
          >
            <Text style={[s.tickText, { color: t.textSub }]}>
              {tk.value.toFixed(decimalPlaces)}
            </Text>
          </View>
        ))}
      </View>
      <View style={[s.plotWrap, { height }]}>
        <ScrollView
          ref={ref}
          horizontal
          style={s.plot}
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => {
            ref.current?.scrollToEnd({ animated: false });
          }}
        >
          <LineChart
            data={data}
            width={chartWidth}
            height={height}
            chartConfig={{ ...chartConfig, decimalPlaces }}
            bezier
            style={{ borderRadius: 8, paddingTop: PAD_TOP, paddingRight: 0 }}
            withDots={showDots}
            withInnerLines={true}
            withOuterLines={false}
            withHorizontalLines={false}
            withHorizontalLabels={false}
            withVerticalLabels={true}
            withShadow={false}
            transparent
          />
        </ScrollView>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {lines.map((l, i) => (
            <View
              key={i}
              style={[
                s.gridLine,
                { backgroundColor: t.border + "99" },
                { top: l.y - 0.25 },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
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
      datasets: [{ data: weightPoints.map((p) => p.value), color: () => t.chartWeight, strokeWidth: 2.5 }],
    }
    : null;

  const getCardioData = () => {
    const pts = [];
    const entryConfig = getCardioEntry(selectedCardioExercise, cardioConfig);
    const storageKey = entryConfig ? entryConfig.id : selectedCardioExercise;

    filteredKeys.forEach(k => {
      let entry = sessions[k]?.[storageKey];
      if (entry === undefined && entryConfig) {
        entry = sessions[k]?.[entryConfig.name];
      }
      const value = getCardioChartValue(entry, selectedCardioExercise, cardioConfig);
      if (value !== null) pts.push({ key: k, value });
    });
    if (pts.length < 2) return null;
    const metric = cardioMetric(selectedCardioExercise, cardioConfig);
    return {
      labels: pts.map(p => formatDate(p.key)),
      datasets: [{ data: pts.map(p => p.value), color: () => t.chartCardio, strokeWidth: 2.5 }],
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
            <FixedAxisChart
              data={overviewData}
              height={200}
              decimalPlaces={0}
              chartWidth={Math.max(
                W - Y_AXIS_W,
                overviewData.labels.length * 64,
              )}
              scrollKey={`${overviewData.labels[overviewData.labels.length - 1] || ""}-${overviewData.labels.length}`}
              chartConfig={makeChartConfig()}
            />
          ) : (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: t.inputBg, borderColor: t.border }]}>
                <Ionicons name="analytics-outline" size={26} color={t.textSub} />
              </View>
              <Text style={[s.emptyText, { color: t.textSub }]}>Log at least 2 sessions to see a trend</Text>
              <Text style={[s.emptySubText, { color: t.textSub }]}>Track your first week in Today and a volume curve appears here.</Text>
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
            <FixedAxisChart
              data={drillData}
              height={180}
              decimalPlaces={0}
              chartWidth={Math.max(
                W - Y_AXIS_W,
                drillData.labels.length * 64,
              )}
              scrollKey={`${activeMuscle}-${drillData.labels[drillData.labels.length - 1] || ""}-${drillData.labels.length}`}
              chartConfig={makeChartConfig(
                getMuscleColor(activeMuscle, muscleGroups.indexOf(activeMuscle)),
              )}
              showDots
            />
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
            <FixedAxisChart
              data={weightData}
              height={180}
              decimalPlaces={1}
              chartWidth={Math.max(
                W - Y_AXIS_W,
                weightData.labels.length * 64,
              )}
              scrollKey={`${weightData.labels[weightData.labels.length - 1] || ""}-${weightData.labels.length}`}
              chartConfig={{
                ...makeChartConfig(t.chartWeight),
                yAxisSuffix: ' kg',
              }}
              showDots
            />
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
                      { borderColor: active ? t.chartCardio : t.border, backgroundColor: active ? t.chartCardio + '22' : t.inputBg },
                    ]}
                    onPress={() => setSelectedCardioExercise(exercise)}
                  >
                    <View style={[s.chipDot, { backgroundColor: t.chartCardio }]} />
                    <Text style={[s.chipText, { color: active ? t.chartCardio : t.textSub, fontWeight: active ? '600' : '400' }]}>{exercise}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          {cardioData ? (
            <FixedAxisChart
              data={cardioData}
              height={170}
              decimalPlaces={selectedCardioMetric === 'minutes' ? 0 : 1}
              chartWidth={Math.max(
                W - Y_AXIS_W,
                cardioData.labels.length * 64,
              )}
              scrollKey={`${selectedCardioExercise}-${cardioData.labels[cardioData.labels.length - 1] || ""}-${cardioData.labels.length}`}
              chartConfig={{
                ...makeChartConfig(t.chartCardio),
                yAxisSuffix: cardioIsSteps ? ' steps' : cardioIsDistance ? ' km/h' : ' min',
              }}
              showDots
            />
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
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18, fontWeight: '600' },
  emptySubText: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 4, maxWidth: 260 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  chartRow: { flexDirection: 'row', alignItems: 'stretch' },
  yAxis: {
    width: Y_AXIS_W,
    borderRightWidth: 0.5,
    position: 'relative',
  },
  tickWrap: {
    position: 'absolute',
    left: 0,
    right: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 14,
  },
  tickText: { fontSize: 9, fontVariant: ['tabular-nums'] },
  plotWrap: { flex: 1, position: 'relative' },
  plot: { width: '100%', height: '100%' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.5,
  },
});

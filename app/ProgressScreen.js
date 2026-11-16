import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import AppLogo from "../app/AppLogo";
import {
  DEFAULT_PLAN,
  DEFAULT_CARDIO_CONFIG,
  MUSCLE_COLORS,
  applyCardioConfigToPlan,
  getCardioEntry,
  getPlanMuscles,
  isWeightExercise,
} from "../app/data";
import {
  loadSessions,
  formatDate,
  getFilteredKeys,
  loadWorkoutPlan,
  loadCardioConfig,
  loadCatalog,
} from "../app/storage";
import { useTheme } from "../app/theme";
import {
  getCardioMetricLabel,
  getCardioMetricSubtitle,
  getCardioMetricValue,
  getSessionMuscleVolume,
  getSessionMuscleVolumes,
} from "../app/sessionUtils";

const FILTERS = [
  { key: "4w", label: "4 weeks" },
  { key: "3m", label: "3 months" },
  { key: "all", label: "All time" },
];

function getWeightChartValue(entry) {
  if (!entry || typeof entry !== "object") return null;
  const kg = parseFloat(entry.kg ?? entry.weight ?? entry.value) || 0;
  return kg > 0 ? kg : null;
}

function getMuscleColor(muscleName, index = 0) {
  return (
    MUSCLE_COLORS[muscleName] ||
    ["#7B72E8", "#E8724A", "#2DBF8E", "#4A9FE8", "#E8B84A", "#7ABF3A", "#9A9A9A"][
      index % 7
    ]
  );
}

const Y_AXIS_W = 44;
const PAD_TOP = 8;
const CHART_SEGMENTS = 4;

function getFlatPoints(data) {
  const out = [];
  (data?.datasets || []).forEach((dataset) =>
    (dataset.data || []).forEach((value) => {
      if (value != null && !Number.isNaN(Number(value))) out.push(Number(value));
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
  const segments = min === max ? 1 : CHART_SEGMENTS;
  const base = height * 0.75;
  const lines = [];
  const ticks = [];

  for (let index = 0; index <= segments; index += 1) {
    const y = (base / segments) * index + PAD_TOP;
    lines.push({ y });
    if (segments === 1) {
      if (index === segments) ticks.push({ y, value: points[0] });
    } else {
      ticks.push({
        y,
        value: (scaler / segments) * (segments - index) + min,
      });
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
        {ticks.map((tick, index) => (
          <View
            key={index}
            pointerEvents="none"
            style={[s.tickWrap, { top: tick.y - 7 }]}
          >
            <Text style={[s.tickText, { color: t.textSub }]}>
              {tick.value.toFixed(decimalPlaces)}
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
            withInnerLines
            withOuterLines={false}
            withHorizontalLines={false}
            withHorizontalLabels={false}
            withVerticalLabels
            withShadow={false}
            transparent
          />
        </ScrollView>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {lines.map((line, index) => (
            <View
              key={index}
              style={[
                s.gridLine,
                { backgroundColor: t.border + "99" },
                { top: line.y - 0.25 },
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
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [catalog, setCatalog] = useState({});
  const [filter, setFilter] = useState("all");
  const [selectedMuscle, setSelectedMuscle] = useState("");
  const [cardioConfig, setCardioConfig] = useState(DEFAULT_CARDIO_CONFIG);
  const [selectedCardioExercise, setSelectedCardioExercise] = useState(
    DEFAULT_CARDIO_CONFIG[0]?.name || "",
  );
  const [selectedCardioMetric, setSelectedCardioMetric] = useState("duration");

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        loadSessions(),
        loadWorkoutPlan(),
        loadCardioConfig(),
        loadCatalog(),
      ]).then(([savedSessions, savedPlan, savedCardio, savedCatalog]) => {
        const config = savedCardio || DEFAULT_CARDIO_CONFIG;
        setSessions(savedSessions);
        setCardioConfig(config);
        setCatalog(savedCatalog || {});
        setPlan(applyCardioConfigToPlan(savedPlan || DEFAULT_PLAN, config));
        setSelectedCardioExercise((previous) =>
          config.some((entry) => entry.name === previous)
            ? previous
            : config[0]?.name || "",
        );
      });
    }, []),
  );

  const filteredKeys = getFilteredKeys(sessions, filter);
  const muscleGroups = useMemo(() => getPlanMuscles(plan), [plan]);
  // Exercises removed from the plan keep their history via the catalog. Surface
  // that volume as "Other" instead of hiding it from the charts.
  const chartMuscles = useMemo(() => {
    const hasOther = filteredKeys.some(
      (key) => (getSessionMuscleVolumes(sessions[key], catalog).Other || 0) > 0,
    );
    return hasOther && !muscleGroups.includes("Other")
      ? [...muscleGroups, "Other"]
      : muscleGroups;
  }, [filteredKeys, sessions, catalog, muscleGroups]);
  const activeMuscle = chartMuscles.includes(selectedMuscle)
    ? selectedMuscle
    : chartMuscles[0] || "";

  useEffect(() => {
    if (!chartMuscles.length) return;
    if (!chartMuscles.includes(selectedMuscle)) {
      setSelectedMuscle(chartMuscles[0]);
    }
  }, [chartMuscles, selectedMuscle]);

  const getAllMusclesData = () => {
    const byMuscle = {};
    chartMuscles.forEach((muscle) => {
      byMuscle[muscle] = {};
    });

    filteredKeys.forEach((key) => {
      const volumes = getSessionMuscleVolumes(sessions[key], catalog);
      Object.entries(volumes).forEach(([muscle, volume]) => {
        if (!byMuscle[muscle]) byMuscle[muscle] = {};
        if (volume > 0) byMuscle[muscle][key] = volume;
      });
    });

    const labelKeys = filteredKeys.filter((key) =>
      chartMuscles.some((muscle) => byMuscle[muscle]?.[key] > 0),
    );
    if (labelKeys.length < 2) return null;

    const datasets = chartMuscles
      .filter((muscle) => Object.keys(byMuscle[muscle] || {}).length > 0)
      .map((muscle, index) => ({
        data: labelKeys.map((key) => byMuscle[muscle][key] || 0),
        color: () => getMuscleColor(muscle, index),
        strokeWidth: 2,
      }));

    return datasets.length > 0
      ? { labels: labelKeys.map(formatDate), datasets }
      : null;
  };

  const getDrillData = () => {
    const points = [];
    filteredKeys.forEach((key) => {
      const volume = getSessionMuscleVolume(sessions[key], activeMuscle, catalog);
      if (volume > 0) points.push({ key, volume });
    });
    if (points.length < 2) return null;
    const color = getMuscleColor(
      activeMuscle,
      chartMuscles.indexOf(activeMuscle),
    );
    return {
      labels: points.map((point) => formatDate(point.key)),
      datasets: [
        {
          data: points.map((point) => point.volume),
          color: () => color,
          strokeWidth: 2.5,
        },
      ],
    };
  };

  const overviewData = getAllMusclesData();
  const drillData = getDrillData();

  const weightPoints = [];
  filteredKeys.forEach((key) => {
    const session = sessions[key] || {};
    const entryKey = Object.keys(session).find(
      (exercise) => isWeightExercise(exercise) && session[exercise],
    );
    const value = getWeightChartValue(entryKey ? session[entryKey] : null);
    if (value !== null) weightPoints.push({ key, value });
  });
  const weightData =
    weightPoints.length >= 2
      ? {
          labels: weightPoints.map((point) => formatDate(point.key)),
          datasets: [
            {
              data: weightPoints.map((point) => point.value),
              color: () => t.chartWeight,
              strokeWidth: 2.5,
            },
          ],
        }
      : null;

  const selectedCardioConfig = getCardioEntry(
    selectedCardioExercise,
    cardioConfig,
  );
  const cardioMetrics =
    selectedCardioConfig?.fields?.length > 0
      ? selectedCardioConfig.fields
      : ["duration"];
  const activeCardioMetric = cardioMetrics.includes(selectedCardioMetric)
    ? selectedCardioMetric
    : cardioMetrics[0];

  const getCardioData = () => {
    const points = [];
    filteredKeys.forEach((key) => {
      const entry = getCardioEntry(selectedCardioExercise, cardioConfig);
      const storageKey = entry?.id || selectedCardioExercise;
      let value = sessions[key]?.[storageKey];
      if (value === undefined && entry) value = sessions[key]?.[entry.name];
      const metricValue = getCardioMetricValue(value, activeCardioMetric);
      if (metricValue !== null) points.push({ key, value: metricValue });
    });
    if (points.length < 2) return null;
    return {
      labels: points.map((point) => formatDate(point.key)),
      datasets: [
        {
          data: points.map((point) => point.value),
          color: () => t.chartCardio,
          strokeWidth: 2.5,
        },
      ],
    };
  };

  const cardioData = getCardioData();

  const makeChartConfig = (lineColor) => ({
    backgroundGradientFrom: t.surface,
    backgroundGradientTo: t.surface,
    backgroundGradientFromOpacity: 1,
    backgroundGradientToOpacity: 1,
    decimalPlaces: 0,
    color: (opacity = 1) => lineColor || `rgba(123,114,232,${opacity})`,
    labelColor: () => t.textSub,
    propsForDots: { r: "4", strokeWidth: "0" },
    propsForLabels: { fontSize: 9 },
    propsForBackgroundLines: { stroke: t.border, strokeWidth: 0.5 },
  });

  const cardioDecimals = activeCardioMetric === "duration" ? 0 : 1;
  const cardioSuffix =
    activeCardioMetric === "duration"
      ? " min"
      : activeCardioMetric === "distance"
        ? " km"
        : activeCardioMetric === "speed"
          ? " km/h"
          : " %";

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
            <Text style={[s.topTitle, { color: t.text }]}>Progress</Text>
            <Text style={[s.topSub, { color: t.textSub }]}>
              Volume over time per muscle
            </Text>
          </View>
          <AppLogo theme={t} compact />
        </View>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={s.filterRow}>
          {FILTERS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                s.filterBtn,
                { borderColor: t.border, backgroundColor: t.surface },
                filter === item.key && {
                  backgroundColor: t.accent,
                  borderColor: t.accent,
                },
              ]}
              onPress={() => setFilter(item.key)}
            >
              <Text
                style={[
                  s.filterText,
                  { color: t.textSub },
                  filter === item.key && { color: "#fff" },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={[
            s.card,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
        >
          <Text style={[s.cardTitle, { color: t.text }]}>All muscles</Text>
          <Text style={[s.cardSub, { color: t.textSub }]}>
            Volume per session (kg)
          </Text>
          <View style={s.legendRow}>
            {chartMuscles.map((muscle, index) => (
              <View key={muscle} style={s.legendItem}>
                <View
                  style={[
                    s.legendDot,
                    { backgroundColor: getMuscleColor(muscle, index) },
                  ]}
                />
                <Text style={[s.legendText, { color: t.textSub }]}>
                  {muscle}
                </Text>
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
              <View
                style={[
                  s.emptyIcon,
                  { backgroundColor: t.inputBg, borderColor: t.border },
                ]}
              >
                <Ionicons
                  name="analytics-outline"
                  size={26}
                  color={t.textSub}
                />
              </View>
              <Text style={[s.emptyText, { color: t.textSub }]}>
                Log at least 2 sessions to see a trend
              </Text>
              <Text style={[s.emptySubText, { color: t.textSub }]}>
                Track your first week in Today and a volume curve appears here.
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            s.card,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
        >
          <Text style={[s.cardTitle, { color: t.text }]}>Muscle drilldown</Text>
          <Text style={[s.cardSub, { color: t.textSub }]}>
            Tap a muscle to inspect its curve
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14 }}
          >
            <View style={s.chipRow}>
              {chartMuscles.map((muscle, index) => {
                const active = activeMuscle === muscle;
                const color = getMuscleColor(muscle, index);
                return (
                  <TouchableOpacity
                    key={muscle}
                    style={[
                      s.chip,
                      {
                        borderColor: active ? color : t.border,
                        backgroundColor: active ? color + "22" : t.inputBg,
                      },
                    ]}
                    onPress={() => setSelectedMuscle(muscle)}
                  >
                    <View style={[s.chipDot, { backgroundColor: color }]} />
                    <Text
                      style={[
                        s.chipText,
                        {
                          color: active ? color : t.textSub,
                          fontWeight: active ? "600" : "400",
                        },
                      ]}
                    >
                      {muscle}
                    </Text>
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
              chartWidth={Math.max(W - Y_AXIS_W, drillData.labels.length * 64)}
              scrollKey={`${activeMuscle}-${drillData.labels[drillData.labels.length - 1] || ""}-${drillData.labels.length}`}
              chartConfig={makeChartConfig(
                getMuscleColor(
                  activeMuscle,
                  chartMuscles.indexOf(activeMuscle),
                ),
              )}
              showDots
            />
          ) : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: t.textHint }]}>
                Log at least 2 {activeMuscle || "muscle"} sessions to see chart
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            s.card,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
        >
          <Text style={[s.cardTitle, { color: t.text }]}>Weight</Text>
          <Text style={[s.cardSub, { color: t.textSub }]}>
            Body weight over time (kg)
          </Text>
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
                yAxisSuffix: " kg",
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

        <View
          style={[
            s.card,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
        >
          <Text style={[s.cardTitle, { color: t.text }]}>
            {selectedCardioExercise} progress
          </Text>
          <Text style={[s.cardSub, { color: t.textSub }]}>
            {getCardioMetricSubtitle(activeCardioMetric)}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
          >
            <View style={s.chipRow}>
              {cardioConfig.map((entry) => {
                const active = selectedCardioExercise === entry.name;
                return (
                  <TouchableOpacity
                    key={entry.id || entry.name}
                    style={[
                      s.chip,
                      {
                        borderColor: active ? t.chartCardio : t.border,
                        backgroundColor: active
                          ? t.chartCardio + "22"
                          : t.inputBg,
                      },
                    ]}
                    onPress={() => {
                      setSelectedCardioExercise(entry.name);
                      setSelectedCardioMetric(entry.fields?.[0] || "duration");
                    }}
                  >
                    <View
                      style={[s.chipDot, { backgroundColor: t.chartCardio }]}
                    />
                    <Text
                      style={[
                        s.chipText,
                        {
                          color: active ? t.chartCardio : t.textSub,
                          fontWeight: active ? "600" : "400",
                        },
                      ]}
                    >
                      {entry.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {cardioMetrics.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              <View style={s.chipRow}>
                {cardioMetrics.map((metric) => {
                  const active = activeCardioMetric === metric;
                  return (
                    <TouchableOpacity
                      key={metric}
                      style={[
                        s.metricChip,
                        {
                          borderColor: active ? t.accent : t.border,
                          backgroundColor: active
                            ? t.accent + "22"
                            : t.inputBg,
                        },
                      ]}
                      onPress={() => setSelectedCardioMetric(metric)}
                    >
                      <Text
                        style={[
                          s.metricChipText,
                          {
                            color: active ? t.accent : t.textSub,
                            fontWeight: active ? "600" : "400",
                          },
                        ]}
                      >
                        {getCardioMetricLabel(metric)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {cardioData ? (
            <FixedAxisChart
              data={cardioData}
              height={170}
              decimalPlaces={cardioDecimals}
              chartWidth={Math.max(W - Y_AXIS_W, cardioData.labels.length * 64)}
              scrollKey={`${selectedCardioExercise}-${activeCardioMetric}-${cardioData.labels[cardioData.labels.length - 1] || ""}-${cardioData.labels.length}`}
              chartConfig={{
                ...makeChartConfig(t.chartCardio),
                yAxisSuffix: cardioSuffix,
              }}
              showDots
            />
          ) : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: t.textHint }]}>
                Log at least 2 {selectedCardioExercise} sessions to see chart
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
  topTitle: { fontSize: 20, fontWeight: "600" },
  topSub: { fontSize: 12, marginTop: 3 },
  scroll: { flex: 1, padding: 12 },
  filterRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    shadowColor: "#000",
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
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  cardSub: { fontSize: 11, marginBottom: 10 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10 },
  chipRow: { flexDirection: "row", gap: 6, paddingRight: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11 },
  metricChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metricChipText: { fontSize: 10 },
  empty: { height: 100, alignItems: "center", justifyContent: "center" },
  emptyText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "600",
  },
  emptySubText: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
    maxWidth: 260,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  chartRow: { flexDirection: "row", alignItems: "stretch" },
  yAxis: {
    width: Y_AXIS_W,
    borderRightWidth: 0.5,
    position: "relative",
  },
  tickWrap: {
    position: "absolute",
    left: 0,
    right: 6,
    alignItems: "flex-end",
    justifyContent: "center",
    height: 14,
  },
  tickText: { fontSize: 9, fontVariant: ["tabular-nums"] },
  plotWrap: { flex: 1, position: "relative" },
  plot: { width: "100%", height: "100%" },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 0.5,
  },
});

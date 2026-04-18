import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'workout_sessions_v1';
const PLAN_KEY = 'workout_plan_v1';

export async function loadSessions() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function saveSessions(sessions) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(sessions)); } catch {}
}

export async function loadWorkoutPlan() {
  try {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveWorkoutPlan(plan) {
  try { await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch {}
}

export function renameExerciseInSessions(sessions, oldName, newName) {
  if (!oldName || !newName || oldName === newName) {
    return { sessions, changed: false };
  }
  const next = { ...sessions };
  let changed = false;
  Object.keys(next).forEach(k => {
    const day = next[k];
    if (!day || typeof day !== 'object' || Array.isArray(day)) return;
    if (!Object.prototype.hasOwnProperty.call(day, oldName)) return;
    const oldSets = Array.isArray(day[oldName]) ? day[oldName] : [];
    const existing = Array.isArray(day[newName]) ? day[newName] : [];
    day[newName] = existing.length > 0 ? [...existing, ...oldSets] : oldSets;
    delete day[oldName];
    changed = true;
  });
  return { sessions: next, changed };
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(key) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function getSessionVolume(sessionData) {
  if (!sessionData) return 0;
  let vol = 0;
  Object.entries(sessionData).forEach(([k, sets]) => {
    if (k.startsWith('_') || !Array.isArray(sets)) return;
    sets.forEach(s => { vol += (parseFloat(s.w) || 0) * (parseInt(s.r) || 0); });
  });
  return Math.round(vol);
}

export function getMuscleVolume(sessionData, muscleName, dayPlan) {
  if (!sessionData || !dayPlan) return 0;
  let vol = 0;
  dayPlan.groups.forEach(g => {
    if (g.name !== muscleName) return;
    g.exercises.forEach(ex => {
      (sessionData[ex] || []).forEach(s => {
        vol += (parseFloat(s.w) || 0) * (parseInt(s.r) || 0);
      });
    });
  });
  return Math.round(vol);
}

export function getFilteredKeys(sessions, filter) {
  const keys = Object.keys(sessions).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  if (filter === 'all') return keys;
  const cutoff = new Date();
  if (filter === '4w') cutoff.setDate(cutoff.getDate() - 28);
  else if (filter === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
  return keys.filter(k => new Date(k + 'T00:00:00') >= cutoff);
}

export function getLatestExerciseSets(sessions, exerciseName, excludeKey) {
  if (!exerciseName || !sessions || typeof sessions !== 'object') {
    return { sets: null, dateKey: null };
  }
  const keys = Object.keys(sessions)
    .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && k !== excludeKey)
    .sort()
    .reverse();

  for (const k of keys) {
    const day = sessions[k];
    const sets = Array.isArray(day?.[exerciseName]) ? day[exerciseName] : null;
    if (sets && sets.length > 0) {
      return {
        sets: JSON.parse(JSON.stringify(sets)),
        dateKey: k,
      };
    }
  }
  return { sets: null, dateKey: null };
}

function getWeekKey(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNo = 1 + Math.round((d - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function percentageChange(prev, curr) {
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 10000) / 100;
}

export function buildLLMExportPayload(sessions, planMap) {
  const sessionKeys = Object.keys(sessions || {}).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const muscles = [];
  Object.values(planMap || {}).forEach(day => {
    if (!day?.groups) return;
    day.groups.forEach(g => {
      if (!muscles.includes(g.name)) muscles.push(g.name);
    });
  });

  const byMuscle = {};
  muscles.forEach(m => {
    byMuscle[m] = {
      total_volume_kg: 0,
      total_sets: 0,
      sessions_touched: 0,
      per_week_volume_kg: {},
      recent_28d_volume_kg: 0,
      previous_28d_volume_kg: 0,
    };
  });

  const byWeek = {};
  const byDayOfWeek = {};
  let totalVolume = 0;
  let totalSets = 0;

  const now = new Date();
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 28);
  const prevStart = new Date(now);
  prevStart.setDate(prevStart.getDate() - 56);

  sessionKeys.forEach(k => {
    const session = sessions[k] || {};
    const dow = session._dow;
    const day = planMap?.[dow];
    if (!day) return;

    let sessionVolume = 0;
    let sessionSets = 0;
    const touched = new Set();
    const wk = getWeekKey(k);
    const sessionDate = new Date(k + 'T00:00:00');

    day.groups.forEach(g => {
      g.exercises.forEach(ex => {
        const sets = Array.isArray(session[ex]) ? session[ex] : [];
        if (sets.length === 0) return;
        touched.add(g.name);
        sets.forEach(set => {
          const vol = (parseFloat(set.w) || 0) * (parseInt(set.r) || 0);
          sessionVolume += vol;
          sessionSets += 1;
          if (!byWeek[wk]) byWeek[wk] = { total_volume_kg: 0, total_sets: 0, sessions: 0 };
          byWeek[wk].total_volume_kg += vol;
          byWeek[wk].total_sets += 1;
          byMuscle[g.name].total_volume_kg += vol;
          byMuscle[g.name].total_sets += 1;
          byMuscle[g.name].per_week_volume_kg[wk] = (byMuscle[g.name].per_week_volume_kg[wk] || 0) + vol;

          if (sessionDate >= recentStart) byMuscle[g.name].recent_28d_volume_kg += vol;
          else if (sessionDate >= prevStart && sessionDate < recentStart) {
            byMuscle[g.name].previous_28d_volume_kg += vol;
          }
        });
      });
    });

    touched.forEach(m => { byMuscle[m].sessions_touched += 1; });

    if (!byDayOfWeek[dow]) byDayOfWeek[dow] = { sessions: 0, volume_kg: 0, sets: 0 };
    byDayOfWeek[dow].sessions += 1;
    byDayOfWeek[dow].volume_kg += sessionVolume;
    byDayOfWeek[dow].sets += sessionSets;

    if (!byWeek[wk]) byWeek[wk] = { total_volume_kg: 0, total_sets: 0, sessions: 0 };
    byWeek[wk].sessions += 1;

    totalVolume += sessionVolume;
    totalSets += sessionSets;
  });

  muscles.forEach(m => {
    byMuscle[m].total_volume_kg = Math.round(byMuscle[m].total_volume_kg);
    byMuscle[m].recent_28d_volume_kg = Math.round(byMuscle[m].recent_28d_volume_kg);
    byMuscle[m].previous_28d_volume_kg = Math.round(byMuscle[m].previous_28d_volume_kg);
    Object.keys(byMuscle[m].per_week_volume_kg).forEach(w => {
      byMuscle[m].per_week_volume_kg[w] = Math.round(byMuscle[m].per_week_volume_kg[w]);
    });
    byMuscle[m].trend_28d_vs_prev_28d_pct = percentageChange(
      byMuscle[m].previous_28d_volume_kg,
      byMuscle[m].recent_28d_volume_kg
    );
  });

  Object.keys(byWeek).forEach(w => {
    byWeek[w].total_volume_kg = Math.round(byWeek[w].total_volume_kg);
  });

  const muscleVolumes = muscles.map(m => byMuscle[m].total_volume_kg);
  const avgMuscleVolume = muscleVolumes.length
    ? muscleVolumes.reduce((a, b) => a + b, 0) / muscleVolumes.length
    : 0;

  const balance = muscles.map(m => {
    const ratio = avgMuscleVolume > 0 ? byMuscle[m].total_volume_kg / avgMuscleVolume : 1;
    return {
      muscle: m,
      total_volume_kg: byMuscle[m].total_volume_kg,
      volume_vs_avg_ratio: Math.round(ratio * 100) / 100,
      status:
        ratio < 0.8 ? 'undertrained' :
        ratio > 1.2 ? 'overemphasized' :
        'balanced',
    };
  });

  return {
    metadata: {
      schema_version: 'llm_export_v1',
      generated_at_iso: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      units: {
        weight: 'kg',
        volume: 'kg_reps',
      },
    },
    annotations: {
      purpose: 'Analyze progression and muscle-group balance over time.',
      interpretation_notes: [
        'total_volume_kg is computed as sum(weight * reps) over all logged sets.',
        'trend_28d_vs_prev_28d_pct compares recent 28 days against the prior 28 days.',
        'balance.status is a heuristic based on total volume vs average across all muscles.',
        'status=undertrained if ratio < 0.8, overemphasized if ratio > 1.2.',
      ],
      suggested_llm_prompts: [
        'Identify muscle groups that are undertrained relative to others and suggest weekly volume targets.',
        'Find whether progression is stalling for any muscle based on 28-day trend and weekly series.',
        'Recommend a rebalancing plan while preserving my current split structure.',
      ],
      caveats: [
        'This export reflects logged data only; missed logs look like lower training volume.',
        'Changing exercise names is migrated in-session data, but historical intent relies on day split mapping.',
      ],
    },
    raw: {
      workout_plan: planMap,
      sessions,
    },
    derived: {
      totals: {
        session_count: sessionKeys.length,
        total_sets: totalSets,
        total_volume_kg: Math.round(totalVolume),
      },
      by_muscle: byMuscle,
      by_day_of_week: byDayOfWeek,
      by_week: byWeek,
      balance_summary: balance,
      potential_focus_muscles: balance
        .filter(b => b.status === 'undertrained')
        .map(b => b.muscle),
    },
  };
}

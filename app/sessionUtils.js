import {
  DEFAULT_CARDIO_CONFIG,
  getCardioEntry,
  getCardioFields,
  isCardioExercise,
  isWeightExercise,
} from "./data";
import { getExerciseMuscle, isTimedExercise } from "./catalog";
import {
  hasLoggedSets,
  normalizeWorkoutSets,
  setHasValue,
} from "./workoutSets";
import { minutesToSeconds } from "./dates";

function readCardioField(entry, keys) {
  for (const key of keys) {
    const value = entry?.[key];
    if (value != null && String(value).trim() !== "") return String(value);
  }
  return "";
}

export function normalizeCardioValues(entry) {
  const value =
    entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const minutes = readCardioField(value, ["minutes"]);
  const durationRaw = readCardioField(value, ["durationSec", "seconds"]);
  const secondsFromMinutes = minutes !== "" ? minutesToSeconds(minutes) : 0;
  const durationSec =
    durationRaw !== ""
      ? durationRaw
      : secondsFromMinutes > 0
        ? String(secondsFromMinutes)
        : "";
  return {
    durationSec,
    distance: readCardioField(value, ["distance", "km"]),
    speed: readCardioField(value, ["speed"]),
    incline: readCardioField(value, ["incline"]),
  };
}

export function hasCardioValues(entry) {
  const values = normalizeCardioValues(entry);
  return Object.values(values).some((value) => {
    const text = String(value).trim();
    if (text === "") return false;
    const parsed = Number(text);
    // A legacy save bug wrote durationSec "0" for untouched cardio entries.
    return !Number.isFinite(parsed) || parsed !== 0;
  });
}

// Some legacy cardio rows were arrays of { m } minute slots.
export function coerceCardioEntry(entry) {
  if (Array.isArray(entry)) {
    const seconds = entry.reduce(
      (sum, row) =>
        sum +
        (parseInt(row?.t, 10) ||
          minutesToSeconds(row?.m) ||
          minutesToSeconds(row?.minutes) ||
          0),
      0,
    );
    return seconds > 0 ? { durationSec: String(seconds) } : {};
  }
  return entry && typeof entry === "object" ? entry : {};
}

export function getCardioStorageKey(exerciseName, cardioConfig) {
  const config = getCardioEntry(exerciseName, cardioConfig);
  return config?.id || exerciseName;
}

export function getSessionEntry(
  session,
  exerciseName,
  cardioConfig = DEFAULT_CARDIO_CONFIG,
) {
  const cardio = getCardioEntry(exerciseName, cardioConfig);
  if (cardio) {
    const key = cardio.id || cardio.name;
    let entry = session?.[key];
    if (entry === undefined) entry = session?.[cardio.name];
    return {
      key,
      name: cardio.name,
      kind: "cardio",
      entry: coerceCardioEntry(entry),
      config: cardio,
    };
  }

  if (isWeightExercise(exerciseName)) {
    return {
      key: exerciseName,
      name: exerciseName,
      kind: "weight",
      entry: session?.[exerciseName] || {},
      config: null,
    };
  }

  return {
    key: exerciseName,
    name: exerciseName,
    kind: "strength",
    entry: session?.[exerciseName],
    config: null,
  };
}

export function isEntryLogged(entryInfo) {
  if (!entryInfo) return false;
  if (entryInfo.kind === "cardio") return hasCardioValues(entryInfo.entry);
  if (entryInfo.kind === "weight") {
    return String(entryInfo.entry?.kg ?? "").trim() !== "";
  }
  return hasLoggedSets(entryInfo.entry);
}

function looksLikeCardioEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  return ["durationSec", "minutes", "seconds", "distance", "km", "speed", "incline"].some(
    (key) => entry[key] !== undefined,
  );
}

export function getLoggedSessionEntries(
  session,
  cardioConfig = DEFAULT_CARDIO_CONFIG,
) {
  if (!session || typeof session !== "object") return [];
  const entries = [];
  const seen = new Set();

  Object.keys(session).forEach((key) => {
    if (key.startsWith("_")) return;
    const value = session[key];
    if (value == null) return;

    const cardio = getCardioEntry(key, cardioConfig);
    let info;
    if (cardio) {
      info = getSessionEntry(session, key, cardioConfig);
    } else if (isWeightExercise(key)) {
      info = getSessionEntry(session, key, cardioConfig);
    } else if (looksLikeCardioEntry(value)) {
      info = {
        key,
        name: key,
        kind: "cardio",
        entry: coerceCardioEntry(value),
        config: null,
      };
    } else {
      info = getSessionEntry(session, key, cardioConfig);
    }

    const dedupe = `${info.kind}:${info.key}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    entries.push(info);
  });

  return entries;
}

export function getSessionEntries(
  session,
  workout,
  cardioConfig = DEFAULT_CARDIO_CONFIG,
) {
  const entries = getLoggedSessionEntries(session, cardioConfig);
  const seen = new Set(entries.map((entry) => `${entry.kind}:${entry.key}`));
  const seenNames = new Set(entries.map((entry) => entry.name.toLowerCase()));

  (workout?.groups || []).forEach((group) => {
    (group.exercises || []).forEach((exerciseName) => {
      const info = getSessionEntry(session, exerciseName, cardioConfig);
      if (seen.has(`${info.kind}:${info.key}`)) return;
      if (seenNames.has(info.name.toLowerCase())) return;
      seen.add(`${info.kind}:${info.key}`);
      seenNames.add(info.name.toLowerCase());
      entries.push(info);
    });
  });

  return entries;
}

export function getSessionMuscleTags(session, catalog, cardioConfig) {
  const muscles = new Set();
  getLoggedSessionEntries(session, cardioConfig).forEach((entry) => {
    if (entry.kind !== "strength") return;
    if (!hasLoggedSets(entry.entry)) return;
    muscles.add(getExerciseMuscle(entry.name, catalog));
  });
  return Array.from(muscles);
}

export function getSessionMuscleVolumes(session, catalog) {
  const volumes = {};
  if (!session || typeof session !== "object") return volumes;

  Object.keys(session).forEach((key) => {
    if (key.startsWith("_")) return;
    const sets = session[key];
    if (!Array.isArray(sets)) return;
    const muscle = getExerciseMuscle(key, catalog);
    normalizeWorkoutSets(sets).forEach((set) => {
      if (!setHasValue(set)) return;
      const volume = (parseFloat(set.w) || 0) * (parseInt(set.r, 10) || 0);
      if (volume > 0) volumes[muscle] = (volumes[muscle] || 0) + volume;
    });
  });

  Object.keys(volumes).forEach((muscle) => {
    volumes[muscle] = Math.round(volumes[muscle]);
  });
  return volumes;
}

export function getSessionMuscleVolume(session, muscle, catalog) {
  return getSessionMuscleVolumes(session, catalog)[muscle] || 0;
}

export function getSessionTimedSeconds(session, catalog) {
  let seconds = 0;
  if (!session || typeof session !== "object") return 0;
  Object.keys(session).forEach((key) => {
    if (key.startsWith("_")) return;
    const sets = session[key];
    if (!Array.isArray(sets)) return;
    if (!isTimedExercise(key, catalog)) return;
    normalizeWorkoutSets(sets).forEach((set) => {
      seconds += parseInt(set.t, 10) || 0;
    });
  });
  return seconds;
}

export function getCardioMetricValue(entry, metric) {
  const values = normalizeCardioValues(entry);
  const has = (key) => String(values[key] ?? "").trim() !== "";
  const durationSeconds = Number(values.durationSec) || 0;
  const distance = parseFloat(values.distance) || 0;

  switch (metric) {
    case "duration":
      return durationSeconds > 0 ? durationSeconds / 60 : null;
    case "distance":
      return has("distance") ? distance : null;
    case "speed": {
      if (has("speed")) return parseFloat(values.speed) || 0;
      if (distance > 0 && durationSeconds > 0) {
        return Math.round((distance / (durationSeconds / 3600)) * 10) / 10;
      }
      return null;
    }
    case "incline":
      return has("incline") ? parseFloat(values.incline) || 0 : null;
    default:
      return null;
  }
}

export function getCardioMetricLabel(metric) {
  switch (metric) {
    case "duration":
      return "Duration (min)";
    case "distance":
      return "Distance (km)";
    case "speed":
      return "Speed (km/h)";
    case "incline":
      return "Incline (%)";
    default:
      return metric;
  }
}

export function getCardioMetricSubtitle(metric) {
  switch (metric) {
    case "duration":
      return "Duration (min) — higher is better";
    case "distance":
      return "Distance (km) — higher is better";
    case "speed":
      return "Speed (km/h) — higher is better";
    case "incline":
      return "Incline (%) — higher is better";
    default:
      return "";
  }
}

export function getCardioSummary(entry, configEntry) {
  const values = normalizeCardioValues(entry);
  const configured = configEntry
    ? getCardioFields(configEntry.name, [configEntry])
    : [];
  const inferred = ["duration", "distance", "speed", "incline"].filter(
    (field) =>
      field === "duration"
        ? Number(values.durationSec) > 0
        : String(values[field] ?? "").trim() !== "",
  );
  const fields = Array.from(new Set([...configured, ...inferred]));
  const parts = [];
  if (fields.includes("duration") && Number(values.durationSec) > 0) {
    const minutes = Math.floor(Number(values.durationSec) / 60);
    const seconds = Number(values.durationSec) % 60;
    parts.push(`${minutes}:${String(seconds).padStart(2, "0")} min`);
  }
  if (fields.includes("distance") && values.distance !== "") {
    parts.push(`${values.distance} km`);
  }
  if (fields.includes("speed") && values.speed !== "") {
    parts.push(`${values.speed} km/h`);
  }
  if (fields.includes("incline") && values.incline !== "") {
    parts.push(`${values.incline}% incline`);
  }
  return parts.length ? parts.join(" · ") : "Not logged";
}

export function isCardioSessionEntry(key, value, cardioConfig) {
  if (isCardioExercise(key, cardioConfig)) return true;
  return looksLikeCardioEntry(value);
}

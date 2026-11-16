import React from "react";
import { View, Text, TextInput } from "react-native";
import { getCardioFields } from "./data";
import {
  formatDuration,
  joinDuration,
  splitDuration,
} from "./dates";
import { normalizeCardioValues } from "./sessionUtils";

function FieldInput({ value, onChange, placeholder, decimal, t, s, label }) {
  return (
    <TextInput
      style={[
        s.numInput,
        {
          backgroundColor: t.inputBg,
          borderColor: t.border,
          color: t.text,
          width: 112,
          paddingHorizontal: 10,
        },
      ]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={t.textHint}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      accessibilityLabel={label}
    />
  );
}

function FieldRow({ label, hint, children, t, s, first }) {
  return (
    <View
      style={[
        s.setRow,
        {
          borderTopWidth: first ? 0 : 0.5,
          borderTopColor: t.border,
          justifyContent: "space-between",
          gap: 12,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.setLabel, { color: t.text, fontWeight: "500" }]}>
          {label}
        </Text>
        {!!hint && (
          <Text style={{ fontSize: 10, color: t.textHint, marginTop: 2 }}>
            {hint}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

export default function CardioLogger({
  entry,
  onChange,
  configEntry,
  theme: t,
  styles: s,
}) {
  const values = normalizeCardioValues(entry);
  const configuredFields = configEntry
    ? getCardioFields(configEntry.name, [configEntry])
    : [];
  // Keep any metric that already has a value visible, even if the config no
  // longer lists it, so editing never hides or drops recorded data.
  const inferredFields = ["duration", "distance", "speed", "incline"].filter(
    (field) =>
      field === "duration"
        ? Number(values.durationSec) > 0
        : String(values[field] ?? "").trim() !== "",
  );
  const fields = Array.from(new Set([...configuredFields, ...inferredFields]));
  const duration = splitDuration(values.durationSec);

  const update = (field, value) => {
    onChange({ ...values, [field]: value });
  };

  const derivedDistance =
    fields.includes("speed") &&
    !fields.includes("distance") &&
    Number(values.durationSec) > 0 &&
    parseFloat(values.speed) > 0
      ? (Number(values.durationSec) / 3600) * parseFloat(values.speed)
      : null;

  let first = true;
  const nextFirst = () => {
    const value = first;
    first = false;
    return value;
  };

  return (
    <>
      {fields.includes("duration") && (
        <FieldRow label="Duration" t={t} s={s} first={nextFirst()}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <FieldInput
              value={duration.minutes ? String(duration.minutes) : ""}
              onChange={(value) =>
                update(
                  "durationSec",
                  String(joinDuration(value, duration.seconds)),
                )
              }
              placeholder="min"
              label="Duration minutes"
              t={t}
              s={s}
            />
            <Text style={{ color: t.textSub, fontSize: 12 }}>:</Text>
            <FieldInput
              value={duration.seconds ? String(duration.seconds) : ""}
              onChange={(value) =>
                update(
                  "durationSec",
                  String(
                    joinDuration(
                      duration.minutes,
                      Math.min(59, Number(value) || 0),
                    ),
                  ),
                )
              }
              placeholder="sec"
              label="Duration seconds"
              t={t}
              s={s}
            />
          </View>
        </FieldRow>
      )}

      {fields.includes("distance") && (
        <FieldRow label="Distance" hint="km" t={t} s={s} first={nextFirst()}>
          <FieldInput
            value={values.distance}
            onChange={(value) => update("distance", value)}
            placeholder="km"
            decimal
            label="Distance in kilometres"
            t={t}
            s={s}
          />
        </FieldRow>
      )}

      {fields.includes("speed") && (
        <FieldRow label="Speed" hint="km/h" t={t} s={s} first={nextFirst()}>
          <FieldInput
            value={values.speed}
            onChange={(value) => update("speed", value)}
            placeholder="km/h"
            decimal
            label="Speed in kilometres per hour"
            t={t}
            s={s}
          />
        </FieldRow>
      )}

      {fields.includes("incline") && (
        <FieldRow label="Incline" hint="%" t={t} s={s} first={nextFirst()}>
          <FieldInput
            value={values.incline}
            onChange={(value) => update("incline", value)}
            placeholder="%"
            decimal
            label="Incline percentage"
            t={t}
            s={s}
          />
        </FieldRow>
      )}

      {derivedDistance != null && (
        <View style={[s.totalRow, { borderTopColor: t.border }]}>
          <Text style={[s.totalLabel, { color: t.textSub }]}>
            Distance (derived)
          </Text>
          <Text style={[s.totalVal, { color: t.text }]}>
            {Math.round(derivedDistance * 10) / 10} km
          </Text>
        </View>
      )}

      {fields.includes("duration") && (
        <View style={[s.totalRow, { borderTopColor: t.border }]}>
          <Text style={[s.totalLabel, { color: t.textSub }]}>Tracked time</Text>
          <Text style={[s.totalVal, { color: t.text }]}>
            {formatDuration(values.durationSec)}
          </Text>
        </View>
      )}
    </>
  );
}

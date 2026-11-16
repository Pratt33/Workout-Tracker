import React from "react";
import { View, Text, TextInput } from "react-native";
import {
  formatDuration,
  joinDuration,
  splitDuration,
} from "./dates";
import {
  getSetsDuration,
  getSetsVolume,
  setHasValue,
} from "./workoutSets";

function TimeCell({ value, onChange, placeholder, t, s }) {
  return (
    <View style={{ flex: 0.72, paddingHorizontal: 3 }}>
      <TextInput
        style={[
          s.numInput,
          {
            backgroundColor: t.inputBg,
            borderColor: t.border,
            color: t.text,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.textHint}
        keyboardType="number-pad"
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

export default function SetInputs({
  sets,
  timed = false,
  onChange,
  theme: t,
  styles: s,
}) {
  const totalVolume = getSetsVolume(sets);
  const totalDuration = getSetsDuration(sets);

  return (
    <>
      <View
        style={[
          s.setHeader,
          { borderBottomColor: t.border, backgroundColor: t.inputBg },
        ]}
      >
        <Text
          style={[
            s.setColHdr,
            { flex: timed ? 0.9 : 1.4, color: t.textHint },
          ]}
        >
          Set
        </Text>
        <Text
          style={[
            s.setColHdr,
            { flex: 1, textAlign: "center", color: t.textHint },
          ]}
        >
          Weight kg
        </Text>
        {timed ? (
          <>
            <Text
              style={[
                s.setColHdr,
                { flex: 0.72, textAlign: "center", color: t.textHint },
              ]}
            >
              Min
            </Text>
            <Text
              style={[
                s.setColHdr,
                { flex: 0.72, textAlign: "center", color: t.textHint },
              ]}
            >
              Sec
            </Text>
          </>
        ) : (
          <>
            <Text
              style={[
                s.setColHdr,
                { flex: 1, textAlign: "center", color: t.textHint },
              ]}
            >
              Reps
            </Text>
            <Text
              style={[
                s.setColHdr,
                { flex: 0.8, textAlign: "right", color: t.textHint },
              ]}
            >
              Vol
            </Text>
          </>
        )}
      </View>

      {sets.map((set, index) => {
        const duration = splitDuration(set.t);
        const volume = (parseFloat(set.w) || 0) * (parseInt(set.r, 10) || 0);
        const active = setHasValue(set);

        return (
          <View key={index} style={[s.setRow, { borderTopColor: t.border }]}>
            <Text
              style={[
                s.setLabel,
                { color: t.textSub },
                { flex: timed ? 0.9 : 1.4 },
              ]}
            >
              {set.label}
            </Text>
            <View style={{ flex: 1, paddingHorizontal: 4 }}>
              <TextInput
                style={[
                  s.numInput,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: t.border,
                    color: t.text,
                  },
                ]}
                value={set.w}
                onChangeText={(value) => onChange(index, "w", value)}
                placeholder="kg"
                placeholderTextColor={t.textHint}
                keyboardType="decimal-pad"
                accessibilityLabel={`${set.label} weight`}
              />
            </View>

            {timed ? (
              <>
                <TimeCell
                  value={duration.minutes ? String(duration.minutes) : ""}
                  placeholder="min"
                  t={t}
                  s={s}
                  onChange={(value) =>
                    onChange(
                      index,
                      "t",
                      String(joinDuration(value, duration.seconds)),
                    )
                  }
                />
                <TimeCell
                  value={
                    duration.seconds ? String(duration.seconds) : ""
                  }
                  placeholder="sec"
                  t={t}
                  s={s}
                  onChange={(value) =>
                    onChange(
                      index,
                      "t",
                      String(joinDuration(duration.minutes, value)),
                    )
                  }
                />
              </>
            ) : (
              <>
                <View style={{ flex: 1, paddingHorizontal: 4 }}>
                  <TextInput
                    style={[
                      s.numInput,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: t.border,
                        color: t.text,
                      },
                    ]}
                    value={set.r}
                    onChangeText={(value) => onChange(index, "r", value)}
                    placeholder="reps"
                    placeholderTextColor={t.textHint}
                    keyboardType="number-pad"
                    accessibilityLabel={`${set.label} reps`}
                  />
                </View>
                <Text
                  style={[
                    s.setVol,
                    {
                      flex: 0.8,
                      color: active && volume > 0 ? t.accent : t.textHint,
                    },
                  ]}
                >
                  {volume > 0 ? String(Math.round(volume)) : "—"}
                </Text>
              </>
            )}
          </View>
        );
      })}

      <View style={[s.totalRow, { borderTopColor: t.border }]}>
        <Text style={[s.totalLabel, { color: t.textSub }]}>
          {timed ? "Total time" : "Total volume"}
        </Text>
        <Text style={[s.totalVal, { color: t.text }]}>
          {timed
            ? formatDuration(totalDuration)
            : `${Math.round(totalVolume).toLocaleString()} kg`}
        </Text>
      </View>
    </>
  );
}

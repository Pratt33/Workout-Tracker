import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { cardioMetric, getCardioEntry } from './data';

export default function CardioLogger({
  exerciseName,
  cardioConfig,
  minutes, onMinutesChange,
  km, onKmChange,
  steps, onStepsChange,
  theme: t,
  styles: s,
}) {
  const metric = cardioMetric(exerciseName, cardioConfig);
  const hasSteps = metric === 'steps+km';
  const hasKm = ['minutes+km', 'steps+km'].includes(metric);
  const hasMinutes = ['minutes', 'minutes+km'].includes(metric);
  const cardioEntry = getCardioEntry(exerciseName, cardioConfig);

  return (
    <>
      <View style={[s.setHeader, { borderBottomColor: t.border, backgroundColor: t.inputBg }]}>
        <Text style={[s.setColHdr, { flex: 1.2, color: t.textHint }]}>Exercise</Text>
        {hasMinutes && <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Minutes</Text>}
        {hasSteps && <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Steps</Text>}
        {hasKm && <Text style={[s.setColHdr, { flex: 1, textAlign: 'center', color: t.textHint }]}>Km</Text>}
      </View>
      <View style={[s.setRow, { borderTopColor: t.border }]}>
        <Text style={[s.setLabel, { color: t.textSub, flex: 1.2 }]}>{exerciseName}</Text>
        {hasMinutes && (
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <TextInput
              style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              value={minutes}
              onChangeText={onMinutesChange}
              placeholder="min"
              placeholderTextColor={t.textHint}
              keyboardType="decimal-pad"
            />
          </View>
        )}
        {hasSteps && (
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <TextInput
              style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              value={steps}
              onChangeText={onStepsChange}
              placeholder="steps"
              placeholderTextColor={t.textHint}
              keyboardType="number-pad"
            />
          </View>
        )}
        {hasKm && (
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <TextInput
              style={[s.numInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              value={km}
              onChangeText={onKmChange}
              placeholder="km"
              placeholderTextColor={t.textHint}
              keyboardType="decimal-pad"
            />
          </View>
        )}
      </View>
      {hasSteps && cardioEntry?.stepGoal && (
        <View style={[s.totalRow, { borderTopColor: t.border }]}>
          <Text style={[s.totalLabel, { color: t.textSub }]}>Step goal</Text>
          <Text style={[s.totalVal, { color: parseInt(steps) >= cardioEntry.stepGoal ? t.success : t.text }]}>
            {steps || '0'} / {cardioEntry.stepGoal.toLocaleString()}
          </Text>
        </View>
      )}
      {hasKm && !hasSteps && (
        <View style={[s.totalRow, { borderTopColor: t.border }]}>
          <Text style={[s.totalLabel, { color: t.textSub }]}>Distance</Text>
          <Text style={[s.totalVal, { color: t.text }]}>{km || '0'} km</Text>
        </View>
      )}
      {metric === 'minutes' && (
        <View style={[s.totalRow, { borderTopColor: t.border }]}>
          <Text style={[s.totalLabel, { color: t.textSub }]}>Duration</Text>
          <Text style={[s.totalVal, { color: t.text }]}>{minutes || '0'} min</Text>
        </View>
      )}
    </>
  );
}
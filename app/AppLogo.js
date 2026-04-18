import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AppLogo({ theme, compact = false }) {
  return (
    <View style={s.wrap}>
      <View style={[s.badge, { backgroundColor: theme.accent + '22', borderColor: theme.accent + '66' }]}>
        <Ionicons name="barbell-outline" size={compact ? 13 : 15} color={theme.accent} />
      </View>
      {!compact && <Text style={[s.wordmark, { color: theme.text }]}>Workout Tracker</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
});

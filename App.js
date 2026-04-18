import React from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import TodayScreen from './app/TodayScreen';
import ProgressScreen from './app/ProgressScreen';
import HistoryScreen from './app/HistoryScreen';
import { ThemeContext, lightTheme, darkTheme } from './app/theme';

const Tab = createBottomTabNavigator();

export default function App() {
  const scheme = useColorScheme();
  const t = scheme === 'dark' ? darkTheme : lightTheme;

  const navTheme = scheme === 'dark'
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: t.bg, card: t.surface, border: t.border } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: t.bg, card: t.surface, border: t.border } };

  return (
    <ThemeContext.Provider value={t}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarStyle: {
              backgroundColor: t.tabBg,
              borderTopColor: t.border,
              borderTopWidth: 0,
              height: 62,
              paddingBottom: 8,
              paddingTop: 8,
              elevation: 0,
              shadowColor: '#000',
              shadowOpacity: scheme === 'dark' ? 0.35 : 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: -2 },
            },
            tabBarActiveTintColor: t.accent,
            tabBarInactiveTintColor: t.textHint,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
            tabBarItemStyle: { paddingVertical: 2 },
            tabBarIcon: ({ color, size }) => {
              if (route.name === 'Today') return <Ionicons name="calendar-outline" color={color} size={size} />;
              if (route.name === 'Progress') return <Ionicons name="stats-chart-outline" color={color} size={size} />;
              if (route.name === 'History') return <Ionicons name="time-outline" color={color} size={size} />;
            },
          })}
        >
          <Tab.Screen name="Today" component={TodayScreen} />
          <Tab.Screen name="Progress" component={ProgressScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </ThemeContext.Provider>
  );
}

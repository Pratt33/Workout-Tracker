import { createContext, useContext } from 'react';

// Central design tokens: brand/status colors, chart palette, scrims.
// Every theme object carries semantic color keys only — no bare literals in screens.
export const CHART_COLORS = {
  Chest: '#7B72E8',
  Triceps: '#E8724A',
  Back: '#2DBF8E',
  Biceps: '#4A9FE8',
  Shoulders: '#E8B84A',
  Legs: '#7ABF3A',
  'Abs, Wrist & Forearms': '#9A9A9A',
  Weight: '#A78BFA',
  Cardio: '#F35D8A',
};

// Theme-independent design scale (spacing, radius, touch targets, type).
export const design = {
  radius: { small: 8, medium: 12, large: 14, xl: 20, pill: 999 },
  space: { xxs: 4, xs: 8, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 },
  controlMin: 48,
  controlMinCompact: 40,
  touchSlop: 10,
  // Typography scale (weight: size / line-height).
  type: {
    display: { size: 20, weight: '700' },
    heading: { size: 18, weight: '600' },
    subheading: { size: 15, weight: '600' },
    body: { size: 13, weight: '400' },
    caption: { size: 12, weight: '500' },
    overline: { size: 10, weight: '600' },
  },
};

export const lightTheme = {
  dark: false,
  bg: '#f5f5f2',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  border: '#e8e8e8',
  borderStrong: '#d0d0d0',
  text: '#1a1a1a',
  textSub: '#666666',
  textHint: '#aaaaaa',
  tabBg: '#ffffff',
  inputBg: '#f5f5f2',
  accent: '#534AB7',
  accentText: '#ffffff',
  primary: '#534AB7',
  secondary: '#7B72E8',
  success: '#1D9E75',
  warning: '#B45309',
  danger: '#993C1D',
  destructiveColor: '#993C1D',
  disabled: '#d4d0d0',
  disabledText: '#9c9898',
  scrim: 'rgba(0,0,0,0.5)',
  scrimStrong: 'rgba(0,0,0,0.6)',
  cardShadow: 'rgba(0,0,0,0.04)',
  overlay: 'rgba(0,0,0,0.12)',
  focusRing: 'rgba(83,74,183,0.35)',
  chart: CHART_COLORS,
  chartCardio: '#F35D8A',
  chartWeight: '#A78BFA',
};

export const darkTheme = {
  dark: true,
  bg: '#0f0f0f',
  surface: '#1a1a1a',
  surfaceElevated: '#222222',
  border: '#2a2a2a',
  borderStrong: '#3a3a3a',
  text: '#f0f0f0',
  textSub: '#999999',
  textHint: '#555555',
  tabBg: '#151515',
  inputBg: '#252525',
  accent: '#7B72E8',
  accentText: '#ffffff',
  primary: '#7B72E8',
  secondary: '#9C92F0',
  success: '#2DBF8E',
  warning: '#FBBF24',
  danger: '#E0714A',
  destructiveColor: '#E0714A',
  disabled: '#2f2f2f',
  disabledText: '#6a6a6a',
  scrim: 'rgba(0,0,0,0.6)',
  scrimStrong: 'rgba(0,0,0,0.7)',
  cardShadow: 'rgba(0,0,0,0.3)',
  overlay: 'rgba(255,255,255,0.08)',
  focusRing: 'rgba(123,114,232,0.45)',
  chart: CHART_COLORS,
  chartCardio: '#F35D8A',
  chartWeight: '#A78BFA',
};

export const ThemeContext = createContext(darkTheme);
export const useTheme = () => useContext(ThemeContext);
import { createContext, useContext } from 'react';

export const lightTheme = {
  dark: false,
  bg: '#f5f5f2',
  surface: '#ffffff',
  border: '#e8e8e8',
  borderStrong: '#d0d0d0',
  text: '#1a1a1a',
  textSub: '#666666',
  textHint: '#aaaaaa',
  tabBg: '#ffffff',
  inputBg: '#f5f5f2',
  accent: '#534AB7',
  accentText: '#ffffff',
  deadColor: '#993C1D',
  success: '#1D9E75',
  cardShadow: 'rgba(0,0,0,0.04)',
};

export const darkTheme = {
  dark: true,
  bg: '#0f0f0f',
  surface: '#1a1a1a',
  border: '#2a2a2a',
  borderStrong: '#3a3a3a',
  text: '#f0f0f0',
  textSub: '#999999',
  textHint: '#555555',
  tabBg: '#151515',
  inputBg: '#252525',
  accent: '#7B72E8',
  accentText: '#ffffff',
  deadColor: '#E0714A',
  success: '#2DBF8E',
  cardShadow: 'rgba(0,0,0,0.3)',
};

export const ThemeContext = createContext(darkTheme);
export const useTheme = () => useContext(ThemeContext);

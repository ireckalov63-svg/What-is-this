/**
 * Тёмная тема студии: чёрный фон, белый текст, акцент #4690FF.
 * Собран через defineTheme поверх neutralTheme (Astryx).
 */
import { defineTheme } from '@astryxdesign/core';
import { neutralTheme } from '@astryxdesign/theme-neutral';

export const ACCENT = '#4690FF';

export const darkflowTheme = defineTheme({
  name: 'darkflow',
  extends: neutralTheme,
  color: { accent: ['#1F6FE0', ACCENT], neutralStyle: 'cool' },
  tokens: {
    // Чёрный фон, белый текст — как в брифе
    '--color-background-body': ['#f2f4f7', '#050506'],
    '--color-background-surface': ['#ffffff', '#0d0e11'],
    '--color-background-card': ['#ffffff', '#111318'],
    '--color-background-popover': ['#ffffff', '#17191f'],
    '--color-text-primary': ['#0a0b0d', '#ffffff'],
    '--color-text-secondary': ['#4e606f', '#b6bcc6'],
    '--color-icon-primary': ['#0a0b0d', '#ffffff'],
    '--radius-container': '16px',
    '--radius-page': '20px',
  },
});

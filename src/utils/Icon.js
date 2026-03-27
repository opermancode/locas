/**
 * Icon — cross-platform icon component
 * Uses inline SVG on web/Electron (no font loading needed)
 * Uses Feather from @expo/vector-icons on native (fonts work fine)
 */
import React from 'react';
import { Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

const SVG_PATHS = {
  // Navigation
  home:            'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z||M9 22V12h6v10',
  'file-text':     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z||M14 2v6h6||M16 13H8||M16 17H8||M10 9H8',
  'file-plus':     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z||M14 2v6h6||M12 18v-6||M9 15h6',
  users:           'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2||M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z||M23 21v-2a4 4 0 0 0-3-3.87||M16 3.13a4 4 0 0 1 0 7.75',
  package:         'M21 10V6a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 1 6v12a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 23 18v-4||M3.27 6.96L12 12.01l8.73-5.05||M12 22.08V12',
  'credit-card':   'M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z||M1 10h22',
  'bar-chart-2':   'M18 20V10||M12 20V4||M6 20v-6',
  settings:        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z||M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  // Actions
  plus:            'M12 5v14||M5 12h14',
  x:               'M18 6L6 18||M6 6l12 12',
  check:           'M20 6L9 17l-5-5',
  'check-circle':  'M22 11.08V12a10 10 0 1 1-5.93-9.14||M22 4L12 14.01l-3-3',
  'alert-circle':  'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z||M12 8v4||M12 16h.01',
  search:          'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z||M21 21l-4.35-4.35',
  'arrow-left':    'M19 12H5||M12 19l-7-7 7-7',
  'arrow-right':   'M5 12h14||M12 5l7 7-7 7',
  'arrow-up-right':'M7 17L17 7||M7 7h10v10',
  'arrow-down-left':'M17 7L7 17||M17 17H7V7',
  'edit-2':        'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  'trash-2':       'M3 6h18||M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2||M10 11v6||M14 11v6',
  download:        'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4||M7 10l5 5 5-5||M12 15V3',
  printer:         'M6 9V2h12v7||M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2||M6 14h12v8H6z',
  'message-circle':'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  'dollar-sign':   'M12 1v22||M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  upload:          'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4||M17 8l-5-5-5 5||M12 3v12',
  link:            'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71||M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  'log-out':       'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4||M16 17l5-5-5-5||M21 12H9',
  'refresh-ccw':   'M1 4v6h6||M23 20v-6h-6||M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15',
  cloud:           'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  'map-pin':       'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z||M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  phone:           'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  user:            'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2||M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  // Misc
  percent:         'M19 5L5 19||M6.5 6.5h.01||M17.5 17.5h.01',
  smartphone:      'M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z||M12 18h.01',
  info:            'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z||M12 16v-4||M12 8h.01',
  'trending-up':   'M23 6l-9.5 9.5-5-5L1 18||M17 6h6v6',
  'trending-down': 'M23 18l-9.5-9.5-5 5L1 6||M17 18h6v-6',
  grid:            'M3 3h7v7H3z||M14 3h7v7h-7z||M14 14h7v7h-7z||M3 14h7v7H3z',
  menu:            'M3 12h18||M3 6h18||M3 18h18',
  'chevron-down':  'M6 9l6 6 6-6',
  'chevron-up':    'M18 15l-6-6-6 6',
  'chevron-left':  'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  // Expense categories
  'shopping-cart': 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z||M3 6h18||M16 10a4 4 0 0 1-8 0',
  tool:            'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  truck:           'M1 3h15v13H1z||M16 8h4l3 3v5h-7V8z||M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z||M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  radio:           'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z||M19 10v2a7 7 0 0 1-14 0v-2||M12 19v4||M8 23h8',
  shield:          'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  droplet:         'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z',
  coffee:          'M18 8h1a4 4 0 0 1 0 8h-1||M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z||M6 1v3||M10 1v3||M14 1v3',
  briefcase:       'M20 7H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z||M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  zap:             'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  paperclip:       'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
};

function SvgIcon({ name, size = 16, color = 'currentColor', strokeWidth = 1.5, style }) {
  const paths = (SVG_PATHS[name] || '').split('||').filter(Boolean);
  if (!paths.length) {
    // Fallback: show a simple circle so missing icons are visible not invisible
    return React.createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: color, strokeWidth: String(strokeWidth),
      style: { display: 'block', flexShrink: 0, ...(style || {}) },
    }, React.createElement('circle', { cx: '12', cy: '12', r: '8' }));
  }
  return React.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color,
    strokeWidth: String(strokeWidth),
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0, ...(style || {}) },
  }, ...paths.map((d, i) => React.createElement('path', { key: i, d })));
}

/**
 * Icon component — auto-selects SVG on web, Feather on native
 * Drop-in replacement for <Feather name="x" size={16} color="#fff" />
 */
export default function Icon({ name, size = 16, color = '#000', strokeWidth = 1.5, style }) {
  if (Platform.OS === 'web') {
    return <SvgIcon name={name} size={size} color={color} strokeWidth={strokeWidth} style={style} />;
  }
  return <Feather name={name} size={size} color={color} style={style} />;
}

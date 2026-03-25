export const COLORS = {
  // Brand
  primary:      '#FF6B00',
  primaryDark:  '#D45800',
  primaryLight: '#FFF0E6',
  primaryMid:   '#FFE4CC',

  // Surface
  secondary:    '#0F172A',   // rich slate-navy
  secondaryMid: '#1E293B',
  secondaryLight:'#334155',

  accent:       '#F97316',

  // Semantic
  success:      '#16A34A',
  successLight: '#DCFCE7',
  warning:      '#D97706',
  warningLight: '#FEF3C7',
  danger:       '#DC2626',
  dangerLight:  '#FEE2E2',
  info:         '#2563EB',
  infoLight:    '#DBEAFE',

  // Backgrounds
  bg:           '#F1F5F9',
  bgDeep:       '#E2E8F0',
  card:         '#FFFFFF',
  cardAlt:      '#F8FAFC',

  // Borders
  border:       '#E2E8F0',
  borderDark:   '#CBD5E1',

  // Text
  text:         '#0F172A',
  textSub:      '#475569',
  textMute:     '#94A3B8',
  white:        '#FFFFFF',

  // Gradients (used as start/end in LinearGradient or as layered bg)
  gradStart:    '#FF6B00',
  gradEnd:      '#E05A00',
};

export const FONTS = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  heavy:    '800',
  black:    '900',
};

export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
  xxl:  28,
  full: 999,
};

export const SHADOW = {
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  brand: {
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 8,
  },
};

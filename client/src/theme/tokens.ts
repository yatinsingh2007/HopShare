export type ColorTokens = {
  bg: string;
  ink: string;
  muted: string;
  card: string;
  line: string;
  field: string;
  /** Signal yellow: only for "go here" (sign bands, the primary button, the selected chip). */
  accent: string;
  accentInk: string;
  /** Text and icons that carry the accent's meaning on the plain ground (yellow itself fails contrast on white). */
  accentText: string;
  /** Pale yellow wash behind accent-tinted icons. */
  pill: string;
  /** Pictogram tiles: black squares with a white symbol, the same in both themes. */
  plate: string;
  plateInk: string;
  /** Coach-chart maroon: the route on the map and the one reversed plate a screen may have. */
  coach: string;
  coachInk: string;
  route: string;
  success: string;
  danger: string;
  dangerInk: string;
};

export const palettes: { light: ColorTokens; dark: ColorTokens } = {
  // Night: a near-black concourse; signs stay yellow with black type.
  dark: {
    bg: '#0F0F0E',
    ink: '#F4F4EF',
    muted: '#A6A69E',
    card: '#1A1A18',
    line: '#2C2C29',
    field: '#1A1A18',
    accent: '#FFCC00',
    accentInk: '#111111',
    accentText: '#FFCC00',
    pill: '#2E2600',
    plate: '#F4F4EF',
    plateInk: '#111111',
    coach: '#8E2B37',
    coachInk: '#FFFFFF',
    route: '#E0646E',
    success: '#66BB6A',
    danger: '#EF5350',
    dangerInk: '#111111',
  },
  // Day, outdoors in hard sun: white panels on a light grey concourse, black type.
  light: {
    bg: '#F2F2EE',
    ink: '#111111',
    muted: '#5B5B55',
    card: '#FFFFFF',
    line: '#DEDED8',
    field: '#FFFFFF',
    accent: '#FFCC00',
    accentInk: '#111111',
    accentText: '#755700',
    pill: '#FFF1B8',
    plate: '#111111',
    plateInk: '#FFFFFF',
    coach: '#7A1F2B',
    coachInk: '#FFFFFF',
    route: '#7A1F2B',
    success: '#2E7D32',
    danger: '#C62828',
    dangerInk: '#FFFFFF',
  },
};

export type ColorTokens = {
  bg: string;
  ink: string;
  muted: string;
  card: string;
  line: string;
  field: string;
  accent: string;
  accentInk: string;
  accentText: string;
  pill: string;
  danger: string;
  dangerInk: string;
};

export const palettes: { light: ColorTokens; dark: ColorTokens } = {
  dark: {
    bg: '#0f1412',
    ink: '#eef3ef',
    muted: '#a8b4ac',
    card: '#161d19',
    line: '#232c27',
    field: '#18201c',
    accent: '#c6f36b',
    accentInk: '#10140f',
    accentText: '#c6f36b',
    pill: '#22301f',
    danger: '#c4252b',
    dangerInk: '#ffffff',
  },
  light: {
    bg: '#f6f7f2',
    ink: '#121712',
    muted: '#56625a',
    card: '#ffffff',
    line: '#e3e7de',
    field: '#ffffff',
    accent: '#c6f36b',
    accentInk: '#10140f',
    accentText: '#3d6b00',
    pill: '#eaf6d2',
    danger: '#c4252b',
    dangerInk: '#ffffff',
  },
};

import { Text } from 'react-native';
import * as ReactNative from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { act, render, screen } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { palettes } from '../tokens';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

const colorScheme = jest.spyOn(ReactNative, 'useColorScheme');

let api: ReturnType<typeof useTheme>;
function Probe() {
  api = useTheme();
  return <Text testID="bg">{api.colors.bg}</Text>;
}

const renderTheme = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

test('preference "system" + system dark → dark background', async () => {
  colorScheme.mockReturnValue('dark');
  await renderTheme();
  expect(screen.getByTestId('bg')).toHaveTextContent('#0f1412');
});

test('system switching dark → light re-themes live without remounting', async () => {
  colorScheme.mockReturnValue('dark');
  const { rerender } = await renderTheme();
  colorScheme.mockReturnValue('light');
  await rerender(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByTestId('bg')).toHaveTextContent('#f6f7f2');
});

test('setPreference("dark") overrides a light system and is persisted', async () => {
  colorScheme.mockReturnValue('light');
  await renderTheme();
  await act(async () => api.setPreference('dark'));
  expect(api.scheme).toBe('dark');
  expect(screen.getByTestId('bg')).toHaveTextContent('#0f1412');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('unihop.themePreference', 'dark');
});

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('key token pairs meet WCAG AA (4.5:1)', () => {
  expect(contrast(palettes.light.accentText, palettes.light.bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palettes.dark.muted, palettes.dark.card)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palettes.light.muted, palettes.light.card)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palettes.dark.accentInk, palettes.dark.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palettes.dark.dangerInk, palettes.dark.danger)).toBeGreaterThanOrEqual(4.5);
});

import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme/ThemeProvider';

export const renderWithTheme = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

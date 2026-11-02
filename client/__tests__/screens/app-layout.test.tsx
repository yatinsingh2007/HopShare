import { fireEvent, screen } from '@testing-library/react-native';
import AppLayout from '../../src/app/(app)/_layout';
import { renderWithTheme } from '../../test-utils/renderWithTheme';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn() }));
jest.mock('expo-router', () => ({ Redirect: () => null, Stack: () => null, useSegments: () => [] }));
const mockSignOut = jest.fn();
jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, signOut: mockSignOut }),
}));
const mockMe = { me: null, loading: false, error: 'Unauthorized', errorStatus: 401, refresh: jest.fn() };
jest.mock('../../src/context/MeContext', () => ({
  MeProvider: ({ children }: { children: React.ReactNode }) => children,
  useMeContext: () => mockMe,
}));

test('when loading the profile fails, the user can sign out instead of being stuck', async () => {
  await renderWithTheme(<AppLayout />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(mockSignOut).toHaveBeenCalled();
});

test('a 401 is shown as a friendly message, not the raw server text', async () => {
  await renderWithTheme(<AppLayout />);
  expect(screen.getByText('Your session expired. Please sign in again.')).toBeOnTheScreen();
  expect(screen.queryByText('Unauthorized')).toBeNull();
});

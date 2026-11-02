import { fireEvent, screen } from '@testing-library/react-native';
import Welcome from '../../src/app/(auth)/welcome';
import { renderWithTheme } from '../../test-utils/renderWithTheme';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn() }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

test('shows all three slides and both entry buttons', async () => {
  await renderWithTheme(<Welcome />);
  expect(screen.getByText(/Same road\./)).toBeOnTheScreen();
  expect(screen.getByText(/Verified people\./)).toBeOnTheScreen();
  expect(screen.getByText(/You book the cab\./)).toBeOnTheScreen();
  expect(screen.getByText('One person books, everyone pays them back over UPI.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Get started' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'I have an account' })).toBeOnTheScreen();
});

test('"Get started" opens sign-in in sign-up mode', async () => {
  await renderWithTheme(<Welcome />);
  await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/sign-in', params: { mode: 'signup' } });
});

import { act, fireEvent, screen } from '@testing-library/react-native';
import ProfileSetup from '../../src/app/(app)/profile-setup';
import { ApiError } from '../../src/services/api';
import { renderWithTheme } from '../../test-utils/renderWithTheme';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn() }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
const mockUpdate = jest.fn();
jest.mock('../../src/context/MeContext', () => ({
  useMeContext: () => ({ me: { firstName: null, upiId: null }, update: mockUpdate }),
}));

beforeEach(() => jest.clearAllMocks());

const fill = async (name: string, upi: string) => {
  await renderWithTheme(<ProfileSetup />);
  await fireEvent.changeText(screen.getByLabelText('First name'), name);
  await fireEvent.changeText(screen.getByLabelText('Your UPI ID'), upi);
};

test('Continue is disabled until both fields are filled', async () => {
  await fill('Riya', '');
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Your UPI ID'), 'riya@okaxis');
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
});

test('submits the name and UPI ID, then goes home', async () => {
  mockUpdate.mockResolvedValue(undefined);
  await fill('Riya', 'riya@okaxis');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
  expect(mockUpdate).toHaveBeenCalledWith({ firstName: 'Riya', upiId: 'riya@okaxis' });
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('shows a UPI error from the server under the UPI field', async () => {
  mockUpdate.mockRejectedValue(new ApiError(400, 'Enter a valid UPI ID, like name@bank'));
  await fill('Riya', 'riya');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
  expect(screen.getByText('Enter a valid UPI ID, like name@bank')).toBeOnTheScreen();
  expect(mockReplace).not.toHaveBeenCalled();
});

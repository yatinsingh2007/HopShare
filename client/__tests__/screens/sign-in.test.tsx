import { act, fireEvent, screen } from '@testing-library/react-native';
import SignIn from '../../src/app/(auth)/sign-in';
import { renderWithTheme } from '../../test-utils/renderWithTheme';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const mockSignIn = {
  phoneCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
  finalize: jest.fn(async () => ({ error: null })),
};
const mockSignUp = {
  create: jest.fn(async () => ({ error: null })),
  verifications: { sendPhoneCode: jest.fn(async () => ({ error: null })), verifyPhoneCode: jest.fn() },
  finalize: jest.fn(async () => ({ error: null })),
};
jest.mock('@clerk/expo', () => ({
  useSignIn: () => ({ signIn: mockSignIn, errors: {}, fetchStatus: 'idle' }),
  useSignUp: () => ({ signUp: mockSignUp, errors: {}, fetchStatus: 'idle' }),
  useSSO: () => ({ startSSOFlow: jest.fn() }),
}));

beforeEach(() => jest.clearAllMocks());

const enterNumber = async (digits: string) => {
  await renderWithTheme(<SignIn />);
  await fireEvent.changeText(screen.getByLabelText('Phone number'), digits);
};

test('"Send code" is disabled until 10 digits are entered', async () => {
  await enterNumber('98765');
  expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
  expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled();
});

test('sends the code to the +91 number for sign-in', async () => {
  mockSignIn.phoneCode.sendCode.mockResolvedValue({ error: null });
  await enterNumber('9876543210');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send code' })));
  expect(mockSignIn.phoneCode.sendCode).toHaveBeenCalledWith({ phoneNumber: '+919876543210' });
  expect(screen.getByText('Enter the 6-digit code')).toBeOnTheScreen();
});

test('falls back to sign-up when the number has no account', async () => {
  mockSignIn.phoneCode.sendCode.mockResolvedValue({ error: { code: 'form_identifier_not_found' } });
  await enterNumber('9876543210');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send code' })));
  expect(mockSignUp.create).toHaveBeenCalledWith({ phoneNumber: '+919876543210' });
  expect(mockSignUp.verifications.sendPhoneCode).toHaveBeenCalled();
});

test('a wrong code shows a friendly error', async () => {
  mockSignIn.phoneCode.sendCode.mockResolvedValue({ error: null });
  mockSignIn.phoneCode.verifyCode.mockResolvedValue({ error: { code: 'form_code_incorrect' } });
  await enterNumber('9876543210');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send code' })));
  await fireEvent.changeText(screen.getByLabelText('6-digit code'), '111111');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Verify' })));
  expect(screen.getByText("That code didn't match. Try again.")).toBeOnTheScreen();
  expect(mockSignIn.finalize).not.toHaveBeenCalled();
});

test('a thrown network error while sending the code shows a friendly error', async () => {
  mockSignIn.phoneCode.sendCode.mockRejectedValue(new TypeError('Network request failed'));
  await enterNumber('9876543210');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send code' })));
  expect(screen.getByText('Something went wrong. Please try again.')).toBeOnTheScreen();
});

test('a failed finalize after a correct code shows a friendly error', async () => {
  mockSignIn.phoneCode.sendCode.mockResolvedValue({ error: null });
  mockSignIn.phoneCode.verifyCode.mockResolvedValue({ error: null });
  mockSignIn.finalize.mockResolvedValueOnce({ error: { code: 'session_exists' } } as never);
  await enterNumber('9876543210');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send code' })));
  await fireEvent.changeText(screen.getByLabelText('6-digit code'), '424242');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Verify' })));
  expect(screen.getByText('Something went wrong. Please try again.')).toBeOnTheScreen();
});

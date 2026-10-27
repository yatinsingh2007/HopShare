import { apiFetch, ApiError } from '../api';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;
process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => mockFetch.mockReset());

test('apiFetch returns json.data and sends the bearer token', async () => {
  mockFetch.mockReturnValue(jsonResponse(200, { success: true, data: { id: 'u1' } }));
  const data = await apiFetch<{ id: string }>('/api/me', { token: 'tok' });
  expect(data).toEqual({ id: 'u1' });
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe('http://api.test/api/me');
  expect(init.headers.Authorization).toBe('Bearer tok');
});

test('apiFetch throws ApiError with the server message on failure', async () => {
  mockFetch.mockReturnValue(
    jsonResponse(400, { success: false, message: 'Enter a valid UPI ID, like name@bank' }),
  );
  const err = (await apiFetch('/api/me', { token: 'tok', method: 'PATCH', body: { upiId: 'x' } }).catch((e) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(400);
  expect(err.message).toBe('Enter a valid UPI ID, like name@bank');
});

test('apiFetch maps a network failure to a friendly ApiError(0)', async () => {
  mockFetch.mockRejectedValue(new TypeError('Network request failed'));
  const err = (await apiFetch('/api/me', { token: 'tok' }).catch((e) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(0);
  expect(err.message).toBe("Can't reach UniHop. Check your connection.");
});

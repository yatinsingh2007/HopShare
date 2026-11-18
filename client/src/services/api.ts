import Constants from 'expo-constants';

// While developing, the server runs on the same computer as Metro, so reuse Metro's address.
// That way a phone on any Wi-Fi finds it without setting the Mac's IP by hand.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_URL = process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:4000` : '');

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ApiOptions = {
  token: string | null;
  method?: string;
  body?: unknown;
};

export async function apiFetch<T>(path: string, { token, method = 'GET', body }: ApiOptions): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach HopShare. Check your connection.");
  }

  const json = await res.json().catch(() => null);
  if (!json?.success) {
    throw new ApiError(res.status, json?.message ?? 'Something went wrong. Please try again.');
  }
  return json.data as T;
}

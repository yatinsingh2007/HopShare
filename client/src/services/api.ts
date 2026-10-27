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
    res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach UniHop. Check your connection.");
  }

  const json = await res.json().catch(() => null);
  if (!json?.success) {
    throw new ApiError(res.status, json?.message ?? 'Something went wrong. Please try again.');
  }
  return json.data as T;
}

const API_BASE =
  import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api';

export function getToken() {
  return localStorage.getItem('access_token');
}

export function setToken(token: string) {
  localStorage.setItem('access_token', token);
}

export function clearToken() {
  localStorage.removeItem('access_token');
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// apps/web/src/lib/api.ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (init?.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const raw = await res.text().catch(() => '');

  const tryParseJson = () => {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (!(trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed === 'null')) {
      return undefined;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  };

  const maybeJson = tryParseJson();

  if (!res.ok) {
    const detail =
      maybeJson !== undefined ? JSON.stringify(maybeJson) : raw;

    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${detail}`);
  }

  if (res.status === 204) return undefined as T;

  if (!raw) return undefined as T;

  if (maybeJson !== undefined) return maybeJson as T;

  return raw as unknown as T;
}


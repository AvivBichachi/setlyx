// apps/web/src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';


type Program = { id: number; name: string; type: string; isActive?: boolean };

export default function HomePage() {
  const [userId, setUserId] = useState('1');
  const [token, setTok] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  const router = useRouter();


  useEffect(() => {
    const t = getToken();
    setTok(t);
    if (t) router.replace('/home');
  }, []);


  async function devLogin() {
    setError(null);
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({ userId: Number(userId) }),
      });

      setToken(res.accessToken);
      setTok(res.accessToken);

      router.push('/home');

    } catch (e: any) {
      setError(e?.message ?? 'Login failed');
    }
  }

  async function loadPrograms() {
    if (!token) return;
    setError(null);
    setLoadingPrograms(true);
    try {
      const data = await apiFetch<Program[]>('/programs', { token });
      setPrograms(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load programs');
    } finally {
      setLoadingPrograms(false);
    }
  }

  function logout() {
    clearToken();
    setTok(null);
    setPrograms([]);
  }

  useEffect(() => {
    if (token) loadPrograms();
  }, [token]);

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-5xl font-extrabold tracking-tight">SETLYX — Dev UI</h1>

        {!token ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Dev Login</h2>

            <div className="flex gap-3 items-center">
              <input
                className="w-40 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-500"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="userId"
              />
              <button
                className="rounded-md bg-zinc-100 text-zinc-900 px-4 py-2 font-semibold hover:bg-white"
                onClick={devLogin}
              >
                Login
              </button>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </section>
        ) : (
          <section className="space-y-4">
            <button
              className="rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 hover:bg-zinc-700"
              onClick={logout}
            >
              Logout
            </button>

            <button
              className="rounded-md bg-zinc-100 text-zinc-900 px-4 py-2 font-semibold hover:bg-white"
              onClick={() => router.push('/programs')}
            >
              Go to Start/Resume
            </button>


            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Programs</h2>
              <button
                className="rounded-md bg-zinc-100 text-zinc-900 px-4 py-2 font-semibold hover:bg-white disabled:opacity-50"
                onClick={loadPrograms}
                disabled={loadingPrograms}
              >
                {loadingPrograms ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <ul className="space-y-2">
              {programs.map((p) => (
                <li key={p.id} className="rounded-md bg-zinc-800 border border-zinc-700 p-3">
                  <span className="font-semibold">#{p.id}</span> — {p.name} ({p.type})
                </li>
              ))}
              {programs.length === 0 && (
                <li className="text-zinc-400 text-sm">No programs found.</li>
              )}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

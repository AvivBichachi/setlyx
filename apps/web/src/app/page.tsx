// apps/web/src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { apiFetch } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth';

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  }

  async function loadPrograms() {
    if (!token) return;
    setError(null);
    setLoadingPrograms(true);
    try {
      const data = await apiFetch<Program[]>('/programs', { token });
      setPrograms(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load programs');
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
    <main className="min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-center text-4xl font-extrabold tracking-tight md:text-5xl">SETLYX</h1>

          {!token ? (
            <Card padding="lg" className="space-y-4">
              <SectionHeader title="Dev Login" />

              <div className="flex items-center gap-3">
                <input
                  className="w-40 rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/40"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="userId"
                />
                <PrimaryButton onClick={devLogin}>Login</PrimaryButton>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </Card>
          ) : (
            <Card padding="lg" className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <SecondaryButton onClick={logout}>Logout</SecondaryButton>
                <PrimaryButton onClick={() => router.push('/programs')}>Go to Start/Resume</PrimaryButton>
              </div>

              <SectionHeader
                title="Programs"
                action={
                  <SecondaryButton onClick={loadPrograms} disabled={loadingPrograms}>
                    {loadingPrograms ? 'Loading...' : 'Refresh'}
                  </SecondaryButton>
                }
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <ul className="space-y-2">
                {programs.map((p) => (
                  <li key={p.id} className="rounded-md border border-[var(--ui-border)] bg-zinc-900 p-3">
                    <span className="font-semibold">#{p.id}</span> - {p.name} ({p.type})
                  </li>
                ))}
                {programs.length === 0 && (
                  <li className="text-sm text-[var(--ui-text-secondary)]">No programs found.</li>
                )}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

type ActiveSession = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  programId: number;
  programDayId: number;
} | null;

export default function ProgramsStartResumePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveSession>(null);
  const [programDayId, setProgramDayId] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  async function loadActive() {
    setError(null);
    setLoading(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const data = await apiFetch<{ session: ActiveSession }>('/workouts/sessions/active', {
        token,
      });

      setActive(data.session);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load active session');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActive();
  }, []);

  async function onStart() {
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const session = await apiFetch<NonNullable<ActiveSession>>('/workouts/sessions/start', {
        method: 'POST',
        token,
        body: JSON.stringify({ programDayId }),
      });

      setActive(session);
      router.push(`/workouts/sessions/${session.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start session');
      await loadActive();
    }
  }

  function onResume() {
    if (!active?.id) return;
    router.push(`/workouts/sessions/${active.id}`);
  }

  return (
    <AppShell title="Programs - Start/Resume">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-4 rounded-md border border-zinc-700 bg-zinc-800 p-4">
          <div>
            <div className="mb-1 font-semibold">Active session</div>
            {active ? (
              <div className="text-sm text-zinc-200">
                <div>ID: {active.id}</div>
                <div>ProgramDay: {active.programDayId}</div>
                <div>Started: {new Date(active.startedAt).toLocaleString()}</div>
              </div>
            ) : (
              <div className="text-sm text-zinc-400">No active session</div>
            )}
          </div>

          {!active ? (
            <div className="flex items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-400">programDayId (temp)</span>
                <input
                  className="w-40 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
                  type="number"
                  min={1}
                  value={programDayId}
                  onChange={(e) => setProgramDayId(Number(e.target.value))}
                />
              </label>

              <button
                className="rounded-md bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 hover:bg-white"
                onClick={onStart}
              >
                Start workout
              </button>

              <button
                className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 hover:bg-zinc-700"
                onClick={loadActive}
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                className="rounded-md bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 hover:bg-white"
                onClick={onResume}
              >
                Resume workout
              </button>

              <button
                className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 hover:bg-zinc-700"
                onClick={loadActive}
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}


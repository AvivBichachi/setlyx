'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

type SessionDetails = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  program: { id: number; name: string; type: string };
  programDay: { id: number; name: string; order: number };
  exercises: Array<{
    dayExercise: {
      id: number;
      order: number;
      targetSets: number;
      minReps: number;
      maxReps: number;
      exercise: { id: number; name: string };
    };
    performedSets: Array<{ setNumber: number; reps: number; weight: number }>;
  }>;
};

export default function SessionPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);

  const [details, setDetails] = useState<SessionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [repsBy, setRepsBy] = useState<Record<number, number>>({});
  const [weightBy, setWeightBy] = useState<Record<number, number>>({});

  async function load() {
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');
      const d = await apiFetch<SessionDetails>(`/workouts/sessions/${sessionId}/details`, { token });
      setDetails(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load session details');
    }
  }

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function addSet(dayExerciseId: number, currentCount: number) {
    setError(null);
    const key = `add-${dayExerciseId}`;
    setBusyKey(key);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const reps = repsBy[dayExerciseId] ?? 8;
      const weight = weightBy[dayExerciseId] ?? 0;

      await apiFetch(`/workouts/sessions/${sessionId}/sets`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          dayExerciseId,
          setNumber: currentCount + 1,
          reps,
          weight,
        }),
      });

      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add set');
    } finally {
      setBusyKey(null);
    }
  }

  async function finish() {
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const finished = await apiFetch<{ id: number }>(`/workouts/sessions/${sessionId}/finish`, {
        method: 'POST',
        token,
      });

      router.push(`/workouts/sessions/${finished.id}/summary`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to finish session');
    }
  }

  return (
    <AppShell
      title={`Workout Session #${sessionId}`}
      actions={
        <>
          <button
            onClick={load}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 hover:bg-zinc-700"
          >
            Refresh
          </button>
          <button
            onClick={finish}
            className="rounded-md bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 hover:bg-white"
          >
            Finish
          </button>
        </>
      }
    >
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!details ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-zinc-700 bg-zinc-800 p-4">
            <div className="font-semibold">{details.program.name}</div>
            <div className="text-sm text-zinc-300">
              {details.programDay.name} (Day {details.programDay.order})
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Started: {new Date(details.startedAt).toLocaleString()}
              {details.endedAt ? ` | Ended: ${new Date(details.endedAt).toLocaleString()}` : ''}
            </div>
          </div>

          {details.exercises.map((block) => {
            const de = block.dayExercise;
            const performed = block.performedSets;
            const busy = busyKey === `add-${de.id}`;

            return (
              <div
                key={de.id}
                className="space-y-3 rounded-md border border-zinc-700 bg-zinc-800 p-4"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">
                    {de.order}. {de.exercise.name}
                  </div>
                  <div className="text-sm text-zinc-400">
                    Target: {de.targetSets} sets | {de.minReps}-{de.maxReps} reps
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  {performed.length === 0 ? (
                    <div className="text-zinc-400">No sets yet</div>
                  ) : (
                    performed.map((s) => (
                      <div key={`${de.id}-${s.setNumber}`} className="flex gap-3">
                        <span className="w-14 text-zinc-400">Set {s.setNumber}</span>
                        <span>{s.reps} reps</span>
                        <span className="text-zinc-400">x</span>
                        <span>{s.weight} kg</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-400">Reps</span>
                    <input
                      type="number"
                      min={1}
                      className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
                      value={repsBy[de.id] ?? 8}
                      onChange={(e) =>
                        setRepsBy((prev) => ({ ...prev, [de.id]: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-400">Weight (kg)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="w-32 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
                      value={weightBy[de.id] ?? 0}
                      onChange={(e) =>
                        setWeightBy((prev) => ({ ...prev, [de.id]: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <button
                    disabled={busy || details.endedAt !== null}
                    onClick={() => addSet(de.id, performed.length)}
                    className="rounded-md bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
                  >
                    {details.endedAt
                      ? 'Session finished'
                      : busy
                        ? 'Adding...'
                        : `Add set ${performed.length + 1}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}


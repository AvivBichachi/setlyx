'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

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
          <SecondaryButton onClick={load}>Refresh</SecondaryButton>
          <PrimaryButton onClick={finish}>Finish</PrimaryButton>
        </>
      }
    >
      {error && <Card className="border-red-500/40 bg-red-500/10 text-sm text-red-300">{error}</Card>}

      {!details ? (
        <Card className="text-sm text-[var(--ui-text-secondary)]">Loading...</Card>
      ) : (
        <div className="space-y-6">
          <Card padding="lg" className="space-y-4">
            <SectionHeader title={details.program.name} action={<Badge>{details.program.type}</Badge>} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard label="Program Day" value={`${details.programDay.name} (#${details.programDay.order})`} />
              <StatCard label="Status" value={details.endedAt ? 'Finished' : 'Active'} />
              <StatCard label="Exercises" value={details.exercises.length} />
            </div>
            <div className="text-xs text-[var(--ui-text-secondary)]">
              Started: {new Date(details.startedAt).toLocaleString()}
              {details.endedAt ? ` | Ended: ${new Date(details.endedAt).toLocaleString()}` : ''}
            </div>
          </Card>

          {details.exercises.map((block) => {
            const de = block.dayExercise;
            const performed = block.performedSets;
            const busy = busyKey === `add-${de.id}`;

            return (
              <Card key={de.id} className="space-y-4">
                <SectionHeader
                  title={`${de.order}. ${de.exercise.name}`}
                  subtitle={performed.length === 0 ? 'No sets yet' : `${performed.length} set${performed.length > 1 ? 's' : ''} completed`}
                  action={<Badge>{`Target ${de.targetSets} | ${de.minReps}-${de.maxReps} reps`}</Badge>}
                />

                <div className="space-y-1 rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] p-3 text-sm">
                  {performed.length === 0 ? (
                    <div className="text-[var(--ui-text-secondary)]">No sets yet</div>
                  ) : (
                    performed.map((s) => (
                      <div key={`${de.id}-${s.setNumber}`} className="flex gap-3">
                        <span className="w-14 text-[var(--ui-text-secondary)]">Set {s.setNumber}</span>
                        <span>{s.reps} reps</span>
                        <span className="text-[var(--ui-text-secondary)]">x</span>
                        <span>{s.weight} kg</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-[120px,160px,auto] md:items-end">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--ui-text-secondary)]">Reps</span>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] px-3 py-2 outline-none"
                      value={repsBy[de.id] ?? 8}
                      onChange={(e) =>
                        setRepsBy((prev) => ({ ...prev, [de.id]: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--ui-text-secondary)]">Weight (kg)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] px-3 py-2 outline-none"
                      value={weightBy[de.id] ?? 0}
                      onChange={(e) =>
                        setWeightBy((prev) => ({ ...prev, [de.id]: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <PrimaryButton
                    disabled={busy || details.endedAt !== null}
                    onClick={() => addSet(de.id, performed.length)}
                    className="w-full md:w-auto"
                  >
                    {details.endedAt
                      ? 'Session finished'
                      : busy
                        ? 'Adding...'
                        : `Add set ${performed.length + 1}`}
                  </PrimaryButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

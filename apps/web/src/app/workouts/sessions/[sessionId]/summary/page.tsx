'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

type TopSet = { weight: number; reps: number };
type ProgressState = 'IMPROVED' | 'REGRESSED' | 'SAME' | 'NO_BASELINE';

type SummaryExercise = {
  exerciseId: number;
  name: string;
  sets: number;
  repsTotal: number;
  volume: number;
  currentTopSet: TopSet | null;
  previousTopSet: TopSet | null;
  progress: ProgressState;
};

type Summary = {
  sessionId: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  totals: { totalSets: number; totalReps: number; totalVolume: number };
  exercises: SummaryExercise[];
};

function progressEmoji(p: ProgressState) {
  if (p === 'IMPROVED') return '🟢';
  if (p === 'SAME') return '🟡';
  if (p === 'REGRESSED') return '🔴';
  return '';
}

function formatTopSet(s: TopSet | null) {
  if (!s) return '—';
  return `${s.weight} × ${s.reps}`;
}

function formatDelta(curr: TopSet | null, prev: TopSet | null) {
  if (!curr || !prev) return '—';

  if (curr.weight !== prev.weight) {
    const diff = curr.weight - prev.weight;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}kg`;
  }

  if (curr.reps !== prev.reps) {
    const diff = curr.reps - prev.reps;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff} rep`;
  }

  return '=';
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SessionSummaryPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);

  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');
      const s = await apiFetch<Summary>(`/workouts/sessions/${sessionId}/summary`, { token });
      setData(s);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load summary');
    }
  }

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const sortedExercises = useMemo(() => {
    if (!data) return [];
    return [...data.exercises].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Summary — Session #{sessionId}</h1>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 hover:bg-zinc-700"
            >
              Refresh
            </button>
            <div className="flex gap-2">
              <Link href="/home" className="rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 hover:bg-zinc-700">
                Home
              </Link>
              <Link href="/programs" className="rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 hover:bg-zinc-700">
                Programs
              </Link>
            </div>

          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!data ? (
          <p>Loading…</p>
        ) : (
          <>
            {/* Totals card */}
            <div className="rounded-md bg-zinc-800 border border-zinc-700 p-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">Workout totals</div>
                <div className="text-sm text-zinc-300">
                  Duration: {formatDuration(data.durationSeconds)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md bg-zinc-900 border border-zinc-700 p-3">
                  <div className="text-zinc-400 text-xs">Sets</div>
                  <div className="text-lg font-semibold">{data.totals.totalSets}</div>
                </div>

                <div className="rounded-md bg-zinc-900 border border-zinc-700 p-3">
                  <div className="text-zinc-400 text-xs">Reps</div>
                  <div className="text-lg font-semibold">{data.totals.totalReps}</div>
                </div>

                <div className="rounded-md bg-zinc-900 border border-zinc-700 p-3">
                  <div className="text-zinc-400 text-xs">Volume</div>
                  <div className="text-lg font-semibold">{data.totals.totalVolume}</div>
                </div>
              </div>

              <div className="text-xs text-zinc-400">
                Started: {new Date(data.startedAt).toLocaleString()}
                {data.endedAt ? ` · Ended: ${new Date(data.endedAt).toLocaleString()}` : ''}
              </div>
            </div>

            {/* Exercises list */}
            <div className="rounded-md bg-zinc-800 border border-zinc-700 p-4">
              <div className="font-semibold mb-3">Exercise progress</div>

              <div className="space-y-3">
                {sortedExercises.map((ex) => (
                  <div
                    key={ex.exerciseId}
                    className="rounded-md bg-zinc-900 border border-zinc-700 p-3"
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold">
                        <span className="mr-2">{progressEmoji(ex.progress)}</span>
                        {ex.name}
                      </div>

                      <div className="text-sm text-zinc-400">
                        {ex.sets} sets · {ex.repsTotal} reps · vol {ex.volume}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-zinc-400 text-xs">Current top set</div>
                        <div className="font-semibold">{formatTopSet(ex.currentTopSet)}</div>
                      </div>

                      <div>
                        <div className="text-zinc-400 text-xs">Previous top set</div>
                        <div className="font-semibold">{formatTopSet(ex.previousTopSet)}</div>
                      </div>

                      <div>
                        <div className="text-zinc-400 text-xs">Delta</div>
                        <div className="font-semibold">
                          {ex.progress === 'NO_BASELINE'
                            ? '—'
                            : formatDelta(ex.currentTopSet, ex.previousTopSet)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {sortedExercises.length === 0 && (
                  <div className="text-zinc-400 text-sm">No performed sets in this session.</div>
                )}
              </div>

              <div className="mt-4 text-xs text-zinc-400">
                Legend: 🟢 improved · 🟡 same · 🔴 regressed
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

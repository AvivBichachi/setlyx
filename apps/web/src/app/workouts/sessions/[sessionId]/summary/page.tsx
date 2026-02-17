'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

type MuscleGroup = string;

type ProgressState = 'IMPROVED' | 'REGRESSED' | 'SAME' | 'NO_BASELINE';

type BestE1rmSet = {
  setId: number;
  weight: number;
  reps: number;
  e1rm: number;
} | null;

type MuscleTotalsRow = {
  muscle: MuscleGroup;

  currentTotalSets: number;
  currentTotalReps: number;
  currentTotalVolume: number;

  previousTotalSets: number | null;
  previousTotalReps: number | null;
  previousTotalVolume: number | null;

  volumeDelta: number | null;
  volumeDeltaPct: number | null;
  hypertrophyProgress: ProgressState;
};

type SummaryExercise = {
  exerciseId: number;
  name: string;
  primaryMuscle: MuscleGroup;

  sets: number;
  repsTotal: number;

  currentVolume: number;
  previousVolume: number | null;
  volumeDelta: number | null;
  volumeDeltaPct: number | null;
  hypertrophyProgress: ProgressState;

  currentBestE1rmSet: BestE1rmSet;
  previousBestE1rmSet: BestE1rmSet;
  strengthProgress: ProgressState;
};

type Summary = {
  sessionId: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  totals: { totalSets: number; totalReps: number; totalVolume: number };

  // hypertrophy/workload signal
  muscleTotals: MuscleTotalsRow[];

  // strength signal (per exercise)
  exercises: SummaryExercise[];
};

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function dot(p: ProgressState) {
  if (p === 'IMPROVED') return '🟢';
  if (p === 'SAME') return '🟡';
  if (p === 'REGRESSED') return '🔴';
  return '⚪';
}

function formatBestE1rmSet(s: BestE1rmSet) {
  if (!s) return '—';
  return `${s.weight} × ${s.reps} (e1RM ${s.e1rm})`;
}

function formatE1rmDelta(curr: BestE1rmSet, prev: BestE1rmSet) {
  if (!curr || !prev) return '—';
  const diff = curr.e1rm - prev.e1rm;
  if (Math.abs(diff) < 0.1) return '=';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}

function formatPct(pct: number | null) {
  if (pct === null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
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

  const sortedMuscles = useMemo(() => {
    if (!data) return [];
    return [...data.muscleTotals].sort((a, b) => a.muscle.localeCompare(b.muscle));
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
            <Link
              href="/home"
              className="rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 hover:bg-zinc-700"
            >
              Home
            </Link>
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
                  <div className="text-lg font-semibold">{Math.round(data.totals.totalVolume)}</div>
                </div>
              </div>

              <div className="text-xs text-zinc-400">
                Started: {new Date(data.startedAt).toLocaleString()}
                {data.endedAt ? ` · Ended: ${new Date(data.endedAt).toLocaleString()}` : ''}
              </div>
            </div>

            {/* Hypertrophy / workload */}
            <div className="rounded-md bg-zinc-800 border border-zinc-700 p-4">
              <div className="font-semibold mb-3">Muscle workload (hypertrophy signal)</div>

              <div className="grid grid-cols-2 gap-3">
                {sortedMuscles.map((m) => (
                  <div key={m.muscle} className="rounded-md bg-zinc-900 border border-zinc-700 p-3">
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold">
                        <span className="mr-2">{dot(m.hypertrophyProgress)}</span>
                        {m.muscle}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {m.currentTotalSets} sets · {m.currentTotalReps} reps
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-zinc-400 text-xs">Current volume</div>
                        <div className="font-semibold">{Math.round(m.currentTotalVolume)}</div>
                      </div>

                      <div>
                        <div className="text-zinc-400 text-xs">Previous volume</div>
                        <div className="font-semibold">
                          {m.previousTotalVolume === null ? '—' : Math.round(m.previousTotalVolume)}
                        </div>
                      </div>

                      <div>
                        <div className="text-zinc-400 text-xs">Δ volume</div>
                        <div className="font-semibold">
                          {m.volumeDelta === null ? '—' : `${m.volumeDelta > 0 ? '+' : ''}${Math.round(m.volumeDelta)} (${formatPct(m.volumeDeltaPct)})`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {sortedMuscles.length === 0 && (
                  <div className="text-zinc-400 text-sm">No muscle totals for this session.</div>
                )}
              </div>

              <div className="mt-3 text-xs text-zinc-400">
                Legend: 🟢 improved · 🟡 same · 🔴 regressed · ⚪ no baseline
              </div>
            </div>

            {/* Strength signal */}
            <div className="rounded-md bg-zinc-800 border border-zinc-700 p-4">
              <div className="font-semibold mb-3">Strength signal (e1RM)</div>

              <div className="space-y-3">
                {sortedExercises.map((ex) => (
                  <div key={ex.exerciseId} className="rounded-md bg-zinc-900 border border-zinc-700 p-3">
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold">
                        <span className="mr-2">{dot(ex.strengthProgress)}</span>
                        {ex.name} <span className="text-xs text-zinc-400">({ex.primaryMuscle})</span>
                      </div>

                      <div className="text-sm text-zinc-400">
                        {ex.sets} sets · {ex.repsTotal} reps · vol {Math.round(ex.currentVolume)}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-zinc-400 text-xs">Current best e1RM</div>
                        <div className="font-semibold">{formatBestE1rmSet(ex.currentBestE1rmSet)}</div>
                      </div>

                      <div>
                        <div className="text-zinc-400 text-xs">Previous best e1RM</div>
                        <div className="font-semibold">{formatBestE1rmSet(ex.previousBestE1rmSet)}</div>
                      </div>

                      <div>
                        <div className="text-zinc-400 text-xs">Δ e1RM</div>
                        <div className="font-semibold">{formatE1rmDelta(ex.currentBestE1rmSet, ex.previousBestE1rmSet)}</div>
                      </div>
                    </div>

                    {/* Optional: hypertrophy line per exercise */}
                    <div className="mt-2 text-xs text-zinc-400">
                      Hypertrophy: <span className="mr-1">{dot(ex.hypertrophyProgress)}</span>
                      Δ volume {ex.volumeDelta === null ? '—' : `${ex.volumeDelta > 0 ? '+' : ''}${Math.round(ex.volumeDelta)} (${formatPct(ex.volumeDeltaPct)})`}
                    </div>
                  </div>
                ))}

                {sortedExercises.length === 0 && (
                  <div className="text-zinc-400 text-sm">No performed sets in this session.</div>
                )}
              </div>

              <div className="mt-4 text-xs text-zinc-400">
                Legend: 🟢 improved · 🟡 same · 🔴 regressed · ⚪ no baseline
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

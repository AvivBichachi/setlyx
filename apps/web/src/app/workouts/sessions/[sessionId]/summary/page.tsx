'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from 'lucide-react';
import { SecondaryButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

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
  muscleTotals: MuscleTotalsRow[];
  exercises: SummaryExercise[];
};

type ProgressMeta = {
  Icon: LucideIcon;
  colorClass: string;
  label: string;
};

const PROGRESS_META: Record<ProgressState, ProgressMeta> = {
  IMPROVED: { Icon: ArrowUp, colorClass: 'text-emerald-400', label: 'improved' },
  SAME: { Icon: Minus, colorClass: 'text-yellow-400', label: 'same' },
  REGRESSED: { Icon: ArrowDown, colorClass: 'text-red-400', label: 'regressed' },
  NO_BASELINE: { Icon: Minus, colorClass: 'text-zinc-400', label: 'no baseline' },
};

function ProgressMark({ state }: { state: ProgressState }) {
  const { Icon, colorClass, label } = PROGRESS_META[state];

  return (
    <span className={`mr-2 inline-flex ${colorClass}`} aria-label={label} title={label}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function ProgressLegendItem({ state, text }: { state: ProgressState; text: string }) {
  return (
    <span className="inline-flex items-center">
      <ProgressMark state={state} />
      <span>{text}</span>
    </span>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatBestE1rmSet(s: BestE1rmSet) {
  if (!s) return '-';
  return `${s.weight} x ${s.reps} (e1RM ${s.e1rm})`;
}

function formatE1rmDelta(curr: BestE1rmSet, prev: BestE1rmSet) {
  if (!curr || !prev) return '-';
  const diff = curr.e1rm - prev.e1rm;
  if (Math.abs(diff) < 0.1) return '=';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}

function formatPct(pct: number | null) {
  if (pct === null || !Number.isFinite(pct)) return '-';
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load summary');
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
    <AppShell
      title={`Summary - Session #${sessionId}`}
      actions={
        <SecondaryButton onClick={load}>
          Refresh
        </SecondaryButton>
      }
    >
      {error && <Card className="border-red-500/40 bg-red-500/10 text-sm text-red-300">{error}</Card>}

      {!data ? (
        <Card className="text-sm text-[var(--ui-text-secondary)]">Loading...</Card>
      ) : (
        <>
          <Card className="space-y-3">
            <SectionHeader
              title="Workout totals"
              action={<div className="text-sm text-[var(--ui-text-secondary)]">Duration: {formatDuration(data.durationSeconds)}</div>}
            />

            <div className="grid grid-cols-3 gap-3 text-sm">
              <StatCard label="Sets" value={data.totals.totalSets} className="text-lg" />
              <StatCard label="Reps" value={data.totals.totalReps} className="text-lg" />
              <StatCard label="Volume" value={Math.round(data.totals.totalVolume)} className="text-lg" />
            </div>

            <div className="text-xs text-[var(--ui-text-secondary)]">
              Started: {new Date(data.startedAt).toLocaleString()}
              {data.endedAt ? ` | Ended: ${new Date(data.endedAt).toLocaleString()}` : ''}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Muscle workload (hypertrophy signal)" />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sortedMuscles.map((m) => (
                <div key={m.muscle} className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] p-3">
                  <div className="flex items-baseline justify-between">
                    <div className="font-semibold">
                      <ProgressMark state={m.hypertrophyProgress} />
                      {m.muscle}
                    </div>
                    <div className="text-xs text-[var(--ui-text-secondary)]">
                      {m.currentTotalSets} sets | {m.currentTotalReps} reps
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-[var(--ui-text-secondary)]">Current volume</div>
                      <div className="font-semibold">{Math.round(m.currentTotalVolume)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--ui-text-secondary)]">Previous volume</div>
                      <div className="font-semibold">
                        {m.previousTotalVolume === null ? '-' : Math.round(m.previousTotalVolume)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--ui-text-secondary)]">Delta volume</div>
                      <div className="font-semibold">
                        {m.volumeDelta === null
                          ? '-'
                          : `${m.volumeDelta > 0 ? '+' : ''}${Math.round(m.volumeDelta)} (${formatPct(m.volumeDeltaPct)})`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {sortedMuscles.length === 0 && (
                <div className="text-sm text-[var(--ui-text-secondary)]">No muscle totals for this session.</div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--ui-text-secondary)]">
              <span>Legend:</span>
              <ProgressLegendItem state="IMPROVED" text="improved" />
              <ProgressLegendItem state="SAME" text="same" />
              <ProgressLegendItem state="REGRESSED" text="regressed" />
              <ProgressLegendItem state="NO_BASELINE" text="no baseline" />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Strength signal (e1RM)" />

            <div className="space-y-3">
              {sortedExercises.map((ex) => (
                <div key={ex.exerciseId} className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] p-3">
                  <div className="flex items-baseline justify-between">
                    <div className="font-semibold">
                      <ProgressMark state={ex.strengthProgress} />
                      {ex.name} <span className="text-xs text-[var(--ui-text-secondary)]">({ex.primaryMuscle})</span>
                    </div>

                    <div className="text-sm text-[var(--ui-text-secondary)]">
                      {ex.sets} sets | {ex.repsTotal} reps | vol {Math.round(ex.currentVolume)}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                    <div>
                      <div className="text-xs text-[var(--ui-text-secondary)]">Current best e1RM</div>
                      <div className="font-semibold">{formatBestE1rmSet(ex.currentBestE1rmSet)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--ui-text-secondary)]">Previous best e1RM</div>
                      <div className="font-semibold">{formatBestE1rmSet(ex.previousBestE1rmSet)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--ui-text-secondary)]">Delta e1RM</div>
                      <div className="font-semibold">{formatE1rmDelta(ex.currentBestE1rmSet, ex.previousBestE1rmSet)}</div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-[var(--ui-text-secondary)]">
                    Hypertrophy: <ProgressMark state={ex.hypertrophyProgress} />
                    Delta volume{' '}
                    {ex.volumeDelta === null
                      ? '-'
                      : `${ex.volumeDelta > 0 ? '+' : ''}${Math.round(ex.volumeDelta)} (${formatPct(ex.volumeDeltaPct)})`}
                  </div>
                </div>
              ))}

              {sortedExercises.length === 0 && (
                <div className="text-sm text-[var(--ui-text-secondary)]">No performed sets in this session.</div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--ui-text-secondary)]">
              <span>Legend:</span>
              <ProgressLegendItem state="IMPROVED" text="improved" />
              <ProgressLegendItem state="SAME" text="same" />
              <ProgressLegendItem state="REGRESSED" text="regressed" />
              <ProgressLegendItem state="NO_BASELINE" text="no baseline" />
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}

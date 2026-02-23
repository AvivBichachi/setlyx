'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

type ProgressMetric = 'e1rm' | 'volume';

type ProgressDay = {
  id: number;
  name: string;
  order: number;
};

type ProgressProgram = {
  id: number;
  name: string;
  isActive: boolean;
  firstSessionAt: string | null;
  lastSessionAt: string | null;
  completedSessionsCount: number;
  days: ProgressDay[];
};

type ProgressContextResponse = {
  programs: ProgressProgram[];
};

type ProgressPoint = {
  sessionId: number;
  date: string;
  value: number | null;
  emaValue: number | null;
};

type ProgressSeriesResponse = {
  alpha: number;
  metric: ProgressMetric;
  points: ProgressPoint[];
};

type ChartPoint = {
  x: number;
  y: number;
};

const STORAGE_KEY = 'setlyx_progress_selection_v1';

function formatDate(iso: string | null): string {
  if (!iso) return 'No sessions yet';
  return new Date(iso).toLocaleDateString();
}

function formatProgramLabel(program: ProgressProgram): string {
  const first = program.firstSessionAt ? formatDate(program.firstSessionAt) : null;
  const last = program.lastSessionAt ? formatDate(program.lastSessionAt) : null;
  const range = !first
    ? 'No sessions yet'
    : `${first} - ${program.isActive ? 'Present' : last ?? first}`;
  return `${program.name} (${range})`;
}

function formatMetricValue(value: number | null, metric: ProgressMetric): string {
  if (value === null) return '-';
  return metric === 'volume' ? `${value.toFixed(1)}` : `${value.toFixed(1)} e1RM`;
}

function toChartPoints(
  values: Array<number | null>,
  width: number,
  height: number,
  padding: number,
): { points: ChartPoint[]; min: number; max: number } {
  const numeric = values.filter((v): v is number => v !== null);
  if (numeric.length === 0) return { points: [], min: 0, max: 0 };

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = values.map((value, index) => {
    if (value === null) return null;
    const x = padding + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
    const y = padding + innerHeight - ((value - min) / range) * innerHeight;
    return { x, y };
  }).filter((p): p is ChartPoint => p !== null);

  return { points, min, max };
}

function pointsToPolyline(points: ChartPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [programs, setPrograms] = useState<ProgressProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [selectedProgramDayId, setSelectedProgramDayId] = useState<number | null>(null);
  const [metric, setMetric] = useState<ProgressMetric>('e1rm');
  const [series, setSeries] = useState<ProgressSeriesResponse | null>(null);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    if (!selectedProgram) return;
    if (selectedProgramDayId !== null && selectedProgram.days.some((day) => day.id === selectedProgramDayId)) {
      return;
    }
    setSelectedProgramDayId(selectedProgram.days[0]?.id ?? null);
  }, [selectedProgram, selectedProgramDayId]);

  useEffect(() => {
    if (!selectedProgramId || !selectedProgramDayId) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ programId: selectedProgramId, programDayId: selectedProgramDayId, metric }),
      );
    }
    void loadSeries(selectedProgramId, selectedProgramDayId, metric);
  }, [selectedProgramId, selectedProgramDayId, metric]);

  async function loadContext() {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const context = await apiFetch<ProgressContextResponse>('/progress/context', { token });
      setPrograms(context.programs);

      if (context.programs.length === 0) {
        setSelectedProgramId(null);
        setSelectedProgramDayId(null);
        return;
      }

      const savedSelection = (() => {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as { programId?: number; programDayId?: number; metric?: ProgressMetric };
        } catch {
          return null;
        }
      })();

      const defaultProgram = context.programs.find((program) => program.isActive) ?? context.programs[0];
      const programFromStorage = savedSelection?.programId
        ? context.programs.find((program) => program.id === savedSelection.programId)
        : null;
      const nextProgram = programFromStorage ?? defaultProgram;

      setSelectedProgramId(nextProgram.id);

      const savedDay = savedSelection?.programDayId
        ? nextProgram.days.find((day) => day.id === savedSelection.programDayId)
        : null;
      setSelectedProgramDayId(savedDay?.id ?? nextProgram.days[0]?.id ?? null);

      if (savedSelection?.metric === 'e1rm' || savedSelection?.metric === 'volume') {
        setMetric(savedSelection.metric);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load progress context');
    } finally {
      setLoading(false);
    }
  }

  async function loadSeries(programId: number, programDayId: number, nextMetric: ProgressMetric) {
    setSeriesLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');
      const path = `/progress?programId=${programId}&programDayId=${programDayId}&metric=${nextMetric}`;
      const response = await apiFetch<ProgressSeriesResponse>(path, { token });
      setSeries(response);
    } catch (e: unknown) {
      setSeries(null);
      setError(e instanceof Error ? e.message : 'Failed to load progress series');
    } finally {
      setSeriesLoading(false);
    }
  }

  const chart = useMemo(() => {
    const width = 860;
    const height = 320;
    const padding = 26;
    const values = series?.points.map((p) => p.value ?? null) ?? [];
    const emaValues = series?.points.map((p) => p.emaValue ?? null) ?? [];
    const raw = toChartPoints(values, width, height, padding);
    const ema = toChartPoints(emaValues, width, height, padding);
    const min = Math.min(raw.min, ema.min);
    const max = Math.max(raw.max, ema.max);
    return { width, height, padding, raw, ema, min, max };
  }, [series]);

  return (
    <AppShell title="Progress">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-md border border-zinc-700 bg-zinc-800 p-5 text-zinc-300">
          Loading progress...
        </div>
      ) : programs.length === 0 ? (
        <div className="rounded-md border border-zinc-700 bg-zinc-800 p-5 text-zinc-300">
          No progress data yet. Complete a workout session to start tracking trends.
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-md border border-zinc-700 bg-zinc-800 p-4">
            <div className="mb-2 text-sm text-zinc-400">Program</div>
            <select
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
              value={selectedProgramId ?? ''}
              onChange={(e) => setSelectedProgramId(Number(e.target.value))}
            >
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {formatProgramLabel(program)}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-md border border-zinc-700 bg-zinc-800 p-4">
            <div className="mb-2 text-sm text-zinc-400">Program day</div>
            <div className="flex flex-wrap gap-2">
              {(selectedProgram?.days ?? []).map((day) => {
                const active = day.id === selectedProgramDayId;
                return (
                  <button
                    key={day.id}
                    className={
                      active
                        ? 'rounded-md border border-zinc-500 bg-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-100'
                        : 'rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700'
                    }
                    onClick={() => setSelectedProgramDayId(day.id)}
                  >
                    #{day.order} - {day.name}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-zinc-700 bg-zinc-800 p-4">
            <div className="mb-2 text-sm text-zinc-400">Metric</div>
            <div className="flex flex-wrap gap-2">
              <button
                className={
                  metric === 'e1rm'
                    ? 'rounded-md border border-zinc-500 bg-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-100'
                    : 'rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700'
                }
                onClick={() => setMetric('e1rm')}
              >
                Strength (best e1RM)
              </button>
              <button
                className={
                  metric === 'volume'
                    ? 'rounded-md border border-zinc-500 bg-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-100'
                    : 'rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700'
                }
                onClick={() => setMetric('volume')}
              >
                Workload (volume)
              </button>
            </div>
          </section>

          <section className="rounded-md border border-zinc-700 bg-zinc-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm text-zinc-400">
                {metric === 'e1rm' ? 'Best e1RM per completed session' : 'Total volume per completed session'}
              </div>
              <div className="text-xs text-zinc-500">
                EMA alpha: {series?.alpha ?? 0.25}
              </div>
            </div>

            {seriesLoading ? (
              <p className="text-sm text-zinc-400">Loading series...</p>
            ) : !series || series.points.length === 0 ? (
              <p className="text-sm text-zinc-400">No completed sessions for this program day yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    className="h-[320px] min-w-[720px] w-full rounded-md border border-zinc-700 bg-zinc-900"
                    role="img"
                    aria-label="Progress trend chart"
                  >
                    <rect x="0" y="0" width={chart.width} height={chart.height} fill="#0a0a0a" />
                    <line
                      x1={chart.padding}
                      y1={chart.height - chart.padding}
                      x2={chart.width - chart.padding}
                      y2={chart.height - chart.padding}
                      stroke="#3f3f46"
                      strokeWidth="1"
                    />
                    <line
                      x1={chart.padding}
                      y1={chart.padding}
                      x2={chart.padding}
                      y2={chart.height - chart.padding}
                      stroke="#3f3f46"
                      strokeWidth="1"
                    />

                    {chart.raw.points.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#a1a1aa"
                        strokeWidth="1.5"
                        points={pointsToPolyline(chart.raw.points)}
                      />
                    )}

                    {chart.ema.points.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                        points={pointsToPolyline(chart.ema.points)}
                      />
                    )}

                    {chart.raw.points.map((point, index) => (
                      <circle key={`raw-${index}`} cx={point.x} cy={point.y} r="2.6" fill="#d4d4d8" />
                    ))}
                  </svg>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{formatDate(series.points[0]?.date ?? null)}</span>
                  <span>{formatDate(series.points[series.points.length - 1]?.date ?? null)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300 md:grid-cols-4">
                  <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
                    <div className="text-xs text-zinc-500">Sessions</div>
                    <div className="text-base font-semibold">{series.points.length}</div>
                  </div>
                  <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
                    <div className="text-xs text-zinc-500">Latest raw</div>
                    <div className="text-base font-semibold">
                      {formatMetricValue(series.points[series.points.length - 1]?.value ?? null, metric)}
                    </div>
                  </div>
                  <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
                    <div className="text-xs text-zinc-500">Latest EMA</div>
                    <div className="text-base font-semibold">
                      {formatMetricValue(series.points[series.points.length - 1]?.emaValue ?? null, metric)}
                    </div>
                  </div>
                  <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
                    <div className="text-xs text-zinc-500">Range</div>
                    <div className="text-base font-semibold">
                      {chart.min.toFixed(1)} - {chart.max.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

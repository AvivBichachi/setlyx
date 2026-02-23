'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
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
  yPadding: number,
): { points: ChartPoint[]; min: number; max: number } {
  const numeric = values.filter((v): v is number => v !== null);
  if (numeric.length === 0) return { points: [], min: 0, max: 0 };

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;
  const innerHeight = height - yPadding * 2;

  const points = values.map((value, index) => {
    if (value === null) return null;
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = yPadding + innerHeight - ((value - min) / range) * innerHeight;
    return { x, y };
  }).filter((p): p is ChartPoint => p !== null);

  return { points, min, max };
}

function pointsToPolyline(points: ChartPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

function pointsToArea(points: ChartPoint[], baselineY: number): string {
  if (points.length === 0) return '';
  const topPath = pointsToPolyline(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${topPath} ${last.x},${baselineY} ${first.x},${baselineY}`;
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
    const yPadding = 14;
    const values = series?.points.map((p) => p.value ?? null) ?? [];
    const emaValues = series?.points.map((p) => p.emaValue ?? null) ?? [];
    const raw = toChartPoints(values, width, height, yPadding);
    const ema = toChartPoints(emaValues, width, height, yPadding);
    const min = Math.min(raw.min, ema.min);
    const max = Math.max(raw.max, ema.max);
    return { width, height, yPadding, raw, ema, min, max };
  }, [series]);

  useEffect(() => {
    setHoveredIndex(null);
  }, [series, metric, selectedProgramDayId, selectedProgramId]);

  const hoveredPoint = useMemo(() => {
    if (!series || hoveredIndex === null || hoveredIndex < 0 || hoveredIndex >= series.points.length) return null;
    const point = series.points[hoveredIndex];
    const x = series.points.length === 1 ? chart.width / 2 : (hoveredIndex / (series.points.length - 1)) * chart.width;
    return { point, x };
  }, [series, hoveredIndex, chart.width]);

  function onChartMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!series || series.points.length === 0) return;
    const svg = event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const x = Math.max(0, Math.min(chart.width, ratio * chart.width));
    const index = series.points.length === 1
      ? 0
      : Math.round((x / chart.width) * (series.points.length - 1));
    setHoveredIndex(index);
  }

  return (
    <AppShell title="Progress">
      {error && (
        <Card className="border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </Card>
      )}

      {loading ? (
        <Card padding="lg" className="text-[var(--ui-text-secondary)]">
          Loading progress...
        </Card>
      ) : programs.length === 0 ? (
        <Card padding="lg" className="text-[var(--ui-text-secondary)]">
          No progress data yet. Complete a workout session to start tracking trends.
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <SectionHeader
              title="Program"
              action={
                selectedProgram?.isActive ? <Badge variant="active">Active</Badge> : null
              }
            />
            <select
              className="w-full rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 text-[var(--ui-text-primary)] outline-none"
              value={selectedProgramId ?? ''}
              onChange={(e) => setSelectedProgramId(Number(e.target.value))}
            >
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {formatProgramLabel(program)}
                </option>
              ))}
            </select>
          </Card>

          <Card>
            <SectionHeader title="Program day" />
            <SegmentedControl
              ariaLabel="Program day"
              value={selectedProgramDayId ?? -1}
              options={(selectedProgram?.days ?? []).map((day) => ({
                value: day.id,
                label: `#${day.order} - ${day.name}`,
              }))}
              onChange={(value) => setSelectedProgramDayId(value)}
            />
          </Card>

          <Card>
            <SectionHeader title="Metric" />
            <SegmentedControl
              ariaLabel="Metric"
              value={metric}
              options={[
                { value: 'e1rm', label: 'Strength (best e1RM)' },
                { value: 'volume', label: 'Workload (volume)' },
              ]}
              onChange={(value) => setMetric(value)}
            />
          </Card>

          <Card>
            <SectionHeader
              title={metric === 'e1rm' ? 'Best e1RM per completed session' : 'Total volume per completed session'}
              action={<Badge>EMA alpha: {series?.alpha ?? 0.25}</Badge>}
            />

            {seriesLoading ? (
              <p className="text-sm text-[var(--ui-text-secondary)]">Loading series...</p>
            ) : !series || series.points.length === 0 ? (
              <p className="text-sm text-[var(--ui-text-secondary)]">No completed sessions for this program day yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    className="h-[320px] min-w-[720px] w-full rounded-lg border border-[var(--ui-border)] bg-gradient-to-b from-[var(--ui-card-2)] to-[var(--ui-card)]"
                    role="img"
                    aria-label="Progress trend chart"
                    onMouseMove={onChartMouseMove}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {Array.from({ length: 4 }).map((_, index) => {
                      const y = chart.yPadding + (index / 3) * (chart.height - chart.yPadding * 2);
                      return (
                        <line
                          key={`grid-${index}`}
                          x1={0}
                          y1={y}
                          x2={chart.width}
                          y2={y}
                          stroke="#a1a1aa1f"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {chart.raw.points.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#a1a1aa"
                        strokeWidth="2"
                        strokeOpacity="0.35"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pointsToPolyline(chart.raw.points)}
                      />
                    )}

                    {chart.ema.points.length > 1 && (
                      <>
                        <polygon
                          fill="rgba(45,212,191,0.08)"
                          points={pointsToArea(chart.ema.points, chart.height - chart.yPadding)}
                        />
                        <polyline
                          fill="none"
                          stroke="#2dd4bf"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={pointsToPolyline(chart.ema.points)}
                        />
                      </>
                    )}

                    {hoveredPoint && (
                      <>
                        <line
                          x1={hoveredPoint.x}
                          y1={0}
                          x2={hoveredPoint.x}
                          y2={chart.height}
                          stroke="#a1a1aa44"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                        <g>
                          <rect
                            x={Math.min(Math.max(hoveredPoint.x + 10, 8), chart.width - 212)}
                            y={10}
                            width={204}
                            height={72}
                            rx={8}
                            fill="var(--ui-card-2)"
                            stroke="var(--ui-border)"
                          />
                          <text
                            x={Math.min(Math.max(hoveredPoint.x + 20, 18), chart.width - 202)}
                            y={30}
                            fill="var(--ui-text-secondary)"
                            fontSize="11"
                          >
                            {formatDate(hoveredPoint.point.date)}
                          </text>
                          <text
                            x={Math.min(Math.max(hoveredPoint.x + 20, 18), chart.width - 202)}
                            y={50}
                            fill="var(--ui-text-primary)"
                            fontSize="12"
                          >
                            Raw: {formatMetricValue(hoveredPoint.point.value, metric)}
                          </text>
                          <text
                            x={Math.min(Math.max(hoveredPoint.x + 20, 18), chart.width - 202)}
                            y={68}
                            fill="var(--ui-text-primary)"
                            fontSize="12"
                          >
                            EMA: {formatMetricValue(hoveredPoint.point.emaValue, metric)}
                          </text>
                        </g>
                      </>
                    )}
                  </svg>
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--ui-text-secondary)]">
                  <span>{formatDate(series.points[0]?.date ?? null)}</span>
                  <span>{formatDate(series.points[series.points.length - 1]?.date ?? null)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard label="Sessions" value={series.points.length} />
                  <StatCard
                    label="Latest raw"
                    value={formatMetricValue(series.points[series.points.length - 1]?.value ?? null, metric)}
                  />
                  <StatCard
                    label="Latest EMA"
                    value={formatMetricValue(series.points[series.points.length - 1]?.emaValue ?? null, metric)}
                  />
                  <StatCard label="Range" value={`${chart.min.toFixed(1)} - ${chart.max.toFixed(1)}`} />
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}

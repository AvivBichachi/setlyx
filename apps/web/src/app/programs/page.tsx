'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';

type ActiveSession = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  programId: number;
  programDayId: number;
} | null;

type ProgramType = 'AB' | 'PPL' | 'FULL_BODY' | 'CUSTOM';

type ProgramDay = {
  id: number;
  name: string;
  order: number;
};

type ProgramApi = {
  id: number;
  name: string;
  type: ProgramType;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  days?: ProgramDay[];
};

type Program = ProgramApi & { days: ProgramDay[] };

type ProgramEditor = {
  name: string;
  type: ProgramType;
  isActive: boolean;
};

type ProgramDayEditor = {
  draftNameByDayId: Record<number, string>;
  newDayName: string;
};

type Exercise = {
  id: number;
  name: string;
  primaryMuscle: string;
};

type DayExercise = {
  id: number;
  programDayId: number;
  exerciseId: number;
  order: number;
  targetSets: number;
  minReps: number;
  maxReps: number;
};

type DayExerciseDraft = {
  targetSets: string;
  minReps: string;
  maxReps: string;
};

type NewDayExerciseDraft = {
  exerciseId: string;
  targetSets: string;
  minReps: string;
  maxReps: string;
};

type ParsedDayExerciseTargets = {
  targetSets: number;
  minReps: number;
  maxReps: number;
};

const PROGRAM_TYPES: ProgramType[] = ['AB', 'PPL', 'FULL_BODY', 'CUSTOM'];

function formatProgramType(type: ProgramType) {
  if (type === 'FULL_BODY') return 'Full Body';
  if (type === 'AB') return 'A/B';
  return type;
}

function normalizeProgram(program: ProgramApi): Program {
  return { ...program, days: [...(program.days ?? [])].sort((a, b) => a.order - b.order) };
}

export default function ProgramsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession>(null);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [selectedProgramDayId, setSelectedProgramDayId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<ProgramType>('CUSTOM');
  const [createIsActive, setCreateIsActive] = useState(false);

  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [editor, setEditor] = useState<ProgramEditor | null>(null);
  const [dayEditor, setDayEditor] = useState<ProgramDayEditor | null>(null);
  const [exerciseCatalog, setExerciseCatalog] = useState<Exercise[]>([]);
  const [editingProgramDayId, setEditingProgramDayId] = useState<number | null>(null);
  const [dayExercises, setDayExercises] = useState<DayExercise[]>([]);
  const [dayExerciseDrafts, setDayExerciseDrafts] = useState<Record<number, DayExerciseDraft>>({});
  const [dayExerciseCreateError, setDayExerciseCreateError] = useState<string | null>(null);
  const [dayExerciseSaveErrors, setDayExerciseSaveErrors] = useState<Record<number, string>>({});
  const [newDayExerciseDraft, setNewDayExerciseDraft] = useState<NewDayExerciseDraft>({
    exerciseId: '',
    targetSets: '3',
    minReps: '8',
    maxReps: '12',
  });

  const activeProgram = useMemo(() => programs.find((p) => p.isActive) ?? null, [programs]);
  const editingProgram = useMemo(
    () => (editingProgramId === null ? null : programs.find((p) => p.id === editingProgramId) ?? null),
    [editingProgramId, programs],
  );
  const exerciseNameById = useMemo(
    () => Object.fromEntries(exerciseCatalog.map((exercise) => [exercise.id, exercise.name])),
    [exerciseCatalog],
  );

  function parsePositiveIntField(
    value: string,
    label: string,
  ): { value: number | null; error: string | null } {
    const trimmed = value.trim();
    if (!trimmed) return { value: null, error: `${label} is required` };
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed))
      return { value: null, error: `${label} must be a whole number` };
    if (parsed <= 0)
      return { value: null, error: `${label} must be greater than 0` };
    return { value: parsed, error: null };
  }

  function validateRepRange(minReps: number, maxReps: number): boolean {
    return minReps <= maxReps;
  }

  function getReadableErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error) || !error.message) return fallback;
    const raw = error.message;
    const parts = raw.split('::');
    if (parts.length < 2) return raw;

    const jsonPart = parts[parts.length - 1]?.trim();
    if (!jsonPart) return raw;
    try {
      const parsed = JSON.parse(jsonPart) as
        | { message?: string | string[] }
        | undefined;
      const message = parsed?.message;
      if (Array.isArray(message)) return message[0] ?? raw;
      if (typeof message === 'string' && message.trim()) return message;
    } catch {
      return raw;
    }
    return raw;
  }

  function parseTargetInputs(
    draft: Pick<DayExerciseDraft, 'targetSets' | 'minReps' | 'maxReps'>,
  ): { values: ParsedDayExerciseTargets | null; error: string | null } {
    const targetSetsResult = parsePositiveIntField(draft.targetSets, 'Target sets');
    if (targetSetsResult.error) return { values: null, error: targetSetsResult.error };

    const minRepsResult = parsePositiveIntField(draft.minReps, 'Min reps');
    if (minRepsResult.error) return { values: null, error: minRepsResult.error };

    const maxRepsResult = parsePositiveIntField(draft.maxReps, 'Max reps');
    if (maxRepsResult.error) return { values: null, error: maxRepsResult.error };

    if (
      targetSetsResult.value === null ||
      minRepsResult.value === null ||
      maxRepsResult.value === null
    ) {
      return { values: null, error: 'Target fields must be valid' };
    }
    const values = {
      targetSets: targetSetsResult.value,
      minReps: minRepsResult.value,
      maxReps: maxRepsResult.value,
    };
    if (!validateRepRange(values.minReps, values.maxReps)) {
      return { values: null, error: 'Min reps must be less than or equal to max reps' };
    }
    return { values, error: null };
  }

  async function loadData() {
    setError(null);
    setLoading(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const [activeRes, programsRes, exercisesRes] = await Promise.all([
        apiFetch<{ session: ActiveSession }>('/workouts/sessions/active', { token }),
        apiFetch<ProgramApi[]>('/programs', { token }),
        apiFetch<Exercise[]>('/exercises', { token }),
      ]);

      const nextPrograms = programsRes.map(normalizeProgram);
      setActiveSession(activeRes.session);
      setPrograms(nextPrograms);
      setExerciseCatalog(exercisesRes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load programs page');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!activeProgram) {
      setSelectedProgramDayId(null);
      return;
    }

    setSelectedProgramDayId((prev) => {
      if (prev !== null && activeProgram.days.some((d) => d.id === prev)) {
        return prev;
      }
      return null;
    });
  }, [activeProgram]);

  useEffect(() => {
    if (!editingProgram) {
      setEditingProgramDayId(null);
      return;
    }

    setEditingProgramDayId((prev) => {
      if (prev !== null && editingProgram.days.some((day) => day.id === prev)) {
        return prev;
      }
      return editingProgram.days[0]?.id ?? null;
    });
  }, [editingProgram]);

  useEffect(() => {
    if (!editingProgram || editingProgramDayId === null) {
      setDayExercises([]);
      setDayExerciseDrafts({});
      setDayExerciseCreateError(null);
      setDayExerciseSaveErrors({});
      return;
    }

    setDayExerciseCreateError(null);
    setDayExerciseSaveErrors({});
    loadDayExercises(editingProgram.id, editingProgramDayId);
  }, [editingProgram, editingProgramDayId]);

  async function onStartWorkout() {
    if (selectedProgramDayId === null) {
      setError('Please choose a program day first.');
      return;
    }

    setError(null);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const session = await apiFetch<NonNullable<ActiveSession>>('/workouts/sessions/start', {
        method: 'POST',
        token,
        body: JSON.stringify({ programDayId: selectedProgramDayId }),
      });

      setActiveSession(session);
      router.push(`/workouts/sessions/${session.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start session');
      await loadData();
    }
  }

  function onResumeWorkout() {
    if (!activeSession?.id) return;
    router.push(`/workouts/sessions/${activeSession.id}`);
  }

  async function onCreateProgram() {
    const name = createName.trim();
    if (!name) {
      setError('Program name is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const createdRaw = await apiFetch<ProgramApi>('/programs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name,
          type: createType,
          isActive: createIsActive,
        }),
      });
      const created = normalizeProgram(createdRaw);

      setCreateName('');
      setCreateType('CUSTOM');
      setCreateIsActive(false);

      if (created.isActive) {
        setPrograms((prev) => [
          created,
          ...prev.filter((p) => p.id !== created.id).map((p) => ({ ...p, isActive: false })),
        ]);
      } else {
        setPrograms((prev) => [created, ...prev]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create program');
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(program: Program) {
    setEditingProgramId(program.id);
    setEditor({
      name: program.name,
      type: program.type,
      isActive: program.isActive,
    });
    setDayEditor({
      draftNameByDayId: Object.fromEntries(program.days.map((day) => [day.id, day.name])),
      newDayName: '',
    });
  }

  function cancelEdit() {
    setEditingProgramId(null);
    setEditor(null);
    setDayEditor(null);
    setEditingProgramDayId(null);
    setDayExercises([]);
    setDayExerciseDrafts({});
    setDayExerciseCreateError(null);
    setDayExerciseSaveErrors({});
    setNewDayExerciseDraft({
      exerciseId: '',
      targetSets: '3',
      minReps: '8',
      maxReps: '12',
    });
  }

  function setProgramDays(programId: number, days: ProgramDay[]) {
    const normalizedDays = [...days].sort((a, b) => a.order - b.order);
    setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, days: normalizedDays } : p)));
    setDayEditor((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        draftNameByDayId: Object.fromEntries(normalizedDays.map((day) => [day.id, day.name])),
      };
    });
  }

  async function loadDayExercises(programId: number, dayId: number) {
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const rows = await apiFetch<DayExercise[]>(`/programs/${programId}/days/${dayId}/exercises`, { token });
      const sorted = rows.slice().sort((a, b) => a.order - b.order);
      setDayExercises(sorted);
      setDayExerciseDrafts(
        Object.fromEntries(
          sorted.map((row) => [
            row.id,
            {
              targetSets: String(row.targetSets),
              minReps: String(row.minReps),
              maxReps: String(row.maxReps),
            },
          ]),
        ),
      );
    } catch (e: unknown) {
      setDayExercises([]);
      setDayExerciseDrafts({});
      setError(e instanceof Error ? e.message : 'Failed to load day exercises');
    }
  }

  async function createProgramDay(programId: number) {
    if (!dayEditor) return;
    const name = dayEditor.newDayName.trim();
    if (!name) {
      setError('Program day name is required');
      return;
    }

    const program = programs.find((p) => p.id === programId);
    if (!program) return;

    setError(null);
    setSaving(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const nextOrder = program.days.length + 1;
      const created = await apiFetch<ProgramDay>(`/programs/${programId}/days`, {
        method: 'POST',
        token,
        body: JSON.stringify({ name, order: nextOrder }),
      });

      setProgramDays(programId, [...program.days, created]);
      setDayEditor((prev) => (prev ? { ...prev, newDayName: '' } : prev));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create program day');
    } finally {
      setSaving(false);
    }
  }

  async function renameProgramDay(programId: number, dayId: number) {
    if (!dayEditor) return;
    const name = dayEditor.draftNameByDayId[dayId]?.trim();
    if (!name) {
      setError('Program day name is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const updated = await apiFetch<ProgramDay>(`/programs/${programId}/days/${dayId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ name }),
      });

      const program = programs.find((p) => p.id === programId);
      if (!program) return;
      setProgramDays(
        programId,
        program.days.map((day) => (day.id === dayId ? { ...day, name: updated.name } : day)),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to rename program day');
    } finally {
      setSaving(false);
    }
  }

  async function deleteProgramDay(programId: number, dayId: number) {
    setError(null);
    setSaving(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      await apiFetch<{ ok: true }>(`/programs/${programId}/days/${dayId}`, {
        method: 'DELETE',
        token,
      });

      const nextDays = await apiFetch<ProgramDay[]>(`/programs/${programId}/days`, { token });
      setProgramDays(programId, nextDays);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete program day');
    } finally {
      setSaving(false);
    }
  }

  async function moveProgramDay(programId: number, dayId: number, direction: -1 | 1) {
    const program = programs.find((p) => p.id === programId);
    if (!program) return;

    const sortedDays = [...program.days].sort((a, b) => a.order - b.order);
    const currentIndex = sortedDays.findIndex((day) => day.id === dayId);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= sortedDays.length) return;

    const reordered = [...sortedDays];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    const payload = reordered.map((day, index) => ({ id: day.id, order: index + 1 }));

    setError(null);
    setSaving(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const nextDays = await apiFetch<ProgramDay[]>(`/programs/${programId}/days/reorder`, {
        method: 'POST',
        token,
        body: JSON.stringify({ items: payload }),
      });
      setProgramDays(programId, nextDays);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reorder program days');
    } finally {
      setSaving(false);
    }
  }

  async function createDayExercise(programId: number) {
    if (editingProgramDayId === null) {
      setDayExerciseCreateError('Choose a program day first');
      return;
    }

    const exerciseIdResult = parsePositiveIntField(
      newDayExerciseDraft.exerciseId,
      'Exercise',
    );
    if (exerciseIdResult.error) {
      setDayExerciseCreateError(exerciseIdResult.error);
      return;
    }

    const targetInputResult = parseTargetInputs(newDayExerciseDraft);
    if (targetInputResult.error) {
      setDayExerciseCreateError(targetInputResult.error);
      return;
    }
    if (!targetInputResult.values) return;
    const { targetSets, minReps, maxReps } = targetInputResult.values;

    setDayExerciseCreateError(null);
    setError(null);
    setSaving(true);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      await apiFetch<DayExercise>(`/programs/${programId}/days/${editingProgramDayId}/exercises`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          exerciseId: exerciseIdResult.value,
          order: dayExercises.length + 1,
          targetSets,
          minReps,
          maxReps,
        }),
      });

      setNewDayExerciseDraft((prev) => ({ ...prev, exerciseId: '' }));
      setDayExerciseCreateError(null);
      await loadDayExercises(programId, editingProgramDayId);
    } catch (e: unknown) {
      const message = getReadableErrorMessage(e, 'Failed to add day exercise');
      setDayExerciseCreateError(message);
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDayExercise(programId: number, dayExerciseId: number) {
    if (editingProgramDayId === null) return;
    const draft = dayExerciseDrafts[dayExerciseId];
    if (!draft) return;

    const targetInputResult = parseTargetInputs(draft);
    if (targetInputResult.error) {
      setDayExerciseSaveErrors((prev) => ({
        ...prev,
        [dayExerciseId]: targetInputResult.error as string,
      }));
      return;
    }
    if (!targetInputResult.values) return;
    const { targetSets, minReps, maxReps } = targetInputResult.values;

    setDayExerciseSaveErrors((prev) => {
      const next = { ...prev };
      delete next[dayExerciseId];
      return next;
    });
    setError(null);
    setSaving(true);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const updated = await apiFetch<DayExercise>(
        `/programs/${programId}/days/${editingProgramDayId}/exercises/${dayExerciseId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({ targetSets, minReps, maxReps }),
        },
      );

      setDayExercises((prev) =>
        prev
          .map((row) =>
            row.id === dayExerciseId
              ? {
                  ...row,
                  targetSets: updated.targetSets,
                  minReps: updated.minReps,
                  maxReps: updated.maxReps,
                }
              : row,
          )
          .sort((a, b) => a.order - b.order),
      );
      setDayExerciseDrafts((prev) => ({
        ...prev,
        [dayExerciseId]: {
          targetSets: String(updated.targetSets),
          minReps: String(updated.minReps),
          maxReps: String(updated.maxReps),
        },
      }));
      setDayExerciseSaveErrors((prev) => {
        const next = { ...prev };
        delete next[dayExerciseId];
        return next;
      });
    } catch (e: unknown) {
      const message = getReadableErrorMessage(e, 'Failed to save day exercise');
      setDayExerciseSaveErrors((prev) => ({ ...prev, [dayExerciseId]: message }));
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDayExercise(programId: number, dayExerciseId: number) {
    if (editingProgramDayId === null) return;

    setError(null);
    setSaving(true);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      await apiFetch<{ ok: true }>(
        `/programs/${programId}/days/${editingProgramDayId}/exercises/${dayExerciseId}`,
        {
          method: 'DELETE',
          token,
        },
      );

      await loadDayExercises(programId, editingProgramDayId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete day exercise');
    } finally {
      setSaving(false);
    }
  }

  async function moveDayExercise(programId: number, dayExerciseId: number, direction: -1 | 1) {
    if (editingProgramDayId === null) return;
    const currentIndex = dayExercises.findIndex((row) => row.id === dayExerciseId);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= dayExercises.length) return;

    const reordered = [...dayExercises];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    const items = reordered.map((row, index) => ({ id: row.id, order: index + 1 }));

    setError(null);
    setSaving(true);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const nextRows = await apiFetch<DayExercise[]>(
        `/programs/${programId}/days/${editingProgramDayId}/exercises/reorder`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ items }),
        },
      );

      setDayExercises(nextRows.slice().sort((a, b) => a.order - b.order));
      setDayExerciseDrafts((prev) => {
        const nextDrafts: Record<number, DayExerciseDraft> = {};
        for (const row of nextRows) {
          nextDrafts[row.id] =
            prev[row.id] ?? {
              targetSets: String(row.targetSets),
              minReps: String(row.minReps),
              maxReps: String(row.maxReps),
            };
        }
        return nextDrafts;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reorder day exercises');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(programId: number) {
    if (!editor) return;
    const name = editor.name.trim();

    if (!name) {
      setError('Program name is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const updatedRaw = await apiFetch<ProgramApi>(`/programs/${programId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name,
          type: editor.type,
          isActive: editor.isActive,
        }),
      });
      const updated = normalizeProgram(updatedRaw);

      setPrograms((prev) => {
        const mapped = prev.map((p) =>
          p.id === programId
            ? { ...p, ...updated, days: updated.days.length > 0 ? updated.days : p.days }
            : p,
        );

        if (!updated.isActive) return mapped;
        return mapped.map((p) => (p.id === programId ? p : { ...p, isActive: false }));
      });

      cancelEdit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update program');
    } finally {
      setSaving(false);
    }
  }

  async function setProgramActive(programId: number) {
    setError(null);
    setSaving(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      await apiFetch<ProgramApi>(`/programs/${programId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: true }),
      });

      setPrograms((prev) => prev.map((p) => ({ ...p, isActive: p.id === programId })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to set active program');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Programs"
      actions={
        <SecondaryButton onClick={loadData} disabled={loading || saving}>
          Refresh
        </SecondaryButton>
      }
    >
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <Card padding="lg" className="space-y-3">
            <SectionHeader
              title="Workout entrypoint"
              action={
                activeProgram ? (
                  <Badge variant="active">Active program: {activeProgram.name}</Badge>
                ) : (
                  <Badge>No active program</Badge>
                )
              }
            />

            {activeSession ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-zinc-300">
                  Active session #{activeSession.id} started at {new Date(activeSession.startedAt).toLocaleString()}
                </div>
                <PrimaryButton onClick={onResumeWorkout}>
                  Resume workout
                </PrimaryButton>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm text-zinc-400">Program day</span>
                  <select
                    className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none disabled:opacity-60"
                    value={selectedProgramDayId ?? ''}
                    onChange={(e) => setSelectedProgramDayId(Number(e.target.value))}
                    disabled={!activeProgram || activeProgram.days.length === 0}
                  >
                    <option value="" disabled>
                      {activeProgram ? 'Select program day' : 'Set an active program first'}
                    </option>
                    {activeProgram?.days.map((day) => (
                      <option key={day.id} value={day.id}>
                        #{day.order} — {day.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <PrimaryButton
                    className="w-full"
                    onClick={onStartWorkout}
                    disabled={saving || selectedProgramDayId === null}
                  >
                    Start workout
                  </PrimaryButton>
                </div>

                {!activeProgram && (
                  <p className="text-sm text-amber-300 md:col-span-3">
                    Set one program as active before starting a workout.
                  </p>
                )}
                {activeProgram && activeProgram.days.length === 0 && (
                  <p className="text-sm text-amber-300 md:col-span-3">
                    Active program has no days yet. Add ProgramDays before starting a workout.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card padding="lg" className="space-y-4">
            <SectionHeader title="Create program" />

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-zinc-400">Name</span>
                <input
                  className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Hypertrophy Block"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-400">Type</span>
                <select
                  className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none"
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as ProgramType)}
                >
                  {PROGRAM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatProgramType(type)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                checked={createIsActive}
                onChange={(e) => setCreateIsActive(e.target.checked)}
              />
              Set as active program
            </label>

            <PrimaryButton onClick={onCreateProgram} disabled={saving}>
              Create program
            </PrimaryButton>
          </Card>

          <Card padding="lg" className="space-y-4">
            <SectionHeader title="Your programs" />

            {programs.length === 0 ? (
              <p className="text-sm text-zinc-400">No programs yet. Create your first program above.</p>
            ) : (
              <div className="space-y-3">
                {programs.map((program) => {
                  const isEditing = editingProgramId === program.id && editor !== null;

                  return (
                    <article key={program.id} className="rounded-md border border-[var(--ui-border)] bg-zinc-900 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{isEditing ? editor.name : program.name}</h3>
                            {program.isActive && (
                              <Badge variant="active">Active</Badge>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400">
                            Type:{' '}
                            <span className="text-zinc-200">
                              {isEditing ? formatProgramType(editor.type) : formatProgramType(program.type)}
                            </span>
                          </p>
                        </div>

                        {isEditing ? (
                          <div className="flex gap-2">
                            <PrimaryButton onClick={() => saveEdit(program.id)} disabled={saving}>
                              Save
                            </PrimaryButton>
                            <SecondaryButton onClick={cancelEdit} disabled={saving}>
                              Cancel
                            </SecondaryButton>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <SecondaryButton onClick={() => beginEdit(program)} disabled={saving}>
                              Edit
                            </SecondaryButton>
                            {!program.isActive && (
                              <PrimaryButton onClick={() => setProgramActive(program.id)} disabled={saving}>
                                Set active
                              </PrimaryButton>
                            )}
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-4 space-y-5">
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="flex flex-col gap-1 md:col-span-2">
                              <span className="text-sm text-zinc-400">Name</span>
                              <input
                                className="rounded-md border border-[var(--ui-border)] bg-zinc-800 px-3 py-2 outline-none"
                                value={editor.name}
                                onChange={(e) =>
                                  setEditor((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                                }
                              />
                            </label>

                            <label className="flex flex-col gap-1">
                              <span className="text-sm text-zinc-400">Type</span>
                              <select
                                className="rounded-md border border-[var(--ui-border)] bg-zinc-800 px-3 py-2 outline-none"
                                value={editor.type}
                                onChange={(e) =>
                                  setEditor((prev) =>
                                    prev ? { ...prev, type: e.target.value as ProgramType } : prev,
                                  )
                                }
                              >
                                {PROGRAM_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {formatProgramType(type)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="inline-flex items-center gap-2 text-sm text-zinc-300 md:col-span-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                                checked={editor.isActive}
                                onChange={(e) =>
                                  setEditor((prev) =>
                                    prev ? { ...prev, isActive: e.target.checked } : prev,
                                  )
                                }
                              />
                              Set as active program
                            </label>
                          </div>

                          <div className="space-y-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] p-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                              ProgramDays
                            </h4>

                            <div className="flex flex-wrap items-end gap-2">
                              <label className="flex min-w-[220px] flex-1 flex-col gap-1">
                                <span className="text-sm text-zinc-400">New day name</span>
                                <input
                                  className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none"
                                  value={dayEditor?.newDayName ?? ''}
                                  onChange={(e) =>
                                    setDayEditor((prev) =>
                                      prev ? { ...prev, newDayName: e.target.value } : prev,
                                    )
                                  }
                                  placeholder="e.g. Lower A"
                                />
                              </label>
                              <SecondaryButton onClick={() => createProgramDay(program.id)} disabled={saving}>
                                Add day
                              </SecondaryButton>
                            </div>

                            {program.days.length === 0 ? (
                              <p className="text-sm text-zinc-400">No days yet.</p>
                            ) : (
                              <div className="space-y-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-card)] p-2">
                                {program.days
                                  .slice()
                                  .sort((a, b) => a.order - b.order)
                                  .map((day, index, arr) => (
                                    <div
                                      key={day.id}
                                      className="grid gap-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] p-3 md:grid-cols-[80px,1fr,auto]"
                                    >
                                      <div className="text-sm text-zinc-400">#{day.order}</div>
                                      <input
                                        className="rounded-md border border-[var(--ui-border)] bg-zinc-800 px-3 py-2 text-sm outline-none"
                                        value={dayEditor?.draftNameByDayId[day.id] ?? day.name}
                                        onChange={(e) =>
                                          setDayEditor((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  draftNameByDayId: {
                                                    ...prev.draftNameByDayId,
                                                    [day.id]: e.target.value,
                                                  },
                                                }
                                              : prev,
                                          )
                                        }
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        <SecondaryButton
                                          className="px-2 py-1 text-xs"
                                          onClick={() => moveProgramDay(program.id, day.id, -1)}
                                          disabled={saving || index === 0}
                                        >
                                          Up
                                        </SecondaryButton>
                                        <SecondaryButton
                                          className="px-2 py-1 text-xs"
                                          onClick={() => moveProgramDay(program.id, day.id, 1)}
                                          disabled={saving || index === arr.length - 1}
                                        >
                                          Down
                                        </SecondaryButton>
                                        <SecondaryButton
                                          className="px-2 py-1 text-xs"
                                          onClick={() => renameProgramDay(program.id, day.id)}
                                          disabled={saving}
                                        >
                                          Rename
                                        </SecondaryButton>
                                        <DangerButton
                                          className="px-2 py-1 text-xs"
                                          onClick={() => deleteProgramDay(program.id, day.id)}
                                          disabled={saving}
                                        >
                                          Delete
                                        </DangerButton>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] p-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                              DayExercises
                            </h4>

                            {program.days.length === 0 ? (
                              <p className="text-sm text-zinc-400">
                                Add at least one ProgramDay before configuring exercises.
                              </p>
                            ) : (
                              <>
                                <label className="flex flex-col gap-1">
                                  <span className="text-sm text-zinc-400">Edit ProgramDay</span>
                                  <select
                                    className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none"
                                    value={editingProgramDayId ?? ''}
                                    onChange={(e) => setEditingProgramDayId(Number(e.target.value))}
                                    disabled={saving}
                                  >
                                    {program.days
                                      .slice()
                                      .sort((a, b) => a.order - b.order)
                                      .map((day) => (
                                        <option key={day.id} value={day.id}>
                                          #{day.order} - {day.name}
                                        </option>
                                      ))}
                                  </select>
                                </label>

                                <div className="grid gap-2 md:grid-cols-[1.2fr,repeat(3,minmax(0,120px)),auto]">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-sm text-zinc-400">Exercise</span>
                                    <select
                                      className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none"
                                      value={newDayExerciseDraft.exerciseId}
                                      onChange={(e) =>
                                        setNewDayExerciseDraft((prev) => ({
                                          ...prev,
                                          exerciseId: e.target.value,
                                        }))
                                      }
                                      onBlur={() => {
                                        setDayExerciseCreateError(null);
                                      }}
                                      disabled={saving}
                                    >
                                      <option value="">Select exercise</option>
                                      {exerciseCatalog.map((exercise) => (
                                        <option key={exercise.id} value={exercise.id}>
                                          {exercise.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="flex flex-col gap-1">
                                    <span className="text-sm text-zinc-400">Sets</span>
                                    <input
                                      className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none"
                                      inputMode="numeric"
                                      value={newDayExerciseDraft.targetSets}
                                      onChange={(e) =>
                                        {
                                          setDayExerciseCreateError(null);
                                          setNewDayExerciseDraft((prev) => ({
                                            ...prev,
                                            targetSets: e.target.value,
                                          }));
                                        }
                                      }
                                    />
                                  </label>

                                  <label className="flex flex-col gap-1">
                                    <span className="text-sm text-zinc-400">Min reps</span>
                                    <input
                                      className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none"
                                      inputMode="numeric"
                                      value={newDayExerciseDraft.minReps}
                                      onChange={(e) =>
                                        {
                                          setDayExerciseCreateError(null);
                                          setNewDayExerciseDraft((prev) => ({
                                            ...prev,
                                            minReps: e.target.value,
                                          }));
                                        }
                                      }
                                    />
                                  </label>

                                  <label className="flex flex-col gap-1">
                                    <span className="text-sm text-zinc-400">Max reps</span>
                                    <input
                                      className="rounded-md border border-[var(--ui-border)] bg-zinc-900 px-3 py-2 outline-none"
                                      inputMode="numeric"
                                      value={newDayExerciseDraft.maxReps}
                                      onChange={(e) =>
                                        {
                                          setDayExerciseCreateError(null);
                                          setNewDayExerciseDraft((prev) => ({
                                            ...prev,
                                            maxReps: e.target.value,
                                          }));
                                        }
                                      }
                                    />
                                  </label>

                                  <div className="flex items-end">
                                    <SecondaryButton
                                      className="w-full"
                                      onClick={() => createDayExercise(program.id)}
                                      disabled={saving || editingProgramDayId === null}
                                    >
                                      Add
                                    </SecondaryButton>
                                  </div>
                                </div>
                                {dayExerciseCreateError && (
                                  <p className="text-sm text-red-400">{dayExerciseCreateError}</p>
                                )}

                                {dayExercises.length === 0 ? (
                                  <p className="text-sm text-zinc-400">No exercises configured for this day.</p>
                                ) : (
                                  <div className="space-y-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-card)] p-2">
                                    {dayExercises.map((row, index) => (
                                      <div
                                        key={row.id}
                                        className="space-y-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-2)] p-3"
                                      >
                                        <div className="text-sm text-zinc-400">#{row.order}</div>
                                        <div className="text-sm text-zinc-200">
                                          {exerciseNameById[row.exerciseId] ?? `Exercise #${row.exerciseId}`}
                                        </div>
                                        <div className="grid gap-2 md:grid-cols-3">
                                          <input
                                            aria-label="Target sets"
                                            className="rounded-md border border-[var(--ui-border)] bg-zinc-800 px-2 py-1 text-sm outline-none"
                                            inputMode="numeric"
                                            value={dayExerciseDrafts[row.id]?.targetSets ?? String(row.targetSets)}
                                            onChange={(e) => {
                                              setDayExerciseSaveErrors((prev) => {
                                                const next = { ...prev };
                                                delete next[row.id];
                                                return next;
                                              });
                                              setDayExerciseDrafts((prev) => ({
                                                ...prev,
                                                [row.id]: {
                                                  ...(prev[row.id] ?? {
                                                    targetSets: String(row.targetSets),
                                                    minReps: String(row.minReps),
                                                    maxReps: String(row.maxReps),
                                                  }),
                                                  targetSets: e.target.value,
                                                },
                                              }));
                                            }}
                                          />
                                          <input
                                            aria-label="Min reps"
                                            className="rounded-md border border-[var(--ui-border)] bg-zinc-800 px-2 py-1 text-sm outline-none"
                                            inputMode="numeric"
                                            value={dayExerciseDrafts[row.id]?.minReps ?? String(row.minReps)}
                                            onChange={(e) => {
                                              setDayExerciseSaveErrors((prev) => {
                                                const next = { ...prev };
                                                delete next[row.id];
                                                return next;
                                              });
                                              setDayExerciseDrafts((prev) => ({
                                                ...prev,
                                                [row.id]: {
                                                  ...(prev[row.id] ?? {
                                                    targetSets: String(row.targetSets),
                                                    minReps: String(row.minReps),
                                                    maxReps: String(row.maxReps),
                                                  }),
                                                  minReps: e.target.value,
                                                },
                                              }));
                                            }}
                                          />
                                          <input
                                            aria-label="Max reps"
                                            className="rounded-md border border-[var(--ui-border)] bg-zinc-800 px-2 py-1 text-sm outline-none"
                                            inputMode="numeric"
                                            value={dayExerciseDrafts[row.id]?.maxReps ?? String(row.maxReps)}
                                            onChange={(e) => {
                                              setDayExerciseSaveErrors((prev) => {
                                                const next = { ...prev };
                                                delete next[row.id];
                                                return next;
                                              });
                                              setDayExerciseDrafts((prev) => ({
                                                ...prev,
                                                [row.id]: {
                                                  ...(prev[row.id] ?? {
                                                    targetSets: String(row.targetSets),
                                                    minReps: String(row.minReps),
                                                    maxReps: String(row.maxReps),
                                                  }),
                                                  maxReps: e.target.value,
                                                },
                                              }));
                                            }}
                                          />
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <SecondaryButton
                                            className="px-2 py-1 text-xs"
                                            onClick={() => moveDayExercise(program.id, row.id, -1)}
                                            disabled={saving || index === 0}
                                          >
                                            Up
                                          </SecondaryButton>
                                          <SecondaryButton
                                            className="px-2 py-1 text-xs"
                                            onClick={() => moveDayExercise(program.id, row.id, 1)}
                                            disabled={saving || index === dayExercises.length - 1}
                                          >
                                            Down
                                          </SecondaryButton>
                                          <SecondaryButton
                                            className="px-2 py-1 text-xs"
                                            onClick={() => saveDayExercise(program.id, row.id)}
                                            disabled={saving}
                                          >
                                            Save
                                          </SecondaryButton>
                                          <DangerButton
                                            className="px-2 py-1 text-xs"
                                            onClick={() => deleteDayExercise(program.id, row.id)}
                                            disabled={saving}
                                          >
                                            Delete
                                          </DangerButton>
                                        </div>
                                        {dayExerciseSaveErrors[row.id] && (
                                          <p className="text-sm text-red-400">
                                            {dayExerciseSaveErrors[row.id]}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}


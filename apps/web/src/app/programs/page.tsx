'use client';

import { useEffect, useMemo, useState } from 'react';
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

  const activeProgram = useMemo(() => programs.find((p) => p.isActive) ?? null, [programs]);

  async function loadData() {
    setError(null);
    setLoading(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const [activeRes, programsRes] = await Promise.all([
        apiFetch<{ session: ActiveSession }>('/workouts/sessions/active', { token }),
        apiFetch<ProgramApi[]>('/programs', { token }),
      ]);

      const nextPrograms = programsRes.map(normalizeProgram);
      setActiveSession(activeRes.session);
      setPrograms(nextPrograms);
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
        <button
          className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 hover:bg-zinc-700"
          onClick={loadData}
          disabled={loading || saving}
        >
          Refresh
        </button>
      }
    >
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <section className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-800 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Workout entrypoint</h2>
              {activeProgram ? (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  Active program: {activeProgram.name}
                </span>
              ) : (
                <span className="rounded-full border border-zinc-600 px-3 py-1 text-xs text-zinc-300">
                  No active program
                </span>
              )}
            </div>

            {activeSession ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-zinc-300">
                  Active session #{activeSession.id} started at {new Date(activeSession.startedAt).toLocaleString()}
                </div>
                <button
                  className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
                  onClick={onResumeWorkout}
                >
                  Resume workout
                </button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm text-zinc-400">Program day</span>
                  <select
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none disabled:opacity-60"
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
                  <button
                    className="w-full rounded-md bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
                    onClick={onStartWorkout}
                    disabled={saving || selectedProgramDayId === null}
                  >
                    Start workout
                  </button>
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
          </section>

          <section className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-800 p-5">
            <h2 className="text-xl font-semibold">Create program</h2>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-zinc-400">Name</span>
                <input
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Hypertrophy Block"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-zinc-400">Type</span>
                <select
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
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

            <button
              className="rounded-md bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
              onClick={onCreateProgram}
              disabled={saving}
            >
              Create program
            </button>
          </section>

          <section className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-800 p-5">
            <h2 className="text-xl font-semibold">Your programs</h2>

            {programs.length === 0 ? (
              <p className="text-sm text-zinc-400">No programs yet. Create your first program above.</p>
            ) : (
              <div className="space-y-3">
                {programs.map((program) => {
                  const isEditing = editingProgramId === program.id && editor !== null;

                  return (
                    <article key={program.id} className="rounded-md border border-zinc-700 bg-zinc-900 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{isEditing ? editor.name : program.name}</h3>
                            {program.isActive && (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                Active
                              </span>
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
                            <button
                              className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
                              onClick={() => saveEdit(program.id)}
                              disabled={saving}
                            >
                              Save
                            </button>
                            <button
                              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                              onClick={() => beginEdit(program)}
                              disabled={saving}
                            >
                              Edit
                            </button>
                            {!program.isActive && (
                              <button
                                className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
                                onClick={() => setProgramActive(program.id)}
                                disabled={saving}
                              >
                                Set active
                              </button>
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
                                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none"
                                value={editor.name}
                                onChange={(e) =>
                                  setEditor((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                                }
                              />
                            </label>

                            <label className="flex flex-col gap-1">
                              <span className="text-sm text-zinc-400">Type</span>
                              <select
                                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none"
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

                          <div className="space-y-3 rounded-md border border-zinc-700 bg-zinc-800 p-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                              ProgramDays
                            </h4>

                            <div className="flex flex-wrap items-end gap-2">
                              <label className="flex min-w-[220px] flex-1 flex-col gap-1">
                                <span className="text-sm text-zinc-400">New day name</span>
                                <input
                                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
                                  value={dayEditor?.newDayName ?? ''}
                                  onChange={(e) =>
                                    setDayEditor((prev) =>
                                      prev ? { ...prev, newDayName: e.target.value } : prev,
                                    )
                                  }
                                  placeholder="e.g. Lower A"
                                />
                              </label>
                              <button
                                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
                                onClick={() => createProgramDay(program.id)}
                                disabled={saving}
                              >
                                Add day
                              </button>
                            </div>

                            {program.days.length === 0 ? (
                              <p className="text-sm text-zinc-400">No days yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {program.days
                                  .slice()
                                  .sort((a, b) => a.order - b.order)
                                  .map((day, index, arr) => (
                                    <div
                                      key={day.id}
                                      className="grid gap-2 rounded-md border border-zinc-700 bg-zinc-900 p-3 md:grid-cols-[80px,1fr,auto]"
                                    >
                                      <div className="text-sm text-zinc-400">#{day.order}</div>
                                      <input
                                        className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none"
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
                                        <button
                                          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 disabled:opacity-50"
                                          onClick={() => moveProgramDay(program.id, day.id, -1)}
                                          disabled={saving || index === 0}
                                        >
                                          Up
                                        </button>
                                        <button
                                          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 disabled:opacity-50"
                                          onClick={() => moveProgramDay(program.id, day.id, 1)}
                                          disabled={saving || index === arr.length - 1}
                                        >
                                          Down
                                        </button>
                                        <button
                                          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 disabled:opacity-50"
                                          onClick={() => renameProgramDay(program.id, day.id)}
                                          disabled={saving}
                                        >
                                          Rename
                                        </button>
                                        <button
                                          className="rounded-md border border-red-500/50 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                                          onClick={() => deleteProgramDay(program.id, day.id)}
                                          disabled={saving}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}


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

type Program = {
  id: number;
  name: string;
  type: ProgramType;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ProgramEditor = {
  name: string;
  type: ProgramType;
  isActive: boolean;
};

const PROGRAM_TYPES: ProgramType[] = ['AB', 'PPL', 'FULL_BODY', 'CUSTOM'];

function formatProgramType(type: ProgramType) {
  if (type === 'FULL_BODY') return 'Full Body';
  if (type === 'AB') return 'A/B';
  return type;
}

export default function ProgramsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession>(null);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [programDayId, setProgramDayId] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<ProgramType>('CUSTOM');
  const [createIsActive, setCreateIsActive] = useState(false);

  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [editor, setEditor] = useState<ProgramEditor | null>(null);

  const activeProgram = useMemo(() => programs.find((p) => p.isActive) ?? null, [programs]);

  async function loadData() {
    setError(null);
    setLoading(true);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const [activeRes, programsRes] = await Promise.all([
        apiFetch<{ session: ActiveSession }>('/workouts/sessions/active', { token }),
        apiFetch<Program[]>('/programs', { token }),
      ]);

      setActiveSession(activeRes.session);
      setPrograms(programsRes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load programs page');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function onStartWorkout() {
    setError(null);

    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');

      const session = await apiFetch<NonNullable<ActiveSession>>('/workouts/sessions/start', {
        method: 'POST',
        token,
        body: JSON.stringify({ programDayId }),
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

      const created = await apiFetch<Program>('/programs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name,
          type: createType,
          isActive: createIsActive,
        }),
      });

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
  }

  function cancelEdit() {
    setEditingProgramId(null);
    setEditor(null);
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

      const updated = await apiFetch<Program>(`/programs/${programId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name,
          type: editor.type,
          isActive: editor.isActive,
        }),
      });

      setPrograms((prev) => {
        const mapped = prev.map((p) => (p.id === programId ? { ...p, ...updated } : p));
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

      await apiFetch<Program>(`/programs/${programId}`, {
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
                <span className="rounded-full border border-zinc-600 px-3 py-1 text-xs text-zinc-300">No active program</span>
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
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-zinc-400">Program day id (temporary)</span>
                  <input
                    className="w-44 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
                    type="number"
                    min={1}
                    value={programDayId}
                    onChange={(e) => setProgramDayId(Number(e.target.value))}
                  />
                </label>

                <button
                  className="rounded-md bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 hover:bg-white"
                  onClick={onStartWorkout}
                  disabled={saving}
                >
                  Start workout
                </button>
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
                            <h3 className="text-lg font-semibold">
                              {isEditing ? editor.name : program.name}
                            </h3>
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
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <label className="flex flex-col gap-1 md:col-span-2">
                            <span className="text-sm text-zinc-400">Name</span>
                            <input
                              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none"
                              value={editor.name}
                              onChange={(e) => setEditor((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
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

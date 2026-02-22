'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';

type ActiveSession = {
    id: number;
    startedAt: string;
    endedAt: string | null;
    programId: number;
    programDayId: number;
};

type LastSession = {
    id: number;
    startedAt: string;
    endedAt: string;
    program: { id: number; name: string; type: string };
    programDay: { id: number; name: string; order: number };
};

export default function HomePage() {
    const [active, setActive] = useState<ActiveSession | null>(null);
    const [last, setLast] = useState<LastSession | null>(null);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();

    function logout() {
        clearToken();
        router.replace('/');
    }

    async function load() {
        setError(null);

        try {
            const token = getToken();
            if (!token) throw new Error('Please login first (go to /)');

            const activeRes = await apiFetch<{ session: ActiveSession | null }>(
                '/workouts/sessions/active',
                { token }
            );

            const lastRes = await apiFetch<{ session: LastSession | null }>(
                '/workouts/sessions/last',
                { token }
            );

            setActive(activeRes.session);
            setLast(lastRes.session);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load home data');
        }
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <AppShell
            title="Home"
            actions={
                <button
                    className="rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 hover:bg-zinc-700"
                    onClick={logout}
                >
                    Logout
                </button>
            }
        >
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="rounded-md bg-zinc-800 border border-zinc-700 p-5 space-y-3">
                <div className="font-semibold text-lg">Workout status</div>

                {active ? (
                    <>
                        <div className="text-zinc-300 text-sm">
                            You have an active workout started at{' '}
                            {new Date(active.startedAt).toLocaleString()}
                        </div>

                        <Link
                            href={`/workouts/sessions/${active.id}`}
                            className="inline-block rounded-md bg-green-500 text-black px-4 py-2 font-semibold"
                        >
                            Resume workout
                        </Link>
                    </>
                ) : (
                    <>
                        <div className="text-zinc-300 text-sm">
                            No active workout session.
                        </div>

                        <Link
                            href="/programs"
                            className="inline-block rounded-md bg-white text-black px-4 py-2 font-semibold"
                        >
                            Start workout
                        </Link>
                    </>
                )}
            </div>

            <div className="rounded-md bg-zinc-800 border border-zinc-700 p-5 space-y-3">
                <div className="font-semibold text-lg">Last workout</div>

                {last ? (
                    <>
                        <div className="text-zinc-200">
                            <span className="font-semibold">
                                {last.program.name}
                            </span>{' '}
                            - {last.programDay.name}
                        </div>

                        <div className="text-sm text-zinc-400">
                            Completed at {new Date(last.endedAt).toLocaleString()}
                        </div>

                        <Link
                            href={`/workouts/sessions/${last.id}/summary`}
                            className="inline-block rounded-md bg-zinc-700 px-4 py-2"
                        >
                            View summary
                        </Link>
                    </>
                ) : (
                    <div className="text-zinc-400 text-sm">
                        No workouts completed yet.
                    </div>
                )}
            </div>
        </AppShell>
    );
}


'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

export default function SessionPage() {
    const router = useRouter();
    const params = useParams<{ sessionId: string }>();
    const sessionId = Number(params.sessionId);

    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setError(null);
        try {
            const token = getToken();
            if (!token) throw new Error('Please login first (go to /)');
            const s = await apiFetch(`/workouts/sessions/${sessionId}`, { token });
            setData(s);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load session');
        }
    }

    useEffect(() => {
        if (!Number.isFinite(sessionId)) return;
        load();
    }, [sessionId]);

    async function finish() {
        setError(null);
        try {
            const token = getToken();
            if (!token) throw new Error('Please login first (go to /)');
            const finished = await apiFetch<{ id: number }>(
                `/workouts/sessions/${sessionId}/finish`,
                { method: 'POST', token }
            );

            router.push(`/workouts/sessions/${finished.id}/summary`);

        } catch (e: any) {
            setError(e?.message ?? 'Failed to finish session');
        }
    }

    return (
        <main className="min-h-screen bg-zinc-900 text-zinc-100 px-6 py-10">
            <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold">Session #{sessionId}</h1>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="flex gap-3">
                    <button
                        className="rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 hover:bg-zinc-700"
                        onClick={load}
                    >
                        Refresh
                    </button>

                    <button
                        className="rounded-md bg-zinc-100 text-zinc-900 px-4 py-2 font-semibold hover:bg-white"
                        onClick={finish}
                    >
                        Finish
                    </button>
                </div>

                <pre className="rounded-md bg-zinc-800 border border-zinc-700 p-4 overflow-auto text-sm">
                    {JSON.stringify(data, null, 2)}
                </pre>
            </div>
        </main>
    );
}

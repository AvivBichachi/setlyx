'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

export default function SessionSummaryPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Please login first (go to /)');
      const s = await apiFetch(`/workouts/sessions/${sessionId}/summary`, { token });
      setData(s);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load summary');
    }
  }

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    load();
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Summary — Session #{sessionId}</h1>
          <Link
            href="/programs"
            className="rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 hover:bg-zinc-700"
          >
            Back to Programs
          </Link>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <pre className="rounded-md bg-zinc-800 border border-zinc-700 p-4 overflow-auto text-sm">
{JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </main>
  );
}

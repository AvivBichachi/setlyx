'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { SecondaryButton, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { apiFetch } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';

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

      const activeRes = await apiFetch<{ session: ActiveSession | null }>('/workouts/sessions/active', { token });
      const lastRes = await apiFetch<{ session: LastSession | null }>('/workouts/sessions/last', { token });

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
    <AppShell title="Home" actions={<SecondaryButton onClick={logout}>Logout</SecondaryButton>}>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card padding="lg" className="space-y-3">
        <SectionHeader title="Workout status" />

        {active ? (
          <>
            <div className="text-sm text-[var(--ui-text-secondary)]">
              You have an active workout started at {new Date(active.startedAt).toLocaleString()}
            </div>

            <Link href={`/workouts/sessions/${active.id}`} className={buttonClass('primary')}>
              Resume workout
            </Link>
          </>
        ) : (
          <>
            <div className="text-sm text-[var(--ui-text-secondary)]">No active workout session.</div>

            <Link href="/programs" className={buttonClass('primary')}>
              Start workout
            </Link>
          </>
        )}
      </Card>

      <Card padding="lg" className="space-y-3">
        <SectionHeader title="Last workout" action={last ? <Badge variant="active">Completed</Badge> : null} />

        {last ? (
          <>
            <div className="text-[var(--ui-text-primary)]">
              <span className="font-semibold">{last.program.name}</span> - {last.programDay.name}
            </div>

            <div className="text-sm text-[var(--ui-text-secondary)]">
              Completed at {new Date(last.endedAt).toLocaleString()}
            </div>

            <Link href={`/workouts/sessions/${last.id}/summary`} className={buttonClass('secondary')}>
              View summary
            </Link>
          </>
        ) : (
          <div className="text-sm text-[var(--ui-text-secondary)]">No workouts completed yet.</div>
        )}
      </Card>
    </AppShell>
  );
}

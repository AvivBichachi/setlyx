'use client';

import { ReactNode } from 'react';
import { AppNav } from './app-nav';

type AppShellProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, actions, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100">
      <AppNav />

      <div className="px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}

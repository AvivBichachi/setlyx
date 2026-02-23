import { ComponentPropsWithoutRef } from 'react';

type CardProps = ComponentPropsWithoutRef<'section'> & {
  padding?: 'md' | 'lg';
};

export function Card({ className, padding = 'md', ...props }: CardProps) {
  const paddingClass = padding === 'lg' ? 'p-5' : 'p-4';
  const classes = [
    'rounded-xl border border-[var(--ui-border)] bg-gradient-to-b from-[var(--ui-card-2)] to-[var(--ui-card)] ring-1 ring-white/8 shadow-sm shadow-black/40',
    paddingClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <section className={classes} {...props} />;
}

import { HTMLAttributes } from 'react';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'subtle' | 'active';
};

export function Badge({ className, variant = 'subtle', ...props }: BadgeProps) {
  const variantClass =
    variant === 'active'
      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
      : 'border-[var(--ui-border)] bg-zinc-900 text-[var(--ui-text-secondary)]';

  const classes = [
    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
    variantClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes} {...props} />;
}

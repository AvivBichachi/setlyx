import { ReactNode } from 'react';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  const classes = ['mb-3 flex items-center justify-between gap-3', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div>
        <h2 className="text-sm font-semibold text-[var(--ui-text-primary)]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--ui-text-secondary)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
};

export function StatCard({ label, value, hint, className }: StatCardProps) {
  const classes = [
    'rounded-lg border border-[var(--ui-border)] bg-[var(--ui-card-2)] p-3',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="text-xs text-[var(--ui-text-secondary)]">{label}</div>
      <div className="text-base font-semibold text-[var(--ui-text-primary)]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--ui-text-secondary)]">{hint}</div> : null}
    </div>
  );
}

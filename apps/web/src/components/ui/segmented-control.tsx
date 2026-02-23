import { PrimaryButton, SecondaryButton } from './button';

type SegmentedOption<T extends string | number> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string | number> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
};

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const classes = ['flex flex-wrap gap-3', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          isActive ? (
            <PrimaryButton
              key={String(option.value)}
              role="radio"
              aria-checked={isActive}
              className="text-zinc-950 ring-1 ring-[var(--ui-accent)]/30 shadow-sm"
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </PrimaryButton>
          ) : (
            <SecondaryButton
              key={String(option.value)}
              role="radio"
              aria-checked={isActive}
              className="text-[var(--ui-text-secondary)]"
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </SecondaryButton>
          )
        );
      })}
    </div>
  );
}

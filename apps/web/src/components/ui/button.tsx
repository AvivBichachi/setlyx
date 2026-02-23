import { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function baseButtonClass(className?: string) {
  return joinClasses(
    'inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition-[background-color,border-color,box-shadow,color]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60',
    'disabled:cursor-not-allowed disabled:opacity-50',
    className,
  );
}

export function buttonClass(variant: ButtonVariant, className?: string) {
  if (variant === 'primary') {
    return baseButtonClass(
      joinClasses(
        'border-[var(--ui-accent)] bg-[var(--ui-accent)] text-zinc-950',
        'shadow-sm shadow-[0_0_20px_rgba(45,212,191,0.15)]',
        'hover:border-[var(--ui-accent-hover)] hover:bg-[var(--ui-accent-hover)] hover:shadow-[0_0_24px_rgba(45,212,191,0.25)]',
        className,
      ),
    );
  }
  if (variant === 'danger') {
    return baseButtonClass(
      joinClasses('border-red-500/60 bg-transparent text-red-300 hover:bg-red-500/10', className),
    );
  }
  return baseButtonClass(
    joinClasses(
      'border-[var(--ui-border)] bg-zinc-900 text-[var(--ui-text-primary)] hover:bg-zinc-800',
      className,
    ),
  );
}

function BaseButton({ className, ...props }: BaseButtonProps) {
  return <button type="button" className={baseButtonClass(className)} {...props} />;
}

export function PrimaryButton(props: BaseButtonProps) {
  const { className, ...rest } = props;
  return <BaseButton className={buttonClass('primary', className)} {...rest} />;
}

export function SecondaryButton(props: BaseButtonProps) {
  const { className, ...rest } = props;
  return <BaseButton className={buttonClass('secondary', className)} {...rest} />;
}

export function DangerButton(props: BaseButtonProps) {
  const { className, ...rest } = props;
  return <BaseButton className={buttonClass('danger', className)} {...rest} />;
}

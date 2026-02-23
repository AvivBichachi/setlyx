'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buttonClass } from '@/components/ui/button';

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home' },
  { href: '/programs', label: 'Programs' },
  { href: '/progress', label: 'Progress' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemClass(active: boolean) {
  return buttonClass(
    active ? 'primary' : 'secondary',
    active ? 'px-3 py-2 text-sm' : 'px-3 py-2 text-sm text-[var(--ui-text-secondary)]',
  );
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="sticky top-0 z-40 hidden border-b border-[var(--ui-border)] bg-black/40 backdrop-blur md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={itemClass(isActive(pathname, item.href))}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ui-border)] bg-black/40 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={itemClass(isActive(pathname, item.href))}
            >
              <span className="block text-center">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

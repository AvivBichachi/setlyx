'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  return active
    ? 'rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-100'
    : 'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100';
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="sticky top-0 z-40 hidden border-b border-zinc-800 bg-zinc-900/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-3">
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-900/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2">
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

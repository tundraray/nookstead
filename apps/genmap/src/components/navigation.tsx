'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { KeyboardShortcutsHelp } from './keyboard-shortcuts-help';

const navItems = [
  { href: '/sprites', label: 'Sprites' },
  { href: '/tilesets', label: 'Tilesets' },
  { href: '/objects', label: 'Objects' },
  { href: '/materials', label: 'Materials' },
  { href: '/maps', label: 'Maps' },
  { href: '/templates', label: 'Templates' },
  { href: '/npcs', label: 'NPCs' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto flex h-14 items-center gap-6 px-6">
        <Link href="/" className="font-semibold hover:text-primary transition-colors">
          Nookstead Genmap
        </Link>
        <div className="flex gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <KeyboardShortcutsHelp />
      </div>
    </nav>
  );
}

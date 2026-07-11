import { Link } from '@tanstack/react-router'

import { cn } from '#/lib/utils'
import { getTodayDateString } from '#/pages/logs/log-page-helpers.ts'

import ThemeToggle from './ThemeToggle'
import { useIsMobile } from '../hooks/use-media-query';
import { Button } from './base/Button';

const navLinkBase =
  'inline-block border-b-2 border-transparent px-1 pb-1 pt-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground'

const navLinkActive = 'border-primary text-primary'

export default function Header() {
  const isMobile = useIsMobile();
  const isLoggedIn = false; // TODO: Replace with actual authentication check
  return (
    <header className="sticky top-0 z-50 border-b border-white bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <nav className="mx-auto flex w-full flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 md:px-10">
        <Link
          to="/"
          className="font-heading text-lg font-bold tracking-tight text-primary no-underline"
        >
          Calibrate
        </Link>

        <div className="flex flex-1 items-center gap-6">
          {isMobile 
            ? (
              <div className="flex flex-1 justify-end">
                {!isLoggedIn && (
                  <Button size="sm">Login</Button>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/"
                  activeOptions={{ exact: true }}
                  className={navLinkBase}
                  activeProps={{ className: cn(navLinkBase, navLinkActive) }}
                >
                  Overview
                </Link>
                <Link
                  to="/logs"
                  search={{ date: getTodayDateString() }}
                  className={navLinkBase}
                  activeProps={{ className: cn(navLinkBase, navLinkActive) }}
                >
                  Logs
                </Link>
                <Link
                  to="/goals"
                  className={navLinkBase}
                  activeProps={{ className: cn(navLinkBase, navLinkActive) }}
                >
                  Goals
                </Link>
              </>
            )
          }
        </div>

        <div className="hidden ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}

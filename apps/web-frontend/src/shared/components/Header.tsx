import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { UserRound, UserRoundPlus } from 'lucide-react'

import { cn } from '#/lib/utils'
import { getTodayDateString } from '#/pages/logs/log-page-helpers.ts'
import {
  clearAuthenticatedSession,
  useAuthenticatedSession,
} from '#/verticals/auth/authenticated-session.ts'

import ThemeToggle from './ThemeToggle'
import { useIsMobile } from '../hooks/use-media-query';
import { Button } from './base/Button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './base/navigation-menu/NavigationMenu';

const navLinkBase =
  'inline-block border-b-2 border-transparent px-1 pb-1 pt-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground'

const navLinkActive = 'border-primary text-primary'

function AccountMenu({ onLogout }: { onLogout: () => void }) {
  return (
    <NavigationMenu align="end" render={<div />} className="max-w-none flex-none">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            aria-label="Account menu"
            className="size-8 rounded-full bg-muted p-0 text-foreground hover:bg-muted focus:bg-muted data-open:bg-muted data-popup-open:bg-muted [&>svg:last-child]:hidden"
          >
            <UserRound className="size-4" aria-hidden="true" />
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="min-w-36 p-1">
              <li>
                <NavigationMenuLink
                  closeOnClick
                  render={<button type="button" className="w-full" />}
                  onClick={onLogout}
                >
                  Log out
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export default function Header() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuthenticatedSession();
  const isLoggedIn = session !== undefined;

  function handleLogout() {
    clearAuthenticatedSession(queryClient);
    void navigate({ to: '/signup-login' });
  }

  const authAction = isLoggedIn ? (
    <AccountMenu onLogout={handleLogout} />
  ) : isMobile ? (
    <Button size="sm" onClick={() => navigate({ to: '/signup-login' })}>
      <UserRoundPlus />
      <span className="text-xs">
        Sign Up
      </span>
    </Button>
  ) : (
    <Button size="sm" onClick={() => navigate({ to: '/signup-login' })}>Sign Up</Button>
  );

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
                {authAction}
              </div>
            ) : (
              <>
                <div className="flex flex-1 items-center gap-6">
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
                </div>

                <div className="flex justify-end">
                  {authAction}
                </div>
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

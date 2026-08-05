import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { deleteCurrentSession } from '@calibrate/api-client'
import { UserRound, UserRoundPlus } from 'lucide-react'
import { useState } from 'react'

import { cn } from '#/lib/utils'
import { getTodayDateString } from '#/pages/logs/log-page-helpers.ts'
import {
  clearAuthenticatedSession,
  useAuthenticatedSession,
} from '#/verticals/auth/authenticated-session.ts'
import { apiTransport } from '#/shared/api/api-client.ts'

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

function AccountMenu({ onLogout, isLogoutPending }: { onLogout: () => void; isLogoutPending: boolean }) {
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
                  render={<button type="button" className="w-full" disabled={isLogoutPending} />}
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
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  async function handleLogout() {
    if (isLogoutPending) return;
    setIsLogoutPending(true);
    setLogoutError(false);
    try {
      await deleteCurrentSession(apiTransport);
      clearAuthenticatedSession(queryClient);
      await navigate({ to: '/signup-login' });
    } catch {
      setLogoutError(true);
    } finally {
      setIsLogoutPending(false);
    }
  }

  const authAction = isLoggedIn ? (
    <AccountMenu onLogout={() => void handleLogout()} isLogoutPending={isLogoutPending} />
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
      {session?.security?.sessionRestriction ? (
        <p role="status" className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-sm text-on-surface-variant">
          Recovery protection is active until {new Date(session.security.sessionRestriction.restrictionEndsAt).toLocaleString()}. Sensitive account changes are unavailable during this period.
        </p>
      ) : session?.security?.activeRecovery.state === "provisional" ? (
        <p role="status" className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-sm text-on-surface-variant">
          A recovery passkey is active for this account. Verify a trusted passkey to cancel it.
        </p>
      ) : session?.security?.activeRecovery.state === "promotion-eligible" ? (
        <p role="status" className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-sm text-on-surface-variant">
          Recovery protection has ended. Finish account recovery with a fresh passkey assertion.
        </p>
      ) : null}
      <nav className="mx-auto flex w-full flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 md:px-10">
        <Link
          to="/"
          className="font-heading text-lg font-bold tracking-tight text-primary no-underline"
        >
          Calibrate
        </Link>

        <div className="flex flex-1 items-center gap-6">
          {logoutError ? <p role="alert" className="text-sm text-destructive">Unable to log out. Please try again.</p> : null}
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

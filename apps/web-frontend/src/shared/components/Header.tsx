import { cn } from "#/lib/utils";
import { getTodayDateString } from "#/pages/logs/log-page-helpers.ts";
import { apiTransport } from "#/shared/api/api-client.ts";
import { APP_CONTENT_FRAME_CLASS_NAME } from "#/shared/layout/app-content-frame.ts";
import {
  clearAuthenticatedSession,
  useAuthenticatedSession,
} from "#/verticals/auth/authenticated-session.ts";
import { deleteCurrentSession } from "@calibrate/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { UserRound, UserRoundPlus } from "lucide-react";
import { useState } from "react";

import { useIsMobile } from "../hooks/use-media-query";
import { Button } from "./base/Button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./base/navigation-menu/NavigationMenu";
import ThemeToggle from "./ThemeToggle";

const navLinkBase =
  "inline-block border-b-2 border-transparent px-1 pb-1 pt-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground";

const navLinkActive = "border-primary text-primary";

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
  );
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/logs": "Logs",
};

export default function Header() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useLocation({
    select: (location) => location.pathname,
  });

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
      await navigate({ to: "/signup-login" });
    } catch {
      setLogoutError(true);
    } finally {
      setIsLogoutPending(false);
    }
  }

  const signUpButton = isMobile ? (
    <Button size="sm" onClick={() => navigate({ to: "/signup-login" })}>
      <UserRoundPlus />
      <span className="text-xs">Sign Up</span>
    </Button>
  ) : (
    <Button size="sm" onClick={() => navigate({ to: "/signup-login" })}>
      Sign Up
    </Button>
  );

  const authAction = isLoggedIn ? (
    <AccountMenu onLogout={() => void handleLogout()} isLogoutPending={isLogoutPending} />
  ) : (
    signUpButton
  );

  const logoutAlert = logoutError ? (
    <p role="alert" className="text-sm text-destructive">
      Unable to log out. Please try again.
    </p>
  ) : null;

  return (
    <header className="bg-white/80 backdrop-blur-md text-lg font-semibold text-[#4A6741] docked full-width top-0 sticky z-50 shadow-[0_20px_40px_rgba(0,0,0,0.04)] no-border tonal-shift">
      {isMobile ? (
        <div className={cn(APP_CONTENT_FRAME_CLASS_NAME, "flex flex-wrap items-center gap-x-8 gap-y-2 py-3")}>
          <h1>{PAGE_TITLES[pathname] || "Overview"}</h1>
          <div className="flex flex-1 items-center gap-6">
            {logoutAlert}
            <div className="flex flex-1 justify-end">{authAction}</div>
          </div>
          <div className="hidden ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      ) : (
        <nav className={cn(APP_CONTENT_FRAME_CLASS_NAME, "flex flex-wrap items-center gap-x-8 gap-y-2 py-3")}>
          <Link to="/" className="font-heading text-lg font-bold tracking-tight text-primary no-underline">
            Calibrate
          </Link>
          <div className="flex flex-1 items-center gap-6">
            {logoutAlert}
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
            </div>
            <div className="flex justify-end">{authAction}</div>
          </div>
          <div className="hidden ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  );
}

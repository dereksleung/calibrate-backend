import { cn } from "#/lib/utils";
import { getTodayDateString } from "#/pages/logs/log-page-helpers.ts";
import { Typography } from "#/shared/components/base/typography/Typography";
import { Link } from "@tanstack/react-router";
import { Gauge, NotebookPen, type LucideIcon } from "lucide-react";

import { useIsMobile } from "../hooks/use-media-query";

type BottomTabNavButton = {
  label: string;
  to: "/" | "/logs";
  icon: LucideIcon;
  exact?: boolean;
};

const BOTTOM_TAB_NAV_BUTTONS: BottomTabNavButton[] = [
  { label: "Overview", to: "/", icon: Gauge, exact: true },
  { label: "Logs", to: "/logs", icon: NotebookPen },
];

const bottomTabLinkBase =
  "flex flex-1 flex-col items-center justify-center gap-1 no-underline text-on-surface-variant transition-colors";

const bottomTabLinkActive = "text-primary";

export default function Footer() {
  const isMobile = useIsMobile();
  const year = new Date().getFullYear();

  if (isMobile) {
    return (
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-50 flex h-18 rounded-t-2xl bg-white shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.05)]"
      >
        <div className="flex flex-1 px-6">
          {BOTTOM_TAB_NAV_BUTTONS.map(({ label, to, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              search={to === "/logs" ? { date: getTodayDateString() } : undefined}
              activeOptions={exact ? { exact: true } : undefined}
              className={bottomTabLinkBase}
              activeProps={{ className: cn(bottomTabLinkBase, bottomTabLinkActive) }}
            >
              <Icon aria-hidden size={24} strokeWidth={1.5} />
              <Typography as="span" variant="label" color="inherit" className="normal-case tracking-normal">
                {label}
              </Typography>
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <footer className="mt-20 border-t border-[var(--line)] px-4 pb-14 pt-10 text-[var(--sea-ink-soft)]">
      <div className="page-wrap flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <p className="m-0 text-sm">&copy; {year} Your name here. All rights reserved.</p>
        <p className="island-kicker m-0">Built with TanStack Start</p>
      </div>
    </footer>
  );
}

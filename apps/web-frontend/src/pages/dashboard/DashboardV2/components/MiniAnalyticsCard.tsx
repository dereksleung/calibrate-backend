import type { ComponentProps, MouseEventHandler, ReactNode } from "react";

import { cn } from "#/lib/utils.ts";
import { ChevronRight } from "lucide-react";

type MiniAnalyticsCardProps = ComponentProps<"section"> & {
  title: string;
};

type BottomSummaryProps = {
  accessibleName?: string;
  children: ReactNode;
  interactive: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

function MiniAnalyticsCard({ className, title, ...props }: MiniAnalyticsCardProps) {
  return (
    <section aria-label={title} className={cn("glass-card min-w-0 rounded-xl p-3", className)} {...props} />
  );
}

function Title({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "break-words font-heading text-lg font-semibold tracking-[-0.02em] text-on-primary-fixed",
        className,
      )}
      {...props}
    />
  );
}

function Subtitle({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-0.5 text-xs text-on-surface-variant", className)} {...props} />;
}

function ChartArea({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0", className)} {...props} />;
}

function Separator({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("h-px bg-black/[0.07]", className)} {...props} />;
}

function SummaryStat({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "font-heading text-lg font-semibold leading-none tracking-[-0.035em] text-on-primary-fixed",
        className,
      )}
      {...props}
    />
  );
}

function GoDeeperIcon({ className, ...props }: ComponentProps<typeof ChevronRight>) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn("size-5 shrink-0 text-on-surface-variant", className)}
      {...props}
    />
  );
}

function BottomSummary({ accessibleName, children, interactive, onClick }: BottomSummaryProps) {
  const summary = (
    <>
      <span className="min-w-0 truncate">{children}</span>
      {interactive ? <GoDeeperIcon /> : null}
    </>
  );

  if (interactive) {
    return (
      <button
        aria-label={accessibleName}
        className="flex w-full items-center justify-between gap-2 text-left outline-offset-4 transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
        onClick={onClick}
        type="button"
      >
        {summary}
      </button>
    );
  }

  return <div className="flex min-w-0 items-center justify-between gap-2">{summary}</div>;
}

MiniAnalyticsCard.Title = Title;
MiniAnalyticsCard.Subtitle = Subtitle;
MiniAnalyticsCard.ChartArea = ChartArea;
MiniAnalyticsCard.Separator = Separator;
MiniAnalyticsCard.SummaryStat = SummaryStat;
MiniAnalyticsCard.GoDeeperIcon = GoDeeperIcon;
MiniAnalyticsCard.BottomSummary = BottomSummary;

export { MiniAnalyticsCard };

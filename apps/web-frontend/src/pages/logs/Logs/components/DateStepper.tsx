import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "#/shared/components/base/Button.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { addDaysToIsoDate, formatCompactDateHeading, formatDateHeading, isToday } from "../../log-page-helpers.ts";

type DateStepperProps = {
  selectedDate: string;
  date: Date;
};

export function DateStepper({ selectedDate, date }: DateStepperProps) {
  const previousDate = addDaysToIsoDate(selectedDate, -1);
  const nextDate = addDaysToIsoDate(selectedDate, 1);
  const today = isToday(selectedDate);

  return (
    <section aria-label="Selected day">
      <div className="flex items-center justify-center gap-4 md:hidden">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Previous day">
            <Link to="/logs" search={{ date: previousDate }}>
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <Typography as="h1" variant="headline" color="primary" weight="semibold" className="text-xl">
            {formatCompactDateHeading(date)}
          </Typography>
          <Button asChild variant="ghost" size="icon-sm" aria-label="Next day">
            <Link to="/logs" search={{ date: nextDate }}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <div className="hidden items-end justify-between gap-4 md:flex">
        <div>
          <Typography as="h1" variant="display" color="onSurface" className="text-[2.7rem] leading-tight">
            {formatDateHeading(date)}
          </Typography>
          <Typography variant="labelSpaced" className="mt-2 text-on-surface-variant/60">
            {today ? "Today" : selectedDate}
          </Typography>
        </div>
        <div className="flex items-center gap-4 text-on-surface-variant/60">
          <Button asChild variant="ghost" size="icon" aria-label="Previous day">
            <Link to="/logs" search={{ date: previousDate }}>
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Next day">
            <Link to="/logs" search={{ date: nextDate }}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

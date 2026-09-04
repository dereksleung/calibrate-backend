import { apiTransport } from "#/shared/api/api-client.ts";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { APP_CONTENT_FRAME_CLASS_NAME } from "#/shared/layout/app-content-frame.ts";
import { useAuthenticatedSession } from "#/verticals/auth/authenticated-session.ts";
import { useSelectedDayLog } from "@calibrate/api-client";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import {
  MEAL_SECTIONS,
  getDailyProgress,
  getDailyTotals,
  normalizeDayLogForRender,
} from "../log-page-helpers.ts";
import { DailySummary } from "./components/DailySummary.tsx";
import { DateStepper } from "./components/DateStepper.tsx";
import { MealSection } from "./components/MealSection.tsx";
import { QuickLogDrawer } from "./components/QuickLogDrawer.tsx";

type LogsProps = {
  selectedDate: string;
};

function LogsOverviewSkeleton() {
  return (
    <div className="space-y-10 md:space-y-8" aria-busy="true" aria-label="Loading day log">
      <div className="glass-card rounded-[2rem] px-8 py-9 md:rounded-2xl md:px-12 md:py-10">
        <div className="grid gap-8 md:gap-10">
          <div className="grid grid-cols-[1fr_auto] gap-8">
            <div className="space-y-4">
              <div className="h-3 w-24 animate-pulse rounded-full bg-surface-container-high" />
              <div className="h-14 w-40 animate-pulse rounded-lg bg-surface-container-high" />
              <div className="h-1.5 max-w-64 animate-pulse rounded-full bg-surface-container-high" />
            </div>
            <div className="space-y-3">
              <div className="ml-auto h-3 w-20 animate-pulse rounded-full bg-surface-container-high" />
              <div className="ml-auto h-10 w-24 animate-pulse rounded-lg bg-surface-container-high" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-5 md:gap-10">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-3 w-16 animate-pulse rounded-full bg-surface-container-high" />
                <div className="h-6 w-20 animate-pulse rounded-lg bg-surface-container-high" />
                <div className="h-1.5 animate-pulse rounded-full bg-surface-container-high" />
              </div>
            ))}
          </div>
          <div className="h-4 w-64 animate-pulse rounded-full bg-surface-container-high" />
        </div>
      </div>

      <section aria-labelledby="meals-heading" className="space-y-3">
        <Typography as="h2" className="text-on-primary-fixed" id="meals-heading" variant="h2SectionTitle">
          Meals
        </Typography>
        <div className="flex flex-col gap-3">
          {MEAL_SECTIONS.map((section) => (
            <div key={section.meal} className="glass-card rounded-xl p-3">
              <div className="h-6 w-24 animate-pulse rounded bg-black/[0.055]" />
              <div className="mt-1 h-3 w-40 animate-pulse rounded bg-black/[0.055]" />
              <div className="my-3 h-px bg-black/[0.07]" />
              <div className="mx-auto h-6 w-28 animate-pulse rounded bg-black/[0.055]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Logs({ selectedDate }: LogsProps) {
  const headingDate = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const navigate = useNavigate();

  const session = useAuthenticatedSession();
  const { data, isPending, error } = useSelectedDayLog(apiTransport, session!.user.id, selectedDate);

  useEffect(() => {
    if (!isPending && error) {
      toast.error(error.message, {
        closeButton: true,
      });
    }
  }, [isPending, error]);

  const dayLog = useMemo(() => normalizeDayLogForRender(data ?? null, selectedDate), [data, selectedDate]);
  const totals = getDailyTotals(dayLog);
  const progress = getDailyProgress(totals);

  return (
    <main className="min-h-screen bg-surface pb-24 pt-8 antialiased md:pb-20 md:pt-16 subtle-aurora-fade-page-background">
      <div className={`${APP_CONTENT_FRAME_CLASS_NAME} flex flex-col gap-10 md:gap-9`}>
        <DateStepper selectedDate={selectedDate} date={headingDate} />

        {isPending ? <LogsOverviewSkeleton /> : null}

        {!isPending ? (
          <>
            <DailySummary totals={totals} progress={progress} weight={dayLog.weight} />

            <section aria-labelledby="meals-heading" className="space-y-3">
              <Typography
                as="h2"
                className="text-on-primary-fixed"
                id="meals-heading"
                variant="h2SectionTitle"
              >
                Meals
              </Typography>
              <div className="flex flex-col gap-3">
                {MEAL_SECTIONS.map((section) => (
                  <MealSection
                    key={section.meal}
                    meal={section.meal}
                    title={section.title}
                    entries={dayLog.meals[section.meal]}
                    onAddFood={(meal) =>
                      navigate({
                        to: "/logs/food-search",
                        search: { date: selectedDate, meal },
                      })
                    }
                  />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
      <QuickLogDrawer
        onSearchFood={() =>
          navigate({
            to: "/logs/food-search",
            search: { date: selectedDate },
          })
        }
      />
    </main>
  );
}

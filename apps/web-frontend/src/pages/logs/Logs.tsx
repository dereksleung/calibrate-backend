import { useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router'

import { useSelectedDayLog } from '@calibrate/api-client'

import { apiTransport } from '#/shared/api/api-client.ts'
import { DateStepper } from './components/DateStepper.tsx'
import { DailySummary } from './components/DailySummary.tsx'
import { MealSection } from './components/MealSection.tsx'
import { QuickLogDrawer } from './components/QuickLogDrawer.tsx'
import {
  MEAL_SECTIONS,
  getDailyProgress,
  getDailyTotals,
  normalizeDayLogForRender,
} from './log-page-helpers.ts'

type LogsProps = {
  selectedDate: string
}

function LogsOverviewSkeleton() {
  return (
    <div className="space-y-10 md:space-y-8" aria-busy="true" aria-label="Loading day log">
      <div className="rounded-[2rem] bg-surface-container-lowest px-8 py-9 shadow-[0_18px_45px_-30px_rgba(26,28,28,0.45)] ring-1 ring-on-surface/5 md:rounded-2xl md:px-12 md:py-10">
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

      {MEAL_SECTIONS.map((section) => (
        <div
          key={section.meal}
          className="space-y-4 md:rounded-2xl md:bg-surface-container-lowest md:px-10 md:py-8 md:shadow-[0_18px_45px_-30px_rgba(26,28,28,0.45)] md:ring-1 md:ring-on-surface/5"
        >
          <div className="flex items-end justify-between gap-4">
            <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-container-high md:h-8" />
            <div className="h-7 w-16 animate-pulse rounded-lg bg-surface-container-high" />
          </div>
          <div className="min-h-40 overflow-hidden rounded-[2rem] bg-surface-container-lowest shadow-[0_18px_45px_-32px_rgba(26,28,28,0.42)] ring-1 ring-on-surface/5 md:rounded-none md:bg-transparent md:shadow-none md:ring-0">
            <div className="flex min-h-40 items-center justify-center px-8 py-10 md:min-h-28">
              <div className="h-10 w-full max-w-xs animate-pulse rounded-xl bg-surface-container-high" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Logs({ selectedDate }: LogsProps) {
  const headingDate = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate])
  const navigate = useNavigate()

  const { data, isPending, error } = useSelectedDayLog(apiTransport, selectedDate)

  useEffect(() => {
    if (!isPending && error) {
      toast.error(error.message, {
        closeButton: true
      })
    }
  }, [isPending, error])

  const dayLog = useMemo(
    () => normalizeDayLogForRender(data ?? null, selectedDate),
    [data, selectedDate]
  )
  const totals = getDailyTotals(dayLog)
  const progress = getDailyProgress(totals)

  return (
    <main className="min-h-screen bg-surface px-6 pb-24 pt-8 antialiased md:px-10 md:pb-20 md:pt-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 md:gap-9">
        <DateStepper selectedDate={selectedDate} date={headingDate} />

        {isPending ? <LogsOverviewSkeleton /> : null}

        {!isPending ? (
          <>
            <DailySummary totals={totals} progress={progress} weight={dayLog.weight} />

            <div className="space-y-10 md:space-y-8">
              {MEAL_SECTIONS.map((section) => (
                <MealSection
                  key={section.meal}
                  meal={section.meal}
                  title={section.title}
                  entries={dayLog.meals[section.meal]}
                  onAddFood={(meal) => navigate({
                    to: "/logs/food-search",
                    search: { date: selectedDate, meal },
                  })}
                />
              ))}
            </div>
          </>
        ) : null}

      </div>
      <QuickLogDrawer onSearchFood={() => navigate({
        to: "/logs/food-search",
        search: { date: selectedDate },
      })} />
    </main>
  )
}

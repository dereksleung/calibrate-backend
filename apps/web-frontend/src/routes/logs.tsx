import { Outlet, createFileRoute, useMatchRoute } from '@tanstack/react-router'

import { Logs } from '#/pages/logs/Logs/Logs.tsx'
import { normalizeLogsSearch } from '#/pages/logs/log-page-helpers.ts'

export const Route = createFileRoute('/logs')({
  validateSearch: normalizeLogsSearch,
  component: LogsRoute,
})

function LogsRoute() {
  const { date } = Route.useSearch()
  const matchRoute = useMatchRoute()

  if (
    matchRoute({ to: '/logs/food-search', fuzzy: false }) ||
    matchRoute({ to: '/logs/confirm-food', fuzzy: false })
  ) {
    return <Outlet />
  }

  return <Logs selectedDate={date} />
}

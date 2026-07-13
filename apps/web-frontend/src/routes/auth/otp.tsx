import { OtpPage } from '#/pages/auth/OtpPage.tsx';
import { createFileRoute } from '@tanstack/react-router'

type OtpSearch = {
  email?: string
}

export const Route = createFileRoute('/auth/otp')({
  validateSearch: (search: Record<string, unknown>): OtpSearch => {
    const email = typeof search.email === 'string' && search.email.length > 0
      ? search.email
      : undefined

    return email ? { email } : {}
  },
  component: OtpRoute,
})

function OtpRoute() {
  const { email } = Route.useSearch()

  return <OtpPage email={email} />
}

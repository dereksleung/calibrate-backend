import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/signup-login')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/signup-login"!</div>
}

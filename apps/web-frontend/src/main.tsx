import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { createQueryClient } from '#/shared/api/query-client.ts'
import { WEB_PUBLIC_BASE_PATH } from '#/config/public-base-path.ts'

const router = createRouter({
  basepath: WEB_PUBLIC_BASE_PATH, // For temp Github page deployment of mock UI, remove for production deployment
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})
const queryClient = createQueryClient()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// This code is only for TypeScript
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__:
      import('@tanstack/query-core').QueryClient
  }
}

// This code is for all users
window.__TANSTACK_QUERY_CLIENT__ = queryClient;

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

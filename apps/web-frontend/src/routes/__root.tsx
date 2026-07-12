import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import '../styles.css'
import Header from '#/shared/components/Header.tsx';
import Footer from '#/shared/components/Footer.tsx';
import { TooltipProvider } from '#/shared/components/base/tooltip/Tooltip.tsx';
import { Toaster } from '#/shared/components/base/Toast.tsx';
import { useIsMobile } from '#/shared/hooks/use-media-query.ts';

export const Route = createRootRoute({
  component: RootComponent,
  // beforeLoad: async ({ location }) => {
  //   console.log("🚀 ~ location:", location)
  //   const isAuthenticated = false; // TODO: Replace with actual authentication check
  //   if (!isAuthenticated && location.pathname !== '/signup-login') {
  //     // Redirect to login page if not authenticated
  //     throw redirect({
  //       to: '/signup-login',
  //       search: {
  //         redirect: location.href,
  //       }
  //     })
  //   }
  // }
})

function RootComponent() {
  const isMobile = useIsMobile();
  const isAuthRoute = useRouterState({
    select: (state) => state.location.pathname === '/signup-login',
  });

  return (
    <TooltipProvider>
      <div className={isAuthRoute ? 'min-h-dvh' : 'h-dvh'}>
        {/* pb-18 clears the mobile bottom nav bar */}
        <div className={isAuthRoute ? undefined : 'pb-18 md:pb-0'}>
          {!isAuthRoute && <Header />}
          <Toaster position={isMobile ? 'bottom-center' : 'top-center'} />
          <Outlet />
        </div>
        {!isAuthRoute && <Footer />}
      </div>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </TooltipProvider>
  )
}

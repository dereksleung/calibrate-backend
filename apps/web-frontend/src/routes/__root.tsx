import { Toaster } from "#/shared/components/base/Toast.tsx";
import { TooltipProvider } from "#/shared/components/base/tooltip/Tooltip.tsx";
import Footer from "#/shared/components/Footer.tsx";

import "../styles.css";
import Header from "#/shared/components/Header.tsx";
import { useIsMobile } from "#/shared/hooks/use-media-query.ts";
import { SessionRestorationGate } from "#/verticals/auth/session-restoration-gate.tsx";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

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
});

function RootComponent() {
  const isMobile = useIsMobile();
  const isAuthRoute = useRouterState({
    select: (state) =>
      state.location.pathname === "/signup-login" ||
      state.location.pathname === "/auth/otp" ||
      state.location.pathname === "/auth/passkey-enrollment" ||
      state.location.pathname === "/auth/login-recovery",
  });
  const isConfirmFoodRoute = useRouterState({
    select: (state) => state.location.pathname === "/logs/confirm-food",
  });

  const content = (
    <TooltipProvider>
      <div className={isAuthRoute ? "min-h-dvh" : "h-dvh subtle-aurora-fade-page-background"}>
        {/* pb-18 clears the mobile bottom nav bar. */}
        <div className={isAuthRoute ? undefined : isConfirmFoodRoute ? "md:pb-0" : "pb-18 md:pb-0"}>
          {!isAuthRoute && (
            <div className={isConfirmFoodRoute ? "hidden md:block" : undefined}>
              <Header />
            </div>
          )}
          <Toaster position={isMobile ? "bottom-center" : "top-center"} />
          <Outlet />
        </div>
        {!isAuthRoute && (
          <div className={isConfirmFoodRoute ? "hidden md:block" : undefined}>
            <Footer />
          </div>
        )}
      </div>
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "TanStack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </TooltipProvider>
  );

  return isAuthRoute ? content : <SessionRestorationGate>{content}</SessionRestorationGate>;
}

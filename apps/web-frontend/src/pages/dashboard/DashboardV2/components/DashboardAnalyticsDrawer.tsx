import type { NutrientAnalyticsModel } from "#/verticals/dashboard/dashboard-v2-model.ts";
import type { RefObject } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "#/shared/components/base/drawer.tsx";
import { useIsMobile } from "#/shared/hooks/use-media-query.ts";

import { NutrientAnalytics } from "./NutrientAnalytics.tsx";

type DashboardAnalyticsDrawerProps = {
  model: NutrientAnalyticsModel | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
};

function DashboardAnalyticsDrawer({ model, onClose, returnFocusRef }: DashboardAnalyticsDrawerProps) {
  const isMobile = useIsMobile();

  return (
    <Drawer
      direction={isMobile ? "bottom" : "right"}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={model !== null}
    >
      <DrawerContent
        className="h-[80vh] w-full bg-surface-container-low md:h-full md:max-w-[28rem]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <DrawerHeader className="sr-only">
          <DrawerTitle>{model ? `${model.title} analytics` : "Nutrient analytics"}</DrawerTitle>
          <DrawerDescription>
            {model
              ? `Total ${model.title.toLowerCase()} summary and food source contributions.`
              : "Nutrient contribution details."}
          </DrawerDescription>
        </DrawerHeader>
        {model ? <NutrientAnalytics key={model.metric} model={model} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

export { DashboardAnalyticsDrawer };
export type { DashboardAnalyticsDrawerProps };

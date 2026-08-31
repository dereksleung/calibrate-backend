// @vitest-environment jsdom

import type { NutrientAnalyticsModel } from "#/verticals/dashboard/dashboard-v2-model.ts";
import type { RefObject } from "react";

import { useIsMobile } from "#/shared/hooks/use-media-query.ts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DashboardAnalyticsDrawer } from "./DashboardAnalyticsDrawer.tsx";

vi.mock("#/shared/hooks/use-media-query.ts", () => ({
  useIsLgAndAbove: () => false,
  useIsMobile: vi.fn(() => false),
  useMediaQuery: () => false,
}));

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => undefined;
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

const caloriesModel: NutrientAnalyticsModel = {
  metric: "calories",
  title: "Calories",
  unit: "kcal",
  total: {
    amount: 150,
    contributions: [{ amount: 150, name: "Oats", share: 1 }],
  },
  change: {
    showInsufficientHistoryBanner: true,
    sections: {
      reductions: [],
      increases: [],
      newFoods: [{ amount: 150, change: "new", name: "Oats" }],
    },
  },
};

afterEach(() => {
  cleanup();
  vi.mocked(useIsMobile).mockReturnValue(false);
});

describe("DashboardAnalyticsDrawer", () => {
  it("opens from the right on desktop and from the bottom on mobile", () => {
    const returnFocusRef: RefObject<HTMLElement | null> = { current: null };
    const { unmount } = render(
      <DashboardAnalyticsDrawer model={caloriesModel} onClose={vi.fn()} returnFocusRef={returnFocusRef} />,
    );

    expect(screen.getByRole("dialog", { name: "Calories analytics" })).toBeTruthy();
    expect(
      document.querySelector("[data-vaul-drawer-direction]")?.getAttribute("data-vaul-drawer-direction"),
    ).toBe("right");

    unmount();
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(
      <DashboardAnalyticsDrawer model={caloriesModel} onClose={vi.fn()} returnFocusRef={returnFocusRef} />,
    );

    expect(
      document.querySelector("[data-vaul-drawer-direction]")?.getAttribute("data-vaul-drawer-direction"),
    ).toBe("bottom");
  });
});

import type { ReactNode } from "react";

import { cn } from "#/lib/utils";
import { Card } from "#/shared/components/base/Card.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#/shared/components/base/drawer.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { useIsMobile } from "#/shared/hooks/use-media-query.ts";
import { ArrowLeftRight, EyeOff, Lightbulb } from "lucide-react";

const smartSwaps = [
  "Swap whole milk for almond milk in your coffee to save 50cal.",
  "Replace mayo with Greek yogurt in your sandwich for 90cal savings.",
];

type TipCardProps = {
  children: ReactNode;
  className?: string;
};

const fruitBackground = (
  <svg
    aria-hidden="true"
    className="pointer-events-none absolute -right-8 bottom-[-3.25rem] size-44 text-primary-fixed opacity-25"
    fill="none"
    viewBox="0 0 176 176"
  >
    <path className="fill-current" d="M98 51c-1-22 13-36 35-35 1 23-13 36-35 35Z" />
    <path className="stroke-current" d="M101 56c8-21 20-31 36-36" strokeLinecap="round" strokeWidth="14" />
    <circle className="stroke-current" cx="78" cy="106" r="51" strokeWidth="14" />
  </svg>
);

export const SmartSwap = ({ children, className }: TipCardProps) => (
  <div className={cn("rounded-3xl border-l-4 border-primary bg-card px-5 py-4 shadow-sm", className)}>
    <Typography as="p" color="onSurface" className="text-lg leading-7">
      {children}
    </Typography>
  </div>
);

export const HiddenContributor = ({ children, className }: TipCardProps) => (
  <div
    className={cn(
      "rounded-3xl border border-outline-variant bg-surface-container-low px-6 py-5 shadow-sm",
      className,
    )}
  >
    <Typography as="p" color="onSurface" className="text-lg leading-8 italic">
      {children}
    </Typography>
  </div>
);

export const PrimaryBgTipCard = ({ children, className }: TipCardProps) => (
  <div
    className={cn(
      "relative flex min-h-40 flex-col justify-end overflow-hidden rounded-3xl border border-primary-fixed/20 bg-radial from-primary/87 to-primary p-6 text-on-primary",
      className,
    )}
  >
    {fruitBackground}
    <Typography
      as="p"
      color="inherit"
      weight="light"
      className="relative z-10 max-w-[17rem] text-base leading-6"
    >
      {children}
    </Typography>
  </div>
);

export const HighImpactSwap = () => {
  const isMobile = useIsMobile();
  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <Card
        className="relative overflow-hidden rounded-radius-sm bg-primary p-4 text-white lg:p-8 gap-4"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {fruitBackground}
        <div className="relative z-10 flex gap-3 text-on-primary-container">
          <ArrowLeftRight className="mt-1" />
          <Typography as="h2" variant="cardTitle" color="onPrimaryContainer" className="self-start">
            High-Impact Swap
          </Typography>
        </div>
        {/* TODO: Make text dynamic.
          Just showing judgment presenting the most important metrics and data for a normal user trying to stay on track
          with new habits and weight loss for now. */}
        <Typography as="p" color="inherit" size="sm" weight="light" className="relative z-10">
          Reducing your snack almonds by 20g would save 80cal.
        </Typography>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="relative z-10 mt-auto flex cursor-pointer items-center gap-2 pt-4 text-left text-white hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/30"
          >
            <Typography as="span" color="inherit" weight="medium" size="sm">
              Learn More
            </Typography>
            <Lightbulb className="size-4" />
          </button>
        </DrawerTrigger>
      </Card>
      <DrawerContent>
        <DrawerHeader className="gap-2 px-6 pt-8 pb-4 text-left">
          <DrawerTitle className="font-heading text-3xl font-normal text-primary">
            High-Impact Tips
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Personalized guidance based on your recent logs.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-9 overflow-y-auto px-6 pb-8">
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-primary mt-4">
              <ArrowLeftRight className="size-5" />
              <Typography as="h3" variant="capsCardTitle" color="primary">
                Smart Swaps
              </Typography>
            </div>

            <div className="flex flex-col gap-4">
              {smartSwaps.map((swap) => (
                <SmartSwap key={swap}>{swap}</SmartSwap>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-on-surface">
              <EyeOff className="size-5" />
              <Typography as="h3" variant="capsCardTitle" color="onSurface">
                Hidden Contributors
              </Typography>
            </div>

            <HiddenContributor>
              "Cooking oils and dressings added an average of <span className="font-bold">250kcal</span> to
              your dinners this week."
            </HiddenContributor>
          </section>

          <PrimaryBgTipCard>
            Tip: Using an oil sprayer can reduce fat intake by up to 15g per meal.
          </PrimaryBgTipCard>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

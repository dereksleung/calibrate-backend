import { cn } from "#/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const typographyVariants = cva("", {
  variants: {
    variant: {
      display: "font-heading text-[2.5rem] leading-[3rem] tracking-[-0.02em] font-[300] text-balance",
      headline: "font-headline-md text-[1.5rem] leading-[2rem] tracking-[-0.01em] font-[400] text-balance",
      headlineLg:
        "font-headline-lg-mobile text-[1.5rem] leading-[2rem] tracking-[-0.01em] font-[400] text-balance lg:font-headline-lg lg:text-[2.5rem] lg:leading-[3rem] lg:tracking-[-0.02em] lg:font-[300]",
      body: "font-sans text-[1rem] leading-[1.5rem] font-[300]",
      bodyLg: "font-sans text-[1.125rem] leading-[1.75rem] font-[300]",
      label: "font-sans text-[0.75rem] leading-[1rem] tracking-[0.05em] font-[500] uppercase",
      labelSpaced: "font-sans text-[0.75rem] leading-[1rem] tracking-[0.24em] font-[500] uppercase",
      labelMd: "font-sans text-[0.875rem] leading-[1.15rem] tracking-[0.05em] font-[500]",
      capsCardTitle: "text-sm font-medium uppercase tracking-[0.10em] md:text-base",
      cardTitle: "font-heading font-semibold text-lg",
    },
    color: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      primary: "text-primary",
      destructive: "text-destructive",

      // From Tailwind v4 @theme tokens
      onBackground: "text-on-background",
      onError: "text-on-error",
      onErrorContainer: "text-on-error-container",
      onPrimary: "text-on-primary",
      onPrimaryContainer: "text-on-primary-container",
      onPrimaryFixed: "text-on-primary-fixed",
      onPrimaryFixedVariant: "text-on-primary-fixed-variant",
      onSecondary: "text-on-secondary",
      onSecondaryContainer: "text-on-secondary-container",
      onSecondaryFixed: "text-on-secondary-fixed",
      onSecondaryFixedVariant: "text-on-secondary-fixed-variant",
      onSurface: "text-on-surface",
      onSurfaceVariant: "text-on-surface-variant",
      onTertiary: "text-on-tertiary",
      onTertiaryContainer: "text-on-tertiary-container",
      onTertiaryFixed: "text-on-tertiary-fixed",
      onTertiaryFixedVariant: "text-on-tertiary-fixed-variant",

      // Related "on" semantic token from the inverse surface pair
      inverseOnSurface: "text-inverse-on-surface",

      inherit: "text-inherit",
    },
    size: {
      lg: "text-lg",
      md: "text-md",
      sm: "text-sm",
    },
    weight: {
      light: "font-light",
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    variant: "body",
    color: "default",
  },
});

type TypographyOwnProps<TElement extends React.ElementType> = VariantProps<typeof typographyVariants> & {
  as?: TElement;
  className?: string;
};

type TypographyProps<TElement extends React.ElementType> = TypographyOwnProps<TElement> &
  Omit<React.ComponentPropsWithoutRef<TElement>, keyof TypographyOwnProps<TElement> | "color">;

/**
 * This component is intended as a design-system primitive to make calling for specific repeated
 * text styles more semantic, and deduplicated, rather than needing to remember class name recipes.
 *
 * It should only own limited areas of text appearance, such as repeated semantic variants, colors, weights and sizes
 * in the design system, and not margins, layout, or spacing. Adding margins/layouts/spacing makes it hard
 * to compose with other components in parent views.
 *
 * It should not own all possible CSS text styles, which would cause prop sprawl
 * and make the component a second styling language. Using Tailwind className overrides for one-offs and
 * styling not represented in the current design system is simpler and easier to follow,
 * such as for one-offs and responsive tweaks.
 */
const Typography = <TElement extends React.ElementType = "p">({
  as,
  variant,
  size,
  weight,
  color,
  className,
  ...props
}: TypographyProps<TElement>) => {
  const Component = as ?? "p";

  return (
    <Component
      data-slot="typography"
      className={cn(typographyVariants({ variant, color, size, weight, className }))}
      {...props}
    />
  );
};

export { Typography, typographyVariants };

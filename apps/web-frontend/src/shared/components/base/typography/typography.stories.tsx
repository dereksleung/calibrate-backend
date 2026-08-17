import type { Meta, StoryObj } from "@storybook/react-vite";

import "../../../../styles.css";
import { Typography } from "./Typography";

const variants = [
  "display",
  "headline",
  "headlineLg",
  "body",
  "bodyLg",
  "label",
  "labelMd",
  "labelSpaced",
  "capsCardTitle",
] as const;

const colors = [
  "default",
  "muted",
  "primary",
  "destructive",
  "onBackground",
  "onError",
  "onErrorContainer",
  "onPrimary",
  "onPrimaryContainer",
  "onPrimaryFixed",
  "onPrimaryFixedVariant",
  "onSecondary",
  "onSecondaryContainer",
  "onSecondaryFixed",
  "onSecondaryFixedVariant",
  "onSurface",
  "onSurfaceVariant",
  "onTertiary",
  "onTertiaryContainer",
  "onTertiaryFixed",
  "onTertiaryFixedVariant",
  "inverseOnSurface",
  "inherit",
] as const;

const semanticElements = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"] as const;

type TypographyColor = (typeof colors)[number];

const colorSurfaces: Record<TypographyColor, string> = {
  default: "bg-background",
  muted: "bg-background",
  primary: "bg-background",
  destructive: "bg-background",
  onBackground: "bg-background",
  onError: "bg-error",
  onErrorContainer: "bg-error-container",
  onPrimary: "bg-primary",
  onPrimaryContainer: "bg-primary-container",
  onPrimaryFixed: "bg-primary-fixed",
  onPrimaryFixedVariant: "bg-primary-fixed",
  onSecondary: "bg-secondary",
  onSecondaryContainer: "bg-secondary-container",
  onSecondaryFixed: "bg-secondary-fixed",
  onSecondaryFixedVariant: "bg-secondary-fixed",
  onSurface: "bg-surface",
  onSurfaceVariant: "bg-surface-variant",
  onTertiary: "bg-tertiary",
  onTertiaryContainer: "bg-tertiary-container",
  onTertiaryFixed: "bg-tertiary-fixed",
  onTertiaryFixedVariant: "bg-tertiary-fixed",
  inverseOnSurface: "bg-inverse-surface",
  inherit: "bg-background text-foreground",
};

const sampleText = "Calibrate typography";

const meta = {
  title: "Base/Typography",
  component: Typography,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    as: {
      control: "select",
      options: semanticElements,
    },
    variant: {
      control: "select",
      options: variants,
    },
    color: {
      control: "select",
      options: colors,
    },
    children: {
      control: "text",
    },
  },
  args: {
    as: "p",
    variant: "body",
    color: "default",
    children: sampleText,
  },
} satisfies Meta<typeof Typography>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-6">
      {variants.map((variant) => (
        <div key={variant} className="flex flex-col gap-2">
          <Typography as="span" variant="label" color="muted">
            {variant}
          </Typography>
          <Typography variant={variant}>{sampleText}</Typography>
        </div>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {colors.map((color) => (
        <div
          key={color}
          className={`${colorSurfaces[color]} flex min-h-24 flex-col justify-between gap-4 rounded-lg border border-border p-4`}
        >
          <Typography variant="label" color={color}>
            {color}
          </Typography>
          <Typography variant="body" color={color}>
            {sampleText}
          </Typography>
        </div>
      ))}
    </div>
  ),
};

export const VariantColorMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {colors.map((color) => (
        <section key={color} className="flex flex-col gap-3">
          <Typography as="h2" variant="headline">
            {color}
          </Typography>
          <div className={`${colorSurfaces[color]} flex flex-col gap-4 rounded-lg border border-border p-4`}>
            {variants.map((variant) => (
              <Typography key={variant} variant={variant} color={color}>
                {variant}: {sampleText}
              </Typography>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

export const SemanticElements: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-5">
      <Typography as="h1" variant="display">
        h1 rendered with display styling
      </Typography>
      <Typography as="h2" variant="headline">
        h2 rendered with headline styling
      </Typography>
      <Typography as="h3" variant="bodyLg">
        h3 rendered with bodyLg styling
      </Typography>
      <Typography as="p" variant="body">
        Paragraph rendered with body styling.
      </Typography>
      <Typography as="span" variant="label" color="muted">
        Span rendered with label styling
      </Typography>
    </div>
  ),
};

---
name: Calorie Tracker System
colors:
  surface: "#f9f9f9"
  surface-dim: "#dadada"
  surface-bright: "#f9f9f9"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f3f3f4"
  surface-container: "#eeeeee"
  surface-container-high: "#e8e8e8"
  surface-container-highest: "#e2e2e2"
  on-surface: "#1a1c1c"
  on-surface-variant: "#434840"
  inverse-surface: "#2f3131"
  inverse-on-surface: "#f0f1f1"
  outline: "#73796f"
  outline-variant: "#c3c8bd"
  surface-tint: "#496640"
  primary: "#334f2b"
  on-primary: "#ffffff"
  primary-container: "#4a6741"
  on-primary-container: "#c2e4b4"
  inverse-primary: "#afd0a1"
  secondary: "#5c5f5f"
  on-secondary: "#ffffff"
  secondary-container: "#e1e3e3"
  on-secondary-container: "#626565"
  tertiary: "#434947"
  on-tertiary: "#ffffff"
  tertiary-container: "#5b615e"
  on-tertiary-container: "#d6dcd8"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#caecbc"
  primary-fixed-dim: "#afd0a1"
  on-primary-fixed: "#062104"
  on-primary-fixed-variant: "#324e2a"
  secondary-fixed: "#e1e3e3"
  secondary-fixed-dim: "#c5c7c7"
  on-secondary-fixed: "#191c1c"
  on-secondary-fixed-variant: "#454747"
  tertiary-fixed: "#dee4e0"
  tertiary-fixed-dim: "#c2c8c4"
  on-tertiary-fixed: "#171d1b"
  on-tertiary-fixed-variant: "#424845"
  background: "#f9f9f9"
  on-background: "#1a1c1c"
  surface-variant: "#e2e2e2"
  calories-stone: "#44403C"
  carbs-vibrant-azure: "#4CC9F0"
  protein-vibrant-rose: "#F72585"
  fats-vibrant-violet: "#7209B7"
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: "300"
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: "400"
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "300"
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "300"
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  xxl: 4rem
  gutter: 1.5rem
  margin-safe: 2rem
---

## Brand & Style

The design system is centered on the concept of "Digital Zen." For a calorie tracker, the emotional objective is to reduce the anxiety often associated with data entry and dieting. By utilizing a **Minimalist** design style, the UI removes cognitive load, allowing the user to focus entirely on their nutritional goals without distraction.

The aesthetic is characterized by high-key lighting, generous whitespace, and a reductionist approach to UI chrome. It avoids heavy lines or aggressive calls to action, instead favoring a soft, breathable interface that feels more like a wellness journal than a database. The brand personality is calm, encouraging, and clinical yet approachable.

## Colors

The palette is intentionally restrained to promote a sense of cleanliness and purity.

- **Primary (Forest Green):** A soft, desaturated green used exclusively for progress indicators, success states, and primary action accents. It represents growth and vitality.
- **Secondary (Light Gray):** Used for subtle backgrounds and grouping elements to differentiate from the pure white canvas.
- **Neutral/Background:** A foundation of pure white (#FFFFFF) to maximize the "airy" feel.
- **Typography:** Deep charcoal is used instead of pure black to maintain a soft contrast that is easier on the eyes during frequent logging.

## Typography

This design system utilizes a pairing of **Manrope** for headings and **Inter** for functional text. The hierarchy relies on size and negative space rather than heavy weights.

- **Light Weights:** Headlines should predominantly use Light (300) or Regular (400) weights to maintain the minimalist aesthetic.
- **Clarity:** Tracking is slightly tightened on large displays and opened up on small labels to ensure legibility despite the light font weights.
- **Case:** Labels should use sentence case or occasionally all-caps with increased letter-spacing for secondary metadata.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy within a fluid container, prioritizing "generous breathing room."

- **Rhythm:** An 8px linear scale is used, but the system leans toward the higher end of the scale (24px+) for container padding.
- **Negative Space:** Content blocks are separated by significant vertical margins (40px-64px) to prevent the UI from feeling cluttered with data.
- **Alignment:** Centralized layouts are preferred for dashboard views to maintain a focused, intentional user path.

## Elevation & Depth

To maintain a "flat-plus" appearance, depth is conveyed through **Ambient Shadows** and **Tonal Layers** rather than traditional elevation.

- **Shadows:** Use extremely diffused, low-opacity shadows (Opacity: 4-6%) with a large blur radius (20px-40px) and a slight Y-axis offset. This makes cards appear to float gently above the surface.
- **Layering:** Backgrounds should stay at the lowest tier, with cards on the first elevation. Overlays or modals use a slightly more pronounced shadow but maintain the same soft character.
- **Zero Borders:** Avoid harsh borders; use subtle shifts in background color (White to Very Light Gray) to define boundaries.

## Shapes

The design system uses a **Rounded** shape language to evoke a friendly, organic feel.

- **Corner Radii:** Standard cards and containers use a 1rem (16px) radius.
- **Interactive Elements:** Buttons and input fields follow a 0.5rem (8px) radius to feel slightly more precise than the larger containers.
- **Progress Bars:** These should utilize fully rounded caps (pill-shaped) to represent fluidity and flow.

## Components

- **Subtle Cards:** The primary container for daily summaries. Cards are white with no border and a soft, expansive shadow. Padding inside cards should be at least 24px.
- **Icon Buttons:** Simple, monochrome glyphs. Use thin-stroke icons (1px or 1.5px weight) to match the light typography. Backgrounds for icon buttons should be transparent or a very pale gray wash.
- **Progress Bars:** Sleek, thin tracks. The background of the track is a very light gray (#F3F4F6), while the fill is the Forest Green. For over-budget states, use a soft terracotta rather than a bright red to maintain the calm palette.
- **Inputs:** Minimalist fields with only a bottom border or a very soft, filled background. Focus states are indicated by a gentle shift in the Forest Green accent.
- **Chips:** Small, rounded-pill labels used for food categories or macro tags. These should have a low-contrast background and subtle text.
- **Daily Logs:** List items with high vertical padding and light dividers (1px, #F0F0F0) to ensure the list feels airy even when populated with many entries.

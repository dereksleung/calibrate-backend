import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display-lg",
        "headline-md",
        "headline-lg",
        "headline-lg-mobile",
        "body-md",
        "body-lg",
        "label-sm",
        "label-md",
        "caps-card-title",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

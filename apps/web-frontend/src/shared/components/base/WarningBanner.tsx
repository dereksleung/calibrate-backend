import type * as React from "react";

import { cn } from "#/lib/utils";
import { CircleAlert } from "lucide-react";

const DEFAULT_WARNING = "Invalid email or password. Please try again.";

function WarningBanner({ className, children = DEFAULT_WARNING, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="alert"
      data-slot="warning-banner"
      className={cn(
        "flex items-start gap-sm rounded-full bg-error-container/80 px-md py-sm font-label-sm text-xs leading-5 text-on-error-container",
        className,
      )}
      {...props}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{children}</span>
    </div>
  );
}

export { WarningBanner };

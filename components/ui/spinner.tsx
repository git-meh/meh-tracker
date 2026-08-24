import { LoaderIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("animate-spin", className)}
      {...props}
    />
  );
}

export function SpinnerCustom({ className }: { className?: string }) {
  return (
    <div className="flex items-center gap-4">
      <Spinner className={className} />
    </div>
  );
}

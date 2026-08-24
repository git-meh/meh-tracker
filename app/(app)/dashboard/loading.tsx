import { Skeleton } from "@/components/ui/skeleton";
import { SpinnerCustom } from "@/components/ui/spinner";

function MetricSkeleton() {
  return (
    <div className="rounded-lg border bg-background p-3 px-5">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-4 h-6 w-12" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      className="space-y-7 overflow-hidden"
    >
      <span className="sr-only">Loading dashboard...</span>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>

        <Skeleton className="h-10 w-34 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
      <div className="grid grid-cols-5 gap-6">
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="space-y-2 rounded-lg border bg-background p-4"
          >
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
      <div className="flex h-64 w-full items-center justify-center">
        <SpinnerCustom className="size-6" />
      </div>
    </div>
  );
}

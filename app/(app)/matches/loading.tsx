import { Skeleton } from "@/components/ui/skeleton";

export default function MatchesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading recommended jobs"
      className="space-y-7"
    >
      <span className="sr-only">Loading recommended jobs...</span>

      <header className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-4xl" />
        </div>

        <Skeleton className="h-12 w-44 shrink-0 rounded-md" />
      </header>

      <section className="flex min-h-80 items-center justify-center rounded-lg border bg-background p-8 shadow-sm">
        <div className="flex w-full max-w-lg flex-col items-center space-y-5 text-center">
          <Skeleton className="h-7 w-40" />

          <div className="flex w-full flex-col items-center space-y-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <Skeleton className="h-12 w-44 rounded-md" />
            <Skeleton className="h-12 w-44 rounded-md" />
          </div>
        </div>
      </section>
    </div>
  );
}

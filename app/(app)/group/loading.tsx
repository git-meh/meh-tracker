import { Skeleton } from "@/components/ui/skeleton";

const activityWidths = [
  "w-11/12",
  "w-3/4",
  "w-4/5",
  "w-2/3",
  "w-3/4",
  "w-11/12",
  "w-5/6",
  "w-4/5"
];

function ActivitySkeleton({ width }: { width: string }) {
  return (
    <article className="flex gap-4 rounded-lg border bg-background p-5">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />

      <div className="min-w-0 flex-1 space-y-3">
        <Skeleton className={`h-5 max-w-full ${width}`} />

        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </article>
  );
}

export default function GroupLoading() {
  return (
    <div
      role="status"
      aria-label="Loading group feed"
      className="mx-auto max-w-2xl space-y-6"
    >
      <span className="sr-only">Loading group feed...</span>

      <header className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-48" />
      </header>

      <section aria-label="Loading group activity" className="space-y-3">
        {activityWidths.map((width, index) => (
          <ActivitySkeleton key={index} width={width} />
        ))}
      </section>
    </div>
  );
}

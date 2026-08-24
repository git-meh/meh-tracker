import { Skeleton } from "@/components/ui/skeleton";

const paragraphWidths = [
  "w-3/5",
  "w-full",
  "w-11/12",
  "w-full",
  "w-4/5",
  "w-full",
  "w-10/12",
  "w-11/12",
  "w-3/4"
];

export default function JobDetailsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading job details"
      className="mx-auto max-w-3xl space-y-6"
    >
      <span className="sr-only">Loading job details...</span>

      <Skeleton className="h-6 w-36" />

      <article className="rounded-xl border bg-background p-6 shadow-sm sm:p-8 lg:p-12">
        <header className="space-y-8">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1 space-y-4">
              <Skeleton className="h-10 w-4/5 max-w-xl sm:h-12" />
              <Skeleton className="h-7 w-32 sm:h-8" />
            </div>

            <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-6 w-56" />
          </div>

          <Skeleton className="h-8 w-20 rounded-full" />

          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-36 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </header>

        <section className="mt-12 space-y-8">
          <Skeleton className="h-10 w-52 sm:h-12" />

          <div className="space-y-4">
            <Skeleton className="h-6 w-3/5" />
          </div>

          <div className="space-y-4">
            {paragraphWidths.slice(0, 4).map((width, index) => (
              <Skeleton key={index} className={`h-5 ${width}`} />
            ))}
          </div>

          <div className="space-y-4">
            {paragraphWidths.slice(4, 7).map((width, index) => (
              <Skeleton key={index} className={`h-5 ${width}`} />
            ))}
          </div>

          <div className="space-y-4">
            {paragraphWidths.slice(7).map((width, index) => (
              <Skeleton key={index} className={`h-5 ${width}`} />
            ))}
          </div>

          <Skeleton className="h-6 w-3/4" />

          <div className="space-y-5 pt-6">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        </section>
      </article>
    </div>
  );
}

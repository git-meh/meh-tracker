import { Skeleton } from "@/components/ui/skeleton";

function JobCardSkeleton() {
  return (
    <article className="space-y-4 rounded-lg border bg-background p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-24" />
        </div>

        <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
      </header>

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-20" />
      </div>

      <Skeleton className="h-7 w-20 rounded-full" />

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-14 rounded-full" />
      </div>

      <footer className="flex items-center justify-between gap-3 pt-1">
        <div className="flex gap-2">
          <Skeleton className="h-11 w-44 rounded-md" />
          <Skeleton className="h-11 w-24 rounded-md" />
        </div>

        <Skeleton className="h-11 w-24 rounded-md" />
      </footer>
    </article>
  );
}

function FilterSkeleton({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-12 rounded-md ${className}`} />;
}

export default function JobsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading jobs"
      className="space-y-7 overflow-hidden"
    >
      <span className="sr-only">Loading jobs...</span>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>

        <div className="hidden gap-3 sm:flex">
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </header>

      <section
        aria-label="Loading job filters"
        className="space-y-4 rounded-lg border bg-background p-5"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26%]">
          <FilterSkeleton />
          <FilterSkeleton />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[repeat(5,minmax(0,1fr))_160px_170px]">
          <FilterSkeleton />
          <FilterSkeleton />
          <FilterSkeleton />
          <FilterSkeleton />
          <FilterSkeleton />
          <FilterSkeleton />
          <FilterSkeleton />
        </div>
      </section>

      <section
        aria-label="Loading job listings"
        className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3"
      >
        {Array.from({ length: 9 }).map((_, index) => (
          <JobCardSkeleton key={index} />
        ))}
      </section>
    </div>
  );
}

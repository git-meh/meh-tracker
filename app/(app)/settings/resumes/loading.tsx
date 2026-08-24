import { Skeleton } from "@/components/ui/skeleton";

function ResumeSkeleton({ isDefault = false }: { isDefault?: boolean }) {
  return (
    <article className="flex items-center gap-4 rounded-lg border bg-background p-5 shadow-sm">
      <Skeleton className="h-10 w-8 shrink-0 rounded-sm" />

      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-4/5 max-w-lg" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="hidden items-center gap-5 sm:flex">
        {isDefault ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <Skeleton className="h-6 w-6 rounded-full" />
        )}

        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-6 w-6" />
      </div>
    </article>
  );
}

export default function ResumesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading CVs"
      className="mx-auto w-full max-w-2xl space-y-7"
    >
      <span className="sr-only">Loading CVs...</span>

      <header className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </header>

      <section
        aria-label="Loading CV upload area"
        className="flex h-44 items-center justify-center rounded-lg border-2 border-dashed"
      >
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </section>

      <section aria-label="Loading saved CVs" className="space-y-3">
        <ResumeSkeleton />
        <ResumeSkeleton isDefault />
      </section>
    </div>
  );
}

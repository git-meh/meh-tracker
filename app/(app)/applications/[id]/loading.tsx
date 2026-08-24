import { Skeleton } from "@/components/ui/skeleton";

function DetailRowSkeleton({
  labelWidth = "w-20",
  valueWidth = "w-44"
}: {
  labelWidth?: string;
  valueWidth?: string;
}) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-4">
      <Skeleton className={`h-4 ${labelWidth}`} />
      <Skeleton className={`h-5 max-w-full ${valueWidth}`} />
    </div>
  );
}

export default function ApplicationDetailsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading application details"
      className="mx-auto max-w-2xl space-y-6"
    >
      <span className="sr-only">Loading application details...</span>

      <nav className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-24" />
      </nav>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-5 w-24" />
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-11 w-32 rounded-md" />
        </div>
      </header>

      <section className="space-y-7">
        <article className="space-y-8 rounded-lg border bg-background p-7 shadow-sm">
          <Skeleton className="h-6 w-44" />

          <div className="space-y-5">
            <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-12 w-60 max-w-full rounded-md" />
            </div>

            <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-4">
              <Skeleton className="h-4 w-16" />

              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-14 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>

            <DetailRowSkeleton labelWidth="w-16" valueWidth="w-64" />
            <DetailRowSkeleton labelWidth="w-14" valueWidth="w-20" />
            <DetailRowSkeleton labelWidth="w-20" valueWidth="w-56" />
          </div>
        </article>

        <article className="space-y-7 rounded-lg border bg-background p-7 shadow-sm">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-5 w-3/4" />
        </article>

        <article className="space-y-7 rounded-lg border bg-background p-7 shadow-sm">
          <Skeleton className="h-6 w-40" />

          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        </article>

        <article className="space-y-7 rounded-lg border bg-background p-7 shadow-sm">
          <Skeleton className="h-6 w-36" />

          <div className="space-y-3">
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </article>
      </section>
    </div>
  );
}

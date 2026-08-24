import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading settings"
      className="mx-auto max-w-2xl space-y-6"
    >
      <span className="sr-only">Loading settings...</span>

      <header>
        <Skeleton className="h-8 w-32" />
      </header>

      <section className="space-y-7">
        <article className="space-y-8 rounded-lg border bg-background p-7 shadow-sm">
          <Skeleton className="h-6 w-20" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-36" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-52" />
            </div>
          </div>
        </article>

        <article className="space-y-8 rounded-lg border bg-background p-7 shadow-sm">
          <Skeleton className="h-6 w-24" />

          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-14 rounded-full" />
            <Skeleton className="h-5 w-80 max-w-[70%]" />
          </div>
        </article>

        <article className="space-y-8 rounded-lg border bg-background p-7 shadow-sm">
          <Skeleton className="h-6 w-20" />

          <div className="flex items-center justify-between gap-4 rounded-md border p-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>

            <Skeleton className="h-6 w-6 shrink-0" />
          </div>
        </article>
      </section>

      <footer className="flex flex-wrap gap-3 border-t pt-7">
        <Skeleton className="h-12 w-44 rounded-md" />
        <Skeleton className="h-12 w-40 rounded-md" />
      </footer>
    </div>
  );
}

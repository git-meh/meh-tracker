import { Skeleton } from "@/components/ui/skeleton";

function ApplicationRowSkeleton() {
  return (
    <tr className="border-b last:border-0">
      <td className="px-5 py-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      </td>

      <td className="px-5 py-5">
        <Skeleton className="h-7 w-24 rounded-full" />
      </td>

      <td className="px-5 py-5">
        <Skeleton className="h-7 w-24 rounded-full" />
      </td>

      <td className="px-5 py-5">
        <Skeleton className="h-4 w-28" />
      </td>

      <td className="px-5 py-5">
        <Skeleton className="h-4 w-16" />
      </td>
    </tr>
  );
}

function ApplicationCardSkeleton() {
  return (
    <article className="space-y-4 rounded-lg border bg-background p-5">
      <header className="space-y-2">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-1/3" />
      </header>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      <footer className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-16" />
      </footer>
    </article>
  );
}

export default function ApplicationsLoading() {
  return (
    <div role="status" aria-label="Loading applications" className="space-y-7">
      <span className="sr-only">Loading applications...</span>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-28" />
        </div>

        <Skeleton className="h-12 w-full rounded-md sm:w-96" />
      </header>

      <section
        aria-label="Loading application list"
        className="hidden overflow-hidden rounded-lg border bg-background md:block"
      >
        <table className="w-full table-fixed text-left">
          <thead className="border-b bg-muted/20">
            <tr>
              <th className="w-[44%] px-5 py-4">
                <Skeleton className="h-4 w-10" />
              </th>
              <th className="w-[12%] px-5 py-4">
                <Skeleton className="h-4 w-14" />
              </th>
              <th className="w-[12%] px-5 py-4">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="w-[16%] px-5 py-4">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="w-[16%] px-5 py-4">
                <Skeleton className="h-4 w-14" />
              </th>
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 10 }).map((_, index) => (
              <ApplicationRowSkeleton key={index} />
            ))}
          </tbody>
        </table>
      </section>

      <section
        aria-label="Loading application cards"
        className="space-y-3 md:hidden"
      >
        {Array.from({ length: 7 }).map((_, index) => (
          <ApplicationCardSkeleton key={index} />
        ))}
      </section>
    </div>
  );
}

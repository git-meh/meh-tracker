import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <section
      aria-labelledby="not-found-title"
      className="flex min-h-[60vh] items-center justify-center p-6"
    >
      <div className="w-full max-w-lg rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX aria-hidden="true" className="size-6" />
        </div>

        <p className="mt-5 text-sm font-medium text-muted-foreground">404</p>

        <h1 id="not-found-title" className="mt-1 text-2xl font-semibold">
          Page not found
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, may have moved,
          or is no longer available.
        </p>

        <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>

          <Button asChild>
            <Link href="/jobs">Browse jobs</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

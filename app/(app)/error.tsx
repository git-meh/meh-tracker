"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppErrorProps = {
  error: Error & {
    digest?: string;
  };
  retry: () => void;
};

export default function AppError({ error, retry }: AppErrorProps) {
  const [isRetrying, startTransition] = useTransition();

  useEffect(() => {
    // Replace this with your error-reporting service when configured.
    console.error("Application route error:", error);
  }, [error]);

  function handleRetry() {
    startTransition(() => {
      retry();
    });
  }

  return (
    <section
      role="alert"
      aria-labelledby="application-error-title"
      className="flex min-h-[60vh] items-center justify-center p-6"
    >
      <div className="w-full max-w-lg rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle aria-hidden="true" className="size-6" />
        </div>

        <h1
          id="application-error-title"
          className="mt-5 text-2xl font-semibold"
        >
          Something went wrong
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t load this part of the application. Try fetching the
          latest data again.
        </p>

        {error.digest && (
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            Error reference: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>

          <Button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            aria-busy={isRetrying}
          >
            <RefreshCw
              aria-hidden="true"
              className={isRetrying ? "animate-spin" : undefined}
            />
            {isRetrying ? "Retrying..." : "Try again"}
          </Button>
        </div>
      </div>
    </section>
  );
}

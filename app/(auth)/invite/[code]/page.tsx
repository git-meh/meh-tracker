"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { isInviteFailureReason, type InviteFailureReason } from "@/lib/invites";

type InviteValidation =
  | { status: "loading" }
  | { status: "valid"; inviterFirstName: string | null }
  | {
      status: "invalid";
      reason: InviteFailureReason | "unavailable";
      message: string;
    };

const invalidInviteTitles: Record<InviteFailureReason | "unavailable", string> =
  {
    invalid: "Invalid invite",
    expired: "Invite expired",
    used: "Invite already used",
    unavailable: "Unable to validate invite"
  };

export default function InvitePage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const supabase = createClient();

  const [validation, setValidation] = useState<InviteValidation>({
    status: "loading"
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function validateCode() {
      try {
        const res = await fetch(
          `/api/invites?code=${encodeURIComponent(code)}`,
          { signal: controller.signal }
        );
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.valid) {
          const reason = isInviteFailureReason(data?.reason)
            ? data.reason
            : "invalid";
          setValidation({
            status: "invalid",
            reason,
            message:
              typeof data?.message === "string"
                ? data.message
                : "This invite link is invalid."
          });
          return;
        }

        setValidation({
          status: "valid",
          inviterFirstName:
            typeof data.inviterFirstName === "string"
              ? data.inviterFirstName
              : null
        });
      } catch (validationError) {
        if (
          validationError instanceof Error &&
          validationError.name === "AbortError"
        )
          return;

        setValidation({
          status: "invalid",
          reason: "unavailable",
          message: "We couldn't validate this invite. Please try again."
        });
      }
    }

    validateCode();

    return () => controller.abort();
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (validation.status !== "valid") return;

    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, invite_code: code },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (validation.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Validating invite...</p>
      </div>
    );
  }

  if (validation.status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>{invalidInviteTitles[validation.reason]}</CardTitle>
            <CardDescription>{validation.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to {email}. Confirm your address, then
              sign in to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const inviterName = validation.inviterFirstName ?? "a friend";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl">😑</span>
          <h1 className="mt-2 text-2xl font-bold">meh-tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ve been invited by {inviterName}!
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              You&apos;re joining via an invite link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Join meh-tracker"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

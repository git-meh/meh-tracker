import { Suspense } from "react";
import { SignUpForm } from "./signup-form";
import { SpinnerCustom } from "@/components/ui/spinner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Join Meh Tracker."
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center">
          <SpinnerCustom />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}

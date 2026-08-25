import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { SpinnerCustom } from "@/components/ui/spinner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your account to access Meh Tracker."
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center">
          <SpinnerCustom />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

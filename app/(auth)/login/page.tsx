import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — USMobile POS",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground">
            U
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            USMobile POS
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to your store account
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

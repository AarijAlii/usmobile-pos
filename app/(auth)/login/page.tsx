import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Sign in — USMobile POS",
};

export default function LoginPage() {
  return (
    <div className="ambient-surface relative flex min-h-screen items-center justify-center px-4">
      <ThemeToggle className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" />
      <div className="page-fade-in w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(0,113,227,0.5)]">
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

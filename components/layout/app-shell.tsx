"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Repeat,
  Wrench,
  CalendarClock,
  LogOut,
  Menu,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/app/(auth)/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import type { CurrentStaff } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "Point of Sale", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/layaway", label: "Layaway", icon: CalendarClock },
  { href: "/trade-in", label: "Trade-In", icon: Repeat },
  { href: "/repairs", label: "Repairs", icon: Wrench },
];

function NavLinks({ pathname, scope }: { pathname: string; scope: string }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive ? (
              <motion.div
                layoutId={`nav-active-pill-${scope}`}
                className="absolute inset-0 rounded-xl bg-secondary"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            ) : (
              <span className="absolute inset-0 rounded-xl bg-secondary/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            )}
            <Icon className="relative z-10 h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            <span className="relative z-10">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({
  staff,
  storeName,
  children,
}: {
  staff: CurrentStaff;
  storeName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-background md:flex">
        <div className="flex h-16 items-center gap-2.5 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            U
          </div>
          <span className="text-[15px] font-semibold tracking-tight">
            USMobile POS
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          <NavLinks pathname={pathname} scope="desktop" />
        </nav>

        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-1 rounded-xl">
            <Link
              href="/settings"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-secondary/60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {staff.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{staff.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {storeName} · {staff.role.toLowerCase()}
                </p>
              </div>
            </Link>
            <ThemeToggle className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" />
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/60 px-4 md:hidden">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu" />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-16 items-center gap-2.5 px-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                  U
                </div>
                <span className="text-[15px] font-semibold tracking-tight">
                  USMobile POS
                </span>
              </div>
              <nav className="space-y-1 px-3 py-2">
                <NavLinks pathname={pathname} scope="mobile" />
              </nav>
              <div className="border-t border-border/60 px-3 py-2">
                <Link
                  href="/settings"
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  Settings
                </Link>
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-[15px] font-semibold tracking-tight">
            USMobile POS
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>
        <main className="ambient-surface flex-1 overflow-y-auto">
          {/*
            No exit animation on purpose: this container scrolls
            (overflow-y-auto), and an exiting + entering page both present
            in normal flow at once would stack rather than cross-fade. A
            clean keyed enter animation gives a real "the screen changed"
            feel without that layout jank.
          */}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

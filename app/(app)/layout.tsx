import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireCurrentStaff();

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", staff.storeId ?? "")
    .maybeSingle();

  return (
    <AppShell staff={staff} storeName={store?.name ?? "All stores"}>
      {children}
    </AppShell>
  );
}

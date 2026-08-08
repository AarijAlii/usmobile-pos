import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentStaff {
  id: string;
  email: string;
  fullName: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  organizationId: string;
  storeId: string | null;
}

/**
 * Loads the current staff profile via the RLS-scoped Supabase client — the
 * `staff` row for the signed-in user is fetched through the same client that
 * enforces policies on every other table, so this never sees another org's data.
 */
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id, email, full_name, role, organization_id, store_id")
    .eq("id", user.id)
    .single();

  if (!staff) return null;

  return {
    id: staff.id,
    email: staff.email,
    fullName: staff.full_name,
    role: staff.role,
    organizationId: staff.organization_id,
    storeId: staff.store_id,
  };
}

/** Use in Server Components/layouts that require an authenticated staff member. Middleware already redirects unauthenticated requests, so reaching here without a staff row means provisioning is broken — fail loudly rather than rendering a broken page. */
export async function requireCurrentStaff(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  return staff;
}

export function canManage(staff: Pick<CurrentStaff, "role">): boolean {
  return staff.role === "OWNER" || staff.role === "ADMIN";
}

/** Resolves which store a staff member is currently operating in — OWNER/ADMIN with no storeId default to their org's first store. */
export async function getActiveStoreId(staff: CurrentStaff): Promise<string> {
  if (staff.storeId) return staff.storeId;

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("organization_id", staff.organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!store) redirect("/login");
  return store.id;
}

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client scoped to the current user's session (JWT).
 * This is the ONLY client used for authenticated request-time reads/writes —
 * Postgres RLS policies key off auth.uid(), which only resolves when queries
 * go through this client (or the browser client), never through Prisma at
 * runtime. Prisma is used solely for schema/migrations/seed (see
 * prisma/schema.prisma header comment).
 *
 * Safe to call from Server Components (read-only cookies), Server Actions,
 * and Route Handlers (cookie writes succeed in the latter two).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware refreshes the
            // session instead, so this can be safely ignored.
          }
        },
      },
    },
  );
}

/**
 * Privileged client using the service-role key, which bypasses RLS entirely.
 * Only ever used server-side, and only for the two justified cases:
 *   1. Admin actions with no end-user JWT to forward (e.g. inviting staff).
 *   2. The Stripe webhook handler, which has no user session at all.
 * Never import this into anything reachable from a client-triggered,
 * non-admin request path.
 */
export function createServiceRoleClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

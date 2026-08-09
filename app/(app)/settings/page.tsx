import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DisplayNameForm } from "@/components/settings/display-name-form";
import { PasswordForm } from "@/components/settings/password-form";

export default async function SettingsPage() {
  const staff = await requireCurrentStaff();
  const supabase = await createClient();

  const [{ data: store }, { data: staffRow }] = await Promise.all([
    supabase.from("stores").select("name").eq("id", staff.storeId ?? "").maybeSingle(),
    supabase.from("staff").select("created_at").eq("id", staff.id).single(),
  ]);

  return (
    <div>
      <PageHeader title="Settings" description="Your account and preferences." />
      <div className="mx-auto max-w-lg space-y-6 p-6 md:p-8">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
                {staff.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <p className="font-medium leading-tight">{staff.fullName}</p>
                <p className="text-sm text-muted-foreground">{staff.email}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Badge variant="secondary">{staff.role.toLowerCase()}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {store?.name ?? "All stores"}
                  </span>
                </div>
              </div>
            </div>

            {staffRow?.created_at && (
              <p className="text-xs text-muted-foreground">
                Member since {new Date(staffRow.created_at).toLocaleDateString()}
              </p>
            )}

            <div className="border-t border-border/60 pt-4">
              <DisplayNameForm fullName={staff.fullName} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Password</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

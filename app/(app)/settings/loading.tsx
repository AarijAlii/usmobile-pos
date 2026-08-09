import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div>
      <PageHeader title="Settings" description="Your account and preferences." />
      <div className="mx-auto max-w-lg space-y-6 p-6 md:p-8">
        <Card className="border-border/60">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            <div className="space-y-3 border-t border-border/60 pt-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-full rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-full rounded-full" />
            <Skeleton className="h-8 w-full rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

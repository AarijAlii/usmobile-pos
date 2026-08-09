import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TradeInLoading() {
  return (
    <div>
      <PageHeader
        title="Trade-In / Buy-Back"
        description="Intake a used device, set an offer price, and add it to inventory."
      />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2 md:p-8">
        <Card className="border-border/60">
          <CardContent className="space-y-4 pt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
            <Skeleton className="h-9 w-full rounded-full" />
          </CardContent>
        </Card>
        <Card className="h-fit border-border/60">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

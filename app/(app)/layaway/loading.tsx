import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function LayawayLoading() {
  return (
    <div>
      <PageHeader
        title="Layaway"
        description="Hold a device with a deposit, collect the balance over time."
        action={<Skeleton className="h-8 w-32 rounded-full" />}
      />
      <div className="space-y-4 p-6 md:p-8">
        <div className="flex gap-1">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="ml-4 flex shrink-0 flex-col items-end gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

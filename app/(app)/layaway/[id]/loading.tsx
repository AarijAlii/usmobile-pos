import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LayawayDetailLoading() {
  return (
    <div>
      <PageHeader title={<Skeleton className="h-7 w-56" />} description={<Skeleton className="h-4 w-32" />} />
      <div className="grid grid-cols-1 gap-6 p-6 md:p-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border-border/60">
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-border/60">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-8 w-full rounded-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

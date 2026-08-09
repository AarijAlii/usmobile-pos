import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReceiptLoading() {
  return (
    <div className="mx-auto max-w-lg p-6 md:p-8">
      <Card className="border-border/60">
        <CardHeader className="items-center text-center">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
          <Skeleton className="mt-2 h-5 w-16 rounded-full" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-border/60 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-full" />
        </CardContent>
      </Card>
    </div>
  );
}

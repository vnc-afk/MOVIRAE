import { Skeleton } from "@/components/ui/skeleton";

export function StatsLoading() {
  return (
    <div className="container py-8 space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-10 w-60 rounded-full" />
        <Skeleton className="h-5 w-80 max-w-full rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default StatsLoading;
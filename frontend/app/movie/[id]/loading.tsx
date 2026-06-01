import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-8">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4 rounded-full" />
            <Skeleton className="h-4 w-40 rounded-full" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                <Skeleton className="h-4 w-4/5 rounded-full" />
                <Skeleton className="h-3 w-2/5 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container py-8 space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-10 w-80 rounded-full" />
        <Skeleton className="h-5 w-96 max-w-full rounded-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-5 w-3/5 rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container py-8 space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-10 w-72 rounded-full" />
        <Skeleton className="h-5 w-96 max-w-full rounded-full" />
      </div>

      <div className="space-y-6">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
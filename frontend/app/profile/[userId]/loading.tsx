import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pb-20 md:pb-0">
      <div className="cinema-gradient py-12">
        <div className="container">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-56 rounded-full" />
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-4 w-80 max-w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mt-8 space-y-6">
        <Skeleton className="h-10 w-64 rounded-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
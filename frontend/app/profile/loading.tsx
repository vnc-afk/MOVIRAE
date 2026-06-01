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
              <div className="flex gap-6 pt-2">
                <Skeleton className="h-12 w-20 rounded-2xl" />
                <Skeleton className="h-12 w-20 rounded-2xl" />
                <Skeleton className="h-12 w-20 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mt-8 space-y-6">
        <Skeleton className="h-10 w-80 rounded-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-4/5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
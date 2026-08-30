import { Skeleton } from "@/components/ui/skeleton";

export function GroupDetailLoading() {
  return (
    <div className="pb-20 md:pb-0">
      <div className="cinema-gradient py-12">
        <div className="container">
          <div className="space-y-4">
            <Skeleton className="h-10 w-72 rounded-full" />
            <Skeleton className="h-5 w-96 max-w-full rounded-full" />
            <div className="flex flex-wrap gap-3 pt-2">
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mt-8 space-y-6">
        <Skeleton className="h-10 w-80 rounded-full" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-[420px] w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default GroupDetailLoading;
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container py-8 space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-5 w-96 max-w-full rounded-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[520px] w-full rounded-2xl" />
        <Skeleton className="h-[520px] w-full rounded-2xl" />
      </div>
    </div>
  );
}
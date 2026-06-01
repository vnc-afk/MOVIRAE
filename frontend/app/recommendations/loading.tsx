import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container py-8 space-y-10">
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-4">
          <Skeleton className="h-6 w-56 rounded-full" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, cardIndex) => (
              <div key={cardIndex} className="min-w-[180px] max-w-[240px] flex-1 space-y-3">
                <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                <Skeleton className="h-4 w-4/5 rounded-full" />
                <Skeleton className="h-3 w-2/5 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
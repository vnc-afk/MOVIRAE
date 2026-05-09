"use client";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { CastMember } from "@/data/mockData";

interface CastCarouselProps {
  cast: CastMember[];
}

export function CastCarousel({ cast }: CastCarouselProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4">
        {cast.map((member) => (
          <div
            key={member.name}
            className="flex flex-col items-center gap-2 min-w-[100px] hover-lift cursor-pointer"
          >
            <img
              src={member.avatar}
              alt={member.name}
              className="h-16 w-16 rounded-full bg-muted border-2 border-border"
            />
            <div className="text-center">
              <p className="text-xs font-medium text-foreground truncate max-w-[90px]">
                {member.name}
              </p>
              <p className="text-[10px] text-muted-foreground">{member.role}</p>
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import type { RecommendationSectionConfig } from "../lib/types";

interface RecommendationSectionProps {
  config: RecommendationSectionConfig;
  active: boolean;
}

/**
 * Renders one recommendation carousel section and handles its infinite-scroll pagination behavior.
 */
export const RecommendationSection = memo(function RecommendationSection({ config, active }: RecommendationSectionProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const items = config.initialItems;

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    const updateScrollState = () => {
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
    };

    updateScrollState();
    carouselApi.on("select", updateScrollState);
    carouselApi.on("reInit", updateScrollState);

    return () => {
      carouselApi.off("select", updateScrollState);
      carouselApi.off("reInit", updateScrollState);
    };
  }, [carouselApi]);

  const handleNext = useCallback(() => {
    if (!carouselApi || isAnimating) {
      return;
    }

    setIsAnimating(true);

    if (carouselApi.canScrollNext()) {
      carouselApi.scrollNext();
    } else {
      carouselApi.scrollTo(0);
    }

    window.setTimeout(() => setIsAnimating(false), 350);
  }, [carouselApi, isAnimating]);

  const handlePrev = useCallback(() => {
    if (!carouselApi || isAnimating) {
      return;
    }

    setIsAnimating(true);
    carouselApi.scrollPrev();
    window.setTimeout(() => setIsAnimating(false), 350);
  }, [carouselApi, isAnimating]);

  const showEndNote = items.length > 0 && !canScrollNext;
  const previousButtonDisabled = !canScrollPrev || isAnimating;
  const nextButtonDisabled = (!canScrollNext && items.length <= 1) || isAnimating;

  return (
    <section id={config.key} className={active ? "space-y-5" : "space-y-5 opacity-90"}>
      <div className="flex items-center gap-2 mb-5">
        <config.icon className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">{config.title}</h2>
      </div>

      <div className="relative">
        <Carousel setApi={setCarouselApi} className="w-full">
          <CarouselContent className="-ml-4">
            {items.map((movie, index) => (
              <CarouselItem
                key={movie.id}
                className="pl-4 basis-[70%] sm:basis-[46%] md:basis-[32%] lg:basis-[23%]"
              >
                <MovieCard movie={movie} index={index} priority={config.priority && index < 4} />
              </CarouselItem>
            ))}

            {showEndNote ? (
              <CarouselItem className="pl-4 basis-[70%] sm:basis-[46%] md:basis-[32%] lg:basis-[23%]">
                <button
                  type="button"
                  onClick={() => {
                    if (isAnimating || !carouselApi) {
                      return;
                    }

                    setIsAnimating(true);
                    carouselApi.scrollTo(0);
                    window.setTimeout(() => setIsAnimating(false), 350);
                  }}
                  className="group block w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 p-3 text-left shadow-sm transition hover:border-primary/60 hover:bg-muted/50"
                >
                  <div className="aspect-[2/3] rounded-lg bg-gradient-to-br from-muted via-muted/80 to-background/90 p-4">
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <div className="mb-2 rounded-full bg-background/70 p-2 text-primary">
                        <ArrowRight className="h-4 w-4 rotate-180" />
                      </div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        End of list
                      </p>
                      <p className="mt-2 text-sm text-foreground/90">
                        You’ve seen all the picks here.
                      </p>
                    </div>
                  </div>
                </button>
              </CarouselItem>
            ) : null}
          </CarouselContent>
        </Carousel>

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handlePrev}
          disabled={previousButtonDisabled}
          className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Previous movies</span>
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleNext}
          disabled={nextButtonDisabled}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-sm"
        >
          <ArrowRight className="h-4 w-4" />
          <span className="sr-only">Next movies</span>
        </Button>
      </div>
    </section>
  );
});
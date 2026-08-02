"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import type { RecommendationSectionConfig } from "../lib/types";
import { useRecommendationsDedup } from "../hooks/useRecommendationsDedup";
import { useRecommendationsPagination } from "../hooks/useRecommendationsPagination";

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
  const [endSentinel, setEndSentinel] = useState<HTMLDivElement | null>(null);

  const { dedupe } = useRecommendationsDedup(config.initialItems);
  const { items, hasMore, isFetching, loadNext } = useRecommendationsPagination({
    initialItems: config.initialItems,
    initialPage: config.initialPage,
    fetchPage: config.fetchPage,
    dedupe,
  });

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

  useEffect(() => {
    if (!endSentinel || !hasMore || isFetching) {
      return;
    }

    // Keep the next-page load in sync with the carousel's end sentinel so users can continue browsing naturally.

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void loadNext();
          }
        }
      },
      { root: null, rootMargin: "200px" }
    );

    observer.observe(endSentinel);

    return () => {
      observer.disconnect();
    };
  }, [endSentinel, hasMore, isFetching, loadNext]);

  const handleNext = useCallback(async () => {
    if (carouselApi?.canScrollNext()) {
      carouselApi.scrollNext();
      return;
    }

    const loaded = await loadNext();
    if (loaded) {
      window.requestAnimationFrame(() => {
        carouselApi?.scrollNext();
      });
    }
  }, [carouselApi, loadNext]);

  const nextButtonDisabled = !canScrollNext && !hasMore;
  const previousButtonDisabled = !canScrollPrev || isFetching;

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

            {isFetching ? (
              <CarouselItem className="pl-4 basis-[70%] sm:basis-[46%] md:basis-[32%] lg:basis-[23%]">
                <div className="bg-secondary aspect-[2/3] rounded-lg animate-pulse" />
                <div className="mt-3 space-y-2">
                  <div className="bg-secondary h-4 w-5/6 rounded animate-pulse" />
                  <div className="bg-secondary h-3 w-2/5 rounded animate-pulse" />
                </div>
              </CarouselItem>
            ) : null}

            <div ref={setEndSentinel} className="w-px shrink-0" aria-hidden="true" />
          </CarouselContent>
        </Carousel>

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => carouselApi?.scrollPrev()}
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
          disabled={nextButtonDisabled || isFetching}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-sm"
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          <span className="sr-only">Next movies</span>
        </Button>
      </div>
    </section>
  );
});

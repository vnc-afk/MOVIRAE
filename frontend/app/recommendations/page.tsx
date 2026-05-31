"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Clock, Loader2, Sparkles, Star, TrendingUp } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { getTrendingMovies, getMoviesByGenre } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";

const PAGE_SIZE = 20;

type RecommendationsSnapshot = {
  topPicks: Movie[];
  trending: Movie[];
  similar: Movie[];
  updatedAt: number;
};

type RecommendationSectionProps = {
  title: string;
  icon: typeof Sparkles;
  initialItems: Movie[];
  initialPage: number;
  fetchPage: (page: number) => Promise<Movie[]>;
  priority?: boolean;
};

function RecommendationSection({
  title,
  icon: Icon,
  initialItems,
  initialPage,
  fetchPage,
  priority = false,
}: RecommendationSectionProps) {
  const [movies, setMovies] = useState<Movie[]>(initialItems);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialItems.length >= PAGE_SIZE);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const endSentinelRef = useRef<HTMLDivElement | null>(null);
  const seenMovieIdsRef = useRef<Set<string>>(new Set(initialItems.map((movie) => movie.id)));
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    setMovies(initialItems);
    setCurrentPage(initialPage);
    setHasMore(initialItems.length >= PAGE_SIZE);
    setIsFetchingNextPage(false);
    setCanScrollPrev(false);
    setCanScrollNext(false);
    seenMovieIdsRef.current = new Set(initialItems.map((movie) => movie.id));
  }, [initialItems, initialPage]);

  const loadNextPage = useCallback(async () => {
    if (isFetchingNextPage || !hasMore) {
      return false;
    }

    const nextPage = currentPage + 1;
    setIsFetchingNextPage(true);

    try {
      const results = await fetchPage(nextPage);

      if (!isMountedRef.current) {
        return false;
      }

      if (!results.length) {
        setHasMore(false);
        return false;
      }

      const nextResults = results.filter((movie) => !seenMovieIdsRef.current.has(movie.id));

      if (!nextResults.length) {
        setHasMore(false);
        return false;
      }

      nextResults.forEach((movie) => seenMovieIdsRef.current.add(movie.id));
      setMovies((previous) => [...previous, ...nextResults]);
      setCurrentPage(nextPage);

      if (results.length < PAGE_SIZE) {
        setHasMore(false);
      }

      return true;
    } catch (error) {
      console.error(`Failed to fetch more ${title.toLowerCase()} movies:`, error);
      setHasMore(false);
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsFetchingNextPage(false);
      }
    }
  }, [currentPage, fetchPage, hasMore, isFetchingNextPage, title]);

  useEffect(() => {
    const sentinel = endSentinelRef.current;

    if (!sentinel || !hasMore || isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void loadNextPage();
          }
        }
      },
      { root: null, rootMargin: "200px" }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isFetchingNextPage, loadNextPage, movies.length]);

  const handleNext = useCallback(async () => {
    if (carouselApi?.canScrollNext()) {
      carouselApi.scrollNext();
      return;
    }

    if (!hasMore) {
      return;
    }

    const loaded = await loadNextPage();

    if (loaded) {
      window.requestAnimationFrame(() => {
        carouselApi?.scrollNext();
      });
    }
  }, [carouselApi, hasMore, loadNextPage]);

  const nextButtonDisabled = !canScrollNext && !hasMore;
  const previousButtonDisabled = !canScrollPrev || isFetchingNextPage;

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      </div>

      <div className="relative">
        <Carousel setApi={setCarouselApi} className="w-full">
          <CarouselContent className="-ml-4">
            {movies.map((movie: Movie, index: number) => (
              <CarouselItem
                key={movie.id}
                className="pl-4 basis-[70%] sm:basis-[46%] md:basis-[32%] lg:basis-[23%]"
              >
                <MovieCard movie={movie} index={index} priority={priority && index < 4} />
              </CarouselItem>
            ))}
            {isFetchingNextPage ? (
              <CarouselItem className="pl-4 basis-[70%] sm:basis-[46%] md:basis-[32%] lg:basis-[23%]">
                <div className="bg-secondary aspect-[2/3] rounded-lg animate-pulse" />
                <div className="mt-3 space-y-2">
                  <div className="bg-secondary h-4 w-5/6 rounded animate-pulse" />
                  <div className="bg-secondary h-3 w-2/5 rounded animate-pulse" />
                </div>
              </CarouselItem>
            ) : null}
            <div ref={endSentinelRef} className="w-px shrink-0" aria-hidden="true" />
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
          onClick={() => void handleNext()}
          disabled={nextButtonDisabled || isFetchingNextPage}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-sm"
        >
          {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          <span className="sr-only">Next movies</span>
        </Button>
      </div>
    </section>
  );
}

export default function RecommendationsPage() {
  const recommendationsQuery = usePrefetchAwareQuery<RecommendationsSnapshot>({
    queryKey: queryKeys.recommendations.home(),
    queryFn: async () => {
      const [topMovies, trendingMovies, actionMovies] = await Promise.all([
        getTrendingMovies(1),
        getTrendingMovies(2),
        getMoviesByGenre(28, 1),
      ]);

      return {
        topPicks: topMovies,
        trending: trendingMovies,
        similar: actionMovies,
        updatedAt: Date.now(),
      };
    },
    enabled: true,
  });

  const snapshot = recommendationsQuery.data ?? {
    topPicks: [],
    trending: [],
    similar: [],
    updatedAt: 0,
  };

  const topPicks = snapshot.topPicks;
  const trending = snapshot.trending;
  const similar = snapshot.similar;
  const loading = recommendationsQuery.isPending;

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let refreshTimer: number | null = null;

    try {
      eventSource = new EventSource("/api/reviews/events");
      eventSource.addEventListener("review-updated", () => {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          void recommendationsQuery.refetch();
        }, 500);
      });
    } catch {
      /* best-effort */
    }

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      eventSource?.close();
    };
  }, [recommendationsQuery]);

  const LoadingSkeleton = () => (
    <div className="relative">
      <div className="overflow-hidden">
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_: unknown, i: number) => (
            <div
              key={i}
              className="w-[70%] shrink-0 sm:w-[46%] md:w-[32%] lg:w-[23%]"
            >
              <div className="bg-secondary aspect-[2/3] rounded-lg animate-pulse" />
              <div className="mt-3 space-y-2">
                <div className="bg-secondary h-4 w-5/6 rounded animate-pulse" />
                <div className="bg-secondary h-3 w-2/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden md:flex items-center pr-1">
        <div className="h-8 w-8 rounded-full bg-background/80 border border-border shadow-sm" />
      </div>
    </div>
  );

  const recommendationSections = [
    {
      title: "Top Picks for You",
      icon: Star,
      items: topPicks,
      initialPage: 1,
      fetchPage: getTrendingMovies,
      priority: true,
    },
    {
      title: "Similar to Popular Movies",
      icon: Clock,
      items: similar,
      initialPage: 1,
      fetchPage: (page: number) => getMoviesByGenre(28, page),
      priority: false,
    },
    {
      title: "Trending Now",
      icon: TrendingUp,
      items: trending,
      initialPage: 2,
      fetchPage: getTrendingMovies,
      priority: false,
    },
  ] as const;

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              For You
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Personalized picks based on your watch history & ratings.
          </p>
        </motion.div>

        {recommendationSections.map((section) => {
          const Icon = section.icon;

          return loading ? (
            <section key={section.title}>
              <div className="flex items-center gap-2 mb-5">
                <Icon className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-bold text-foreground">{section.title}</h2>
              </div>
              <LoadingSkeleton />
            </section>
          ) : (
            <RecommendationSection
              key={`${section.title}-${snapshot.updatedAt}`}
              title={section.title}
              icon={Icon}
              initialItems={section.items}
              initialPage={section.initialPage}
              fetchPage={section.fetchPage}
              priority={section.priority}
            />
          );
        })}
      </div>
    </div>
  );
}

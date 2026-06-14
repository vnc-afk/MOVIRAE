"use client";

import { useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecommendationSection } from "./components/RecommendationSection";
import { useRecommendationsData } from "./hooks/useRecommendationsData";
import { useRecommendationsUrlState } from "./hooks/useRecommendationsUrlState";
import {
	fetchSimilarMoviesPage,
	fetchTopPicksPage,
	fetchTrendingNowPage,
} from "./lib/recommendationsService";
import type { RecommendationSectionConfig } from "./lib/types";

export default function Page() {
	const { snapshot, isLoading, error, refetch } = useRecommendationsData();
	const { activeSection, setActiveSection } = useRecommendationsUrlState();

	const sections = useMemo<RecommendationSectionConfig[]>(
		() => [
			{
				key: "top-picks",
				title: "Top Picks for You",
				icon: Star,
				initialItems: snapshot.topPicks,
				initialPage: 1,
				fetchPage: fetchTopPicksPage,
				priority: true,
			},
			{
				key: "similar",
				title: "Similar to Popular Movies",
				icon: Clock,
				initialItems: snapshot.similar,
				initialPage: 1,
				fetchPage: fetchSimilarMoviesPage,
			},
			{
				key: "trending",
				title: "Trending Now",
				icon: TrendingUp,
				initialItems: snapshot.trending,
				initialPage: 2,
				fetchPage: fetchTrendingNowPage,
			},
		],
		[snapshot.similar, snapshot.topPicks, snapshot.trending]
	);

	const handleSectionSelect = useCallback(
		(sectionKey: RecommendationSectionConfig["key"]) => {
			setActiveSection(sectionKey);
			const sectionElement = document.getElementById(sectionKey);
			sectionElement?.scrollIntoView({ behavior: "smooth", block: "start" });
		},
		[setActiveSection]
	);

	return (
		<div className="pb-20 md:pb-0">
			<div className="container py-8 space-y-12">
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
					<div className="flex items-center gap-2 mb-1">
						<Sparkles className="h-5 w-5 text-primary" />
						<h1 className="font-display text-2xl font-bold text-foreground">For You</h1>
					</div>
					<p className="text-sm text-muted-foreground">
						Personalized picks based on your watch history & ratings.
					</p>
				</motion.div>

				<div className="flex flex-wrap items-center gap-2">
					{sections.map((section) => (
						<button
							key={section.key}
							type="button"
							onClick={() => handleSectionSelect(section.key)}
							className={`rounded-full border px-4 py-2 text-sm transition ${
								activeSection === section.key
									? "border-primary bg-primary/10 text-primary"
									: "border-border bg-background text-foreground"
							}`}
						>
							{section.title}
						</button>
					))}
				</div>

				{error ? (
					<div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive-foreground">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p>There was a problem loading recommendations.</p>
							<Button type="button" onClick={() => void refetch()}>
								Retry
							</Button>
						</div>
					</div>
				) : null}

				{isLoading ? null : (
					sections.map((section) => (
						<RecommendationSection
							key={`${section.key}-${snapshot.updatedAt}`}
							config={section}
							active={activeSection === section.key}
						/>
					))
				)}
			</div>
		</div>
	);
}

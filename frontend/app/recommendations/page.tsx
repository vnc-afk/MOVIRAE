"use client";

import { useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecommendationSection } from "./components/RecommendationSection";
import { useRecommendationsData } from "./hooks/useRecommendationsData";
import { useRecommendationsUrlState } from "./hooks/useRecommendationsUrlState";
import type { RecommendationSectionConfig } from "./lib/types";

/**
 * Renders the recommendations landing page and coordinates the active section navigation.
 */
export default function Page() {
	const { snapshot, isLoading, error, refetch } = useRecommendationsData();
	const { activeSection, setActiveSection } = useRecommendationsUrlState();

	const sections = useMemo<RecommendationSectionConfig[]>(
		() => [
			{
				key: "top-picks",
				title: "Trending Picks",
				icon: Star,
				initialItems: snapshot.topPicks,
				priority: true,
			},
			{
				key: "similar",
				title: "Based on Your Tastes",
				icon: Clock,
				initialItems: snapshot.similar,
			},
			{
				key: "trending",
				title: "Trending Now",
				icon: TrendingUp,
				initialItems: snapshot.trending,
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

				{isLoading ? (
					<div className="space-y-5">
						<div className="h-5 w-40 rounded bg-secondary animate-pulse" />
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{Array.from({ length: 4 }).map((_, index) => (
								<div key={index} className="space-y-3">
									<div className="aspect-[2/3] rounded-lg bg-secondary animate-pulse" />
									<div className="h-4 w-3/4 rounded bg-secondary animate-pulse" />
									<div className="h-3 w-1/2 rounded bg-secondary animate-pulse" />
								</div>
							))}
						</div>
					</div>
				) : (
					sections.map((section) => (
						<RecommendationSection
							key={section.key}
							config={section}
							active={activeSection === section.key}
						/>
					))
				)}
			</div>
		</div>
	);
}
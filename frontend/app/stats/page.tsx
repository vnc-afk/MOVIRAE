"use client";

import { useMemo } from "react";
import { StatsHeader } from "./components/StatsHeader";
import { StatsSummaryGrid } from "./components/StatsSummaryGrid";
import { StatsCharts } from "./components/StatsCharts";
import { StatsErrorState } from "./components/StatsErrorState";
import { useStatsData } from "./hooks/useStatsData";
import { StatsLoading } from "./loading";
import type { UserStats } from "@/lib/types";

const EMPTY_STATS: UserStats = {
	totalWatched: 0,
	totalHours: 0,
	avgRating: 0,
	favoriteGenre: "",
	topDirector: "",
	longestStreak: 0,
	countriesExplored: 0,
	monthlyBreakdown: [],
	genreBreakdown: [],
	ratingDistribution: [],
	moodBreakdown: [],
	platformBreakdown: [],
	contextBreakdown: [],
	weekdayBreakdown: [],
};

export default function Page() {
	const { data, isLoading, error, refetch } = useStatsData();
	const userStats = useMemo<UserStats>(() => data ?? EMPTY_STATS, [data]);

	if (isLoading) {
		return <StatsLoading />;
	}

	if (error) {
		return <StatsErrorState onRetry={() => void refetch()} />;
	}

	return (
		<div className="pb-20 md:pb-0">
			<div className="container py-8 space-y-8">
				<StatsHeader />
				<StatsSummaryGrid userStats={userStats} />
				<StatsCharts userStats={userStats} />
			</div>
		</div>
	);
}

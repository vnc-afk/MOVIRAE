/**
 * Pure formatting functions - zero side effects
 * Designed to be memoized and unit-testable
 */

export const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatActivityDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    return dateFormatter.format(new Date(dateString));
  } catch {
    return null;
  }
}

export function formatActivityRange(start: string | null | undefined, end: string | null | undefined): string | null {
  const startLabel = formatActivityDate(start);
  const endLabel = formatActivityDate(end);

  if (startLabel && endLabel) {
    return `from ${startLabel} to ${endLabel}`;
  }
  return null;
}

export function formatYear(dateString: string | null | undefined): number {
  if (!dateString) return new Date().getFullYear();
  try {
    return new Date(dateString).getFullYear();
  } catch {
    return new Date().getFullYear();
  }
}

export function formatHours(hours: number): string {
  if (hours < 1) return "0h";
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k h`;
  return `${Math.round(hours)} h`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function formatCountries(count: number): string {
  return count.toString();
}

/**
 * Batch formatter for common display values
 */
export function formatStatsForDisplay(
  totalWatched: number,
  totalHours: number,
  avgRating: number,
  countriesExplored: number
) {
  return {
    films: totalWatched.toString(),
    hours: formatHours(totalHours),
    rating: formatRating(avgRating),
    countries: formatCountries(countriesExplored),
  };
}

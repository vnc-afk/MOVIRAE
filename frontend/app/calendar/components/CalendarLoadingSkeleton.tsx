export function CalendarLoadingSkeleton() {
  return (
    <div
      aria-label="Loading calendar"
      role="status"
      className="h-96 animate-pulse rounded-2xl bg-secondary"
    />
  );
}

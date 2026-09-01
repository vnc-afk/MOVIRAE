export function normalizeLabel(value: string | null | undefined) {
  if (!value) return "";
  return value.trim();
}

export function isKnownValue(value: string | null | undefined) {
  const normalized = normalizeLabel(value);
  return normalized !== "" && normalized.toLowerCase() !== "unknown";
}

export function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = normalizeLabel(getKey(item));
    if (!isKnownValue(key)) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function sortBreakdown(entries: Array<{ count: number; [key: string]: unknown }>) {
  return entries.sort((a, b) => b.count - a.count);
}

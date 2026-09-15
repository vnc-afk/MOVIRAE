import type { SoundtrackQuery } from "./types";

export const DEFAULT_SOUNDTRACK_QUERY: SoundtrackQuery = {
  search: "",
  page: 1,
  selectedId: null,
};

export function parseSoundtrackQuery(params: URLSearchParams): SoundtrackQuery {
  const page = Number(params.get("page"));
  const selectedId = Number(params.get("selected"));
  return {
    search: params.get("q")?.trim() ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    selectedId: Number.isInteger(selectedId) && selectedId > 0 ? selectedId : null,
  };
}

export function buildSoundtrackUrl(pathname: string, query: SoundtrackQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.selectedId) params.set("selected", String(query.selectedId));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

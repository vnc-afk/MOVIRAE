import { ASSISTANT_QUERY_PARAM } from "./constants";

export function readAssistantQuery(searchParams: URLSearchParams): string {
  return searchParams.get(ASSISTANT_QUERY_PARAM)?.trim() ?? "";
}

export function buildAssistantUrl(pathname: string, query: string): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set(ASSISTANT_QUERY_PARAM, query.trim());
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
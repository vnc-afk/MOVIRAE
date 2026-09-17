"use client";

import { useAssistantPagination } from "./useAssistantPagination";
import { fetchAssistantMovies } from "../lib/repository";

export function useAssistantData(query: string) {
  return useAssistantPagination(query, fetchAssistantMovies);
}
"use server";

import { createSupabaseClient } from "@/lib/supabase";
import type { WlCompetition, WlResult } from "@/types/database";

export type ResultRow = WlResult & {
  wlre_competitions: Pick<WlCompetition, "id" | "competition_year" | "name"> | null;
};

export type FilterOptions = {
  years: number[];
  competitionNames: string[];
  categories: string[];
};

export type SearchFilters = {
  year: number | null;
  competitionName: string;
  athleteName: string;
  category: string;
};

const MAX_RESULTS = 1000;

export type CompetitionListItem = {
  id: string;
  competition_year: number;
  name: string;
};

export async function getCompetitionsList(): Promise<
  { success: true; data: CompetitionListItem[] } | { success: false; error: string }
> {
  try {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from("wlre_competitions")
      .select("id, competition_year, name")
      .order("competition_year", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const list = (data ?? []) as CompetitionListItem[];
    return { success: true, data: list };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `大会一覧の取得に失敗しました: ${message}` };
  }
}

export async function getFilterOptions(): Promise<
  { success: true; data: FilterOptions } | { success: false; error: string }
> {
  try {
    const supabase = createSupabaseClient();

    const [yearsRes, namesRes, categoriesRes] = await Promise.all([
      supabase
        .from("wlre_competitions")
        .select("competition_year")
        .order("competition_year", { ascending: false }),
      supabase
        .from("wlre_competitions")
        .select("name")
        .order("name"),
      supabase
        .from("wlre_results")
        .select("category")
        .not("category", "is", null)
        .order("category"),
    ]);

    const yearSet = new Set<number>();
    (yearsRes.data ?? []).forEach((r) => yearSet.add(r.competition_year));
    const years = Array.from(yearSet).sort((a, b) => b - a);

    const nameSet = new Set<string>();
    (namesRes.data ?? []).forEach((r) => nameSet.add(r.name.trim()));
    const competitionNames = Array.from(nameSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

    const catSet = new Set<string>();
    (categoriesRes.data ?? []).forEach((r) => r.category && catSet.add(String(r.category).trim()));
    const categories = Array.from(catSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

    return {
      success: true,
      data: { years, competitionNames, categories },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `フィルター取得に失敗しました: ${message}` };
  }
}

export async function searchResults(
  filters: SearchFilters
): Promise<
  { success: true; data: ResultRow[] } | { success: false; error: string }
> {
  try {
    const supabase = createSupabaseClient();

    let competitionIds: string[] | null = null;

    if (filters.year != null || filters.competitionName.trim()) {
      let compQuery = supabase.from("wlre_competitions").select("id");
      if (filters.year != null) {
        compQuery = compQuery.eq("competition_year", filters.year);
      }
      if (filters.competitionName.trim()) {
        compQuery = compQuery.ilike("name", `%${filters.competitionName.trim()}%`);
      }
      const { data: comps } = await compQuery;
      competitionIds = (comps ?? []).map((c) => c.id);
      if (competitionIds.length === 0) {
        return { success: true, data: [] };
      }
    }

    let query = supabase
      .from("wlre_results")
      .select("*, wlre_competitions(id, competition_year, name)")
      .limit(MAX_RESULTS);

    if (competitionIds != null) {
      query = query.in("competition_id", competitionIds);
    }

    if (filters.athleteName.trim()) {
      query = query.ilike("athlete_name", `%${filters.athleteName.trim()}%`);
    }

    if (filters.category.trim()) {
      query = query.ilike("category", `%${filters.category.trim()}%`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const rows = (data ?? []) as unknown as ResultRow[];
    return { success: true, data: rows };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `検索に失敗しました: ${message}` };
  }
}

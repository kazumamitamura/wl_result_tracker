"use server";

import { createSupabaseClient } from "@/lib/supabase";
import type { ParsedResultRow } from "@/types/database";

export type SaveCompetitionResult =
  | { success: true }
  | { success: false; error: string };

export async function saveCompetitionAndResults(
  competitionYear: number,
  competitionName: string,
  results: ParsedResultRow[]
): Promise<SaveCompetitionResult> {
  if (!competitionName.trim()) {
    return { success: false, error: "大会名を入力してください。" };
  }
  if (results.length === 0) {
    return { success: false, error: "保存する結果が1件以上必要です。" };
  }

  const supabase = createSupabaseClient();

  const { data: competition, error: compError } = await supabase
    .from("wlre_competitions")
    .insert({
      competition_year: competitionYear,
      name: competitionName.trim(),
    })
    .select("id")
    .single();

  if (compError || !competition?.id) {
    return {
      success: false,
      error: compError?.message ?? "大会の登録に失敗しました。",
    };
  }

  const inserts = results.map((r) => ({
    competition_id: competition.id,
    athlete_name: r.athlete_name.trim() || "",
    category: r.category?.trim() || null,
    age_grade: r.age_grade?.trim() || null,
    snatch_best: r.snatch_best,
    snatch_rank: r.snatch_rank,
    cj_best: r.cj_best,
    cj_rank: r.cj_rank,
    total_weight: r.total_weight,
    total_rank: r.total_rank,
  }));

  const { error: resultsError } = await supabase
    .from("wlre_results")
    .insert(inserts);

  if (resultsError) {
    return {
      success: false,
      error: resultsError.message ?? "競技結果の登録に失敗しました。",
    };
  }

  return { success: true };
}

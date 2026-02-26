"use server";

import { createSupabaseClient } from "@/lib/supabase";

export type MvpResultRow = {
  id: string;
  athlete_name: string;
  category: string | null;
  total_weight: number | null;
};

export type GetCompetitionMvpResult =
  | { success: true; competitionName: string; data: MvpResultRow[] }
  | { success: false; error: string };

export async function getCompetitionResultsForMvp(
  competitionId: string
): Promise<GetCompetitionMvpResult> {
  if (!competitionId.trim()) {
    return { success: false, error: "大会IDを指定してください。" };
  }

  try {
    const supabase = createSupabaseClient();

    const { data: comp, error: compError } = await supabase
      .from("wlre_competitions")
      .select("id, name")
      .eq("id", competitionId.trim())
      .single();

    if (compError || !comp) {
      return {
        success: false,
        error: compError?.message ?? "大会が見つかりません。",
      };
    }

    const { data: results, error: resError } = await supabase
      .from("wlre_results")
      .select("id, athlete_name, category, total_weight")
      .eq("competition_id", comp.id)
      .order("total_weight", { ascending: false });

    if (resError) {
      return { success: false, error: resError.message };
    }

    const rows = (results ?? []) as MvpResultRow[];
    return {
      success: true,
      competitionName: comp.name,
      data: rows,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `取得に失敗しました: ${message}` };
  }
}

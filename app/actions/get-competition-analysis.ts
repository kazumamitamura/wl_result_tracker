"use server";

import { createSupabaseClient } from "@/lib/supabase";
import { isFemaleCategory } from "@/lib/gender";

export type CompetitionAnalysisRow = {
  category: string;
  avgSnatch: number;
  avgCj: number;
  avgTotal: number;
  count: number;
};

export type CompetitionAnalysisResult =
  | { success: true; competitionName: string; data: CompetitionAnalysisRow[] }
  | { success: false; error: string };

/** 階級文字列をソート用の数値に変換（軽い順: 45→109, +87, +109） */
function categorySortKey(cat: string): number {
  const s = cat.trim().replace(/\s*[Kk]g\s*$/i, "");
  if (s.startsWith("+")) {
    const n = parseInt(s.slice(1), 10);
    return Number.isFinite(n) ? 1000 + n : 9999;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 9999;
}

export async function getCompetitionAnalysis(
  competitionId: string,
  gender?: "male" | "female"
): Promise<CompetitionAnalysisResult> {
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
      .select("category, snatch_best, cj_best, total_weight")
      .eq("competition_id", comp.id);

    if (resError) {
      return { success: false, error: resError.message };
    }

    let rows = (results ?? []) as Array<{
      category: string | null;
      snatch_best: number | null;
      cj_best: number | null;
      total_weight: number | null;
    }>;

    if (gender === "female") {
      rows = rows.filter((r) => isFemaleCategory(r.category));
    } else if (gender === "male") {
      rows = rows.filter((r) => !isFemaleCategory(r.category));
    }

    const byCategory = new Map<
      string,
      Array<{ snatch: number; cj: number; total: number }>
    >();

    for (const r of rows) {
      const cat = r.category?.trim();
      if (!cat) continue;

      const total = r.total_weight != null ? Number(r.total_weight) : null;
      if (total === null || !Number.isFinite(total)) continue;

      const snatch =
        r.snatch_best != null && Number.isFinite(Number(r.snatch_best))
          ? Number(r.snatch_best)
          : 0;
      const cj =
        r.cj_best != null && Number.isFinite(Number(r.cj_best))
          ? Number(r.cj_best)
          : 0;

      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push({ snatch, cj, total });
    }

    const aggregated: CompetitionAnalysisRow[] = [];

    for (const [category, athletes] of byCategory.entries()) {
      const top10 = [...athletes]
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      if (top10.length === 0) continue;

      const n = top10.length;
      const sumSnatch = top10.reduce((s, x) => s + x.snatch, 0);
      const sumCj = top10.reduce((s, x) => s + x.cj, 0);
      const sumTotal = top10.reduce((s, x) => s + x.total, 0);

      const avgSnatch = Math.round((sumSnatch / n) * 10) / 10;
      const avgCj = Math.round((sumCj / n) * 10) / 10;
      const avgTotal = Math.round((sumTotal / n) * 10) / 10;

      aggregated.push({
        category,
        avgSnatch,
        avgCj,
        avgTotal,
        count: n,
      });
    }

    aggregated.sort(
      (a, b) => categorySortKey(a.category) - categorySortKey(b.category)
    );

    return {
      success: true,
      competitionName: comp.name,
      data: aggregated,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `集計に失敗しました: ${message}` };
  }
}

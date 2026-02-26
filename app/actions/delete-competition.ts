"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseClient } from "@/lib/supabase";

export type DeleteCompetitionResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteCompetition(
  competitionId: string
): Promise<DeleteCompetitionResult> {
  if (!competitionId.trim()) {
    return { success: false, error: "大会IDを指定してください。" };
  }

  try {
    const supabase = createSupabaseClient();

    const { error } = await supabase
      .from("wlre_competitions")
      .delete()
      .eq("id", competitionId.trim());

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `削除に失敗しました: ${message}` };
  }
}

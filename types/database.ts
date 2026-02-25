/**
 * Supabase DB types for wl_result_tracker.
 * テーブル・型は全て wlre_ 接頭語で統一。
 */

export type WlCompetition = {
  id: string;
  competition_year: number;
  name: string;
  created_at: string;
};

export type WlCompetitionInsert = Omit<WlCompetition, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type WlResult = {
  id: string;
  competition_id: string;
  athlete_name: string;
  category: string | null;
  age_grade: string | null;
  snatch_best: number | null;
  snatch_rank: number | null;
  cj_best: number | null;
  cj_rank: number | null;
  total_weight: number | null;
  total_rank: number | null;
  created_at: string;
};

export type WlResultInsert = Omit<WlResult, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

/** PDF解析後の1行（確認・修正用。id / competition_id / created_at なし） */
export type ParsedResultRow = {
  athlete_name: string;
  category: string | null;
  age_grade: string | null;
  snatch_best: number | null;
  snatch_rank: number | null;
  cj_best: number | null;
  cj_rank: number | null;
  total_weight: number | null;
  total_rank: number | null;
};

export type WlResultWithCompetition = WlResult & {
  wlre_competitions?: Pick<WlCompetition, "id" | "competition_year" | "name"> | null;
};

/** Supabase createClient<Database> 用の public スキーマ型 */
export interface WlDatabase {
  public: {
    Tables: {
      wlre_competitions: {
        Row: WlCompetition;
        Insert: WlCompetitionInsert;
        Update: Partial<WlCompetitionInsert>;
      };
      wlre_results: {
        Row: WlResult;
        Insert: WlResultInsert;
        Update: Partial<WlResultInsert>;
      };
    };
  };
}

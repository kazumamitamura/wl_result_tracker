-- Weightlifting Result Tracker (wl_result_tracker)
-- 同居の鉄則: 全てのオブジェクトは wlre_ 接頭語を使用

-- 既存テーブルで year カラムがある場合は competition_year にリネーム
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wlre_competitions' AND column_name = 'year'
  ) THEN
    ALTER TABLE wlre_competitions RENAME COLUMN year TO competition_year;
  END IF;
END $$;

-- 大会マスタ
CREATE TABLE IF NOT EXISTS wlre_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_year integer NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 競技結果
CREATE TABLE IF NOT EXISTS wlre_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES wlre_competitions(id) ON DELETE CASCADE,
  athlete_name text NOT NULL,
  category text,
  age_grade text,
  snatch_best numeric,
  snatch_rank integer,
  cj_best numeric,
  cj_rank integer,
  total_weight numeric,
  total_rank integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 検索用インデックス
CREATE INDEX IF NOT EXISTS wlre_results_competition_id_idx ON wlre_results(competition_id);
CREATE INDEX IF NOT EXISTS wlre_competitions_year_idx ON wlre_competitions(competition_year);

-- RLS 有効化（同一プロジェクト内の他アプリと分離するため）
ALTER TABLE wlre_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wlre_results ENABLE ROW LEVEL SECURITY;

-- 全テーブルに対するポリシー（必要に応じてアプリ側で認証後に絞り込み）
CREATE POLICY "wlre_competitions_select" ON wlre_competitions FOR SELECT USING (true);
CREATE POLICY "wlre_competitions_insert" ON wlre_competitions FOR INSERT WITH CHECK (true);
CREATE POLICY "wlre_competitions_update" ON wlre_competitions FOR UPDATE USING (true);
CREATE POLICY "wlre_competitions_delete" ON wlre_competitions FOR DELETE USING (true);

CREATE POLICY "wlre_results_select" ON wlre_results FOR SELECT USING (true);
CREATE POLICY "wlre_results_insert" ON wlre_results FOR INSERT WITH CHECK (true);
CREATE POLICY "wlre_results_update" ON wlre_results FOR UPDATE USING (true);
CREATE POLICY "wlre_results_delete" ON wlre_results FOR DELETE USING (true);

COMMENT ON TABLE wlre_competitions IS 'wl_result_tracker: 大会マスタ';
COMMENT ON TABLE wlre_results IS 'wl_result_tracker: 競技結果';

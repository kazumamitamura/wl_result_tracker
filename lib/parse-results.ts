import type { ParsedResultRow } from "@/types/database";

/** 数値として解釈できるか（重量・順位） */
function parseNum(value: string): number | null {
  const s = value.replace(/,/g, "").trim();
  if (s === "" || s === "-" || s === "－") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 行を空白（2つ以上連続 or タブ）で分割し、空でないセルを返す */
function splitRow(line: string): string[] {
  return line
    .split(/\s{2,}|\t/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** ヘッダー行からカラムインデックスを推測 */
function detectColumnIndices(headers: string[]): {
  name: number;
  category: number | null;
  ageGrade: number | null;
  snatchBest: number | null;
  snatchRank: number | null;
  cjBest: number | null;
  cjRank: number | null;
  totalWeight: number | null;
  totalRank: number | null;
} {
  const lower = (s: string) => s.toLowerCase().replace(/\s/g, "");
  const idx = (keywords: string[]) => {
    const i = headers.findIndex((h) =>
      keywords.some((k) => lower(h).includes(k))
    );
    return i >= 0 ? i : null;
  };
  return {
    name: idx(["選手名", "氏名", "名前", "姓名", "name"]) ?? 0,
    category: idx(["階級", "体重", "category"]),
    ageGrade: idx(["学年", "年齢", "年令", "age", "grade"]),
    snatchBest: idx(["スナッチ", "snatch"]),
    snatchRank: idx(["スナッチ順位", "snatch順位", "スナッチ順"]),
    cjBest: idx(["c&j", "cj", "クリーン", "ジャーク", "clean"]),
    cjRank: idx(["c&j順位", "cj順位", "クリーン順位"]),
    totalWeight: idx(["トータル", "合計", "total", "総合"]),
    totalRank: idx(["トータル順位", "総合順位", "順位"]),
  };
}

/** 1行のセル配列から ParsedResultRow を組み立て（インデックス指定あり） */
function rowToResult(
  cells: string[],
  col: ReturnType<typeof detectColumnIndices>
): ParsedResultRow | null {
  const at = (i: number | null) => (i != null && cells[i] !== undefined ? cells[i] : "");
  const name = at(col.name).trim() || at(0).trim();
  if (!name || /^\d+$/.test(name)) return null; // 名前が空または数字のみはスキップ

  const pickNum = (i: number | null) => parseNum(at(i));
  return {
    athlete_name: name,
    category: at(col.category) || null,
    age_grade: at(col.ageGrade) || null,
    snatch_best: pickNum(col.snatchBest),
    snatch_rank: pickNum(col.snatchRank),
    cj_best: pickNum(col.cjBest),
    cj_rank: pickNum(col.cjRank),
    total_weight: pickNum(col.totalWeight),
    total_rank: pickNum(col.totalRank),
  };
}

/** ヘッダーなしで、左から順に「名前・任意・任意・スナッチ・スナッチ順・C&J・C&J順・トータル・トータル順」と仮定してパース */
function parseRowHeuristic(cells: string[]): ParsedResultRow | null {
  if (cells.length < 2) return null;
  const name = cells[0].trim();
  if (!name || /^\d+$/.test(name)) return null;
  return {
    athlete_name: name,
    category: cells[1]?.trim() || null,
    age_grade: cells[2]?.trim() || null,
    snatch_best: parseNum(cells[3] ?? ""),
    snatch_rank: parseNum(cells[4] ?? ""),
    cj_best: parseNum(cells[5] ?? ""),
    cj_rank: parseNum(cells[6] ?? ""),
    total_weight: parseNum(cells[7] ?? ""),
    total_rank: parseNum(cells[8] ?? ""),
  };
}

/**
 * PDFから抽出したテキストをパースし、競技結果行の配列を返す。
 * 表形式（空白区切り・タブ区切り）を想定した堅牢なロジック。
 */
export function parseResultsFromText(text: string): ParsedResultRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const rows: ParsedResultRow[] = [];
  let columnMap: ReturnType<typeof detectColumnIndices> | null = null;
  let dataStartIndex = 0;

  // ヘッダー行を探す（選手名・スナッチ・C&J・トータルなどのキーワードを含む行）
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitRow(lines[i]);
    if (cells.length < 2) continue;
    const headerCandidates = cells.join(" ");
    if (
      /選手名|氏名|スナッチ|C&J|トータル|階級|学年|順位/.test(headerCandidates)
    ) {
      columnMap = detectColumnIndices(cells);
      dataStartIndex = i + 1;
      break;
    }
  }

  for (let i = dataStartIndex; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    if (cells.length < 1) continue;

    let row: ParsedResultRow | null;
    if (columnMap) {
      row = rowToResult(cells, columnMap);
    } else {
      row = parseRowHeuristic(cells);
    }
    if (row) rows.push(row);
  }

  return rows;
}

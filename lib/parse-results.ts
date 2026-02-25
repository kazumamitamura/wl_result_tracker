import type { ParsedResultRow } from "@/types/database";

/** 階級パターン（45kg, +109kg 等）※ match で複数取得するため g 付き */
const CATEGORY_REGEX = /(45|49|55|59|61|64|67|71|73|76|81|89|96|102|109|\+87|\+109)\s*[Kk]g/g;

/** 体重パターン（55.00 等）※ .test() のみなので g なし */
const BODY_WEIGHT_REGEX = /\b\d{2,3}\.\d{2}\b/;

/** 生年パターン（2005 等 200x）※ アンカー用 */
const BIRTH_YEAR_200X_REGEX = /\b(200\d)\b/;

/** 生年パターン（19xx or 20xx）※ 名前抽出用 */
const BIRTH_YEAR_FULL_REGEX = /\b(19|20)\d{2}\b/;

/** 行を空白（2つ以上 or タブ）で分割 */
function splitRow(line: string): string[] {
  if (typeof line !== "string") return [];
  return line
    .split(/\s{2,}|\t/)
    .map((c) => (c != null ? String(c).trim() : ""))
    .filter((c) => c.length > 0);
}

/** 1行から階級を検出。match は必ず null チェックしてからアクセス。 */
function extractCategoryFromLine(line: string): string | null {
  if (typeof line !== "string") return null;
  const m = line.match(CATEGORY_REGEX);
  if (!m || !Array.isArray(m) || m.length === 0) return null;
  const last = m[m.length - 1];
  return last != null ? String(last).trim() : null;
}

/** 行が選手データ行か（体重 or 生年 200x を含む） */
function isAthleteAnchorLine(line: string): boolean {
  if (typeof line !== "string") return false;
  if (BODY_WEIGHT_REGEX.test(line)) return true;
  if (BIRTH_YEAR_200X_REGEX.test(line)) return true;
  return false;
}

/** ヘッダー行らしきか */
function looksLikeHeader(line: string): boolean {
  if (typeof line !== "string") return true;
  const t = line.replace(/\s/g, "");
  return (
    /県名|所属名|氏名|選手名|順位|スナッチ|クリーン|ジャーク|トータル|合計|体重|学年|年齢|区分|部門/.test(t) &&
    !BODY_WEIGHT_REGEX.test(line) &&
    !BIRTH_YEAR_200X_REGEX.test(line)
  );
}

/** キケン・失格などパース困難な行か */
function isProblematicLine(line: string): boolean {
  if (typeof line !== "string") return true;
  return /キケン|失格|ー{2,}/.test(line);
}

/** 生年の前の部分から選手名を抽出。match は null チェック済みでアクセス。 */
function extractNameBeforeBirthYear(line: string): string {
  if (typeof line !== "string") return "";
  const yearMatch = line.match(BIRTH_YEAR_FULL_REGEX);
  if (!yearMatch || !yearMatch[0]) return "";
  const yearStr = yearMatch[0];
  const yearIndex = line.indexOf(yearStr);
  if (yearIndex < 0) return "";
  const before = line.slice(0, yearIndex).trim();
  const tokens = splitRow(before);
  const nameParts: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (typeof t !== "string") break;
    if (/^[\d.]+$/.test(t)) break;
    if (/^[①②③④⑤⑥⑦⑧⑨⑩]+$/.test(t)) break;
    if (t.length > 20) break;
    nameParts.unshift(t);
  }
  const name = nameParts.join(" ").trim();
  return name || before.replace(/\s{2,}/g, " ").trim();
}

/** 生年付近の1桁数字を学年として取得 */
function extractGradeNearBirthYear(line: string): string | null {
  if (typeof line !== "string") return null;
  const yearMatch = line.match(BIRTH_YEAR_FULL_REGEX);
  if (!yearMatch || !yearMatch[0]) return null;
  const idx = line.indexOf(yearMatch[0]);
  const around = line.slice(Math.max(0, idx - 4), idx + yearMatch[0].length + 4);
  const oneDigit = around.match(/\b([1-6])\b/);
  if (!oneDigit || !oneDigit[1]) return null;
  return oneDigit[1];
}

/**
 * 体重より後ろの文字列から、\d{1,3} の数字だけを順に抽出（「106 X」「117 CR」は 106, 117 のみ取る）。
 * 並び: [スナッチ1][スナッチ2][スナッチ3][C&J1][C&J2][C&J3][スナッチベスト][スナッチ順位][C&Jベスト][C&J順位][トータル][トータル順位]
 * インデックス 6,7,8,9,10,11 を返す。
 */
function extractRecordNumbersAfterWeight(line: string): number[] {
  if (typeof line !== "string") return [];
  const tokens = line.split(/\s+/);
  let foundWeight = false;
  const nums: number[] = [];
  for (const t of tokens) {
    const s = (t != null ? String(t) : "").replace(/,/g, "").trim();
    if (!s) continue;
    if (BODY_WEIGHT_REGEX.test(s)) {
      foundWeight = true;
      continue;
    }
    if (!foundWeight) continue;
    const numMatch = s.match(/\d{1,3}/);
    if (numMatch != null && numMatch[0] != null) {
      const n = Number(numMatch[0]);
      if (Number.isFinite(n) && n >= 0 && n <= 500) nums.push(n);
    }
  }
  return nums;
}

/**
 * 数値列を [snatch_best, snatch_rank, cj_best, cj_rank, total_weight, total_rank] の順でマッピング。
 * 12個以上: インデックス 6〜11（試技の後）
 * 6〜11個: インデックス 0〜5 を採用（ベスト/順位のみの表）
 */
function mapNumbersToResult(
  nums: number[]
): Pick<
  ParsedResultRow,
  "snatch_best" | "snatch_rank" | "cj_best" | "cj_rank" | "total_weight" | "total_rank"
> {
  const out = {
    snatch_best: null as number | null,
    snatch_rank: null as number | null,
    cj_best: null as number | null,
    cj_rank: null as number | null,
    total_weight: null as number | null,
    total_rank: null as number | null,
  };
  if (!Array.isArray(nums) || nums.length < 6) return out;

  const start = nums.length >= 12 ? 6 : 0;
  if (nums[start] != null && nums[start] >= 0 && nums[start] <= 300) out.snatch_best = nums[start];
  if (nums[start + 1] != null && nums[start + 1] >= 0 && nums[start + 1] <= 100) out.snatch_rank = nums[start + 1];
  if (nums[start + 2] != null && nums[start + 2] >= 0 && nums[start + 2] <= 300) out.cj_best = nums[start + 2];
  if (nums[start + 3] != null && nums[start + 3] >= 0 && nums[start + 3] <= 100) out.cj_rank = nums[start + 3];
  if (nums[start + 4] != null && nums[start + 4] >= 0 && nums[start + 4] <= 500) out.total_weight = nums[start + 4];
  if (nums[start + 5] != null && nums[start + 5] >= 0 && nums[start + 5] <= 100) out.total_rank = nums[start + 5];

  return out;
}

/**
 * 1行をパースして選手1件分を返す。例外は出さず null でスキップ。
 */
function parseAthleteLine(
  line: string,
  currentCategory: string | null
): ParsedResultRow | null {
  try {
    if (looksLikeHeader(line)) return null;
    if (isProblematicLine(line)) return null;

    const name = extractNameBeforeBirthYear(line);
    if (!name || name.length < 2) return null;
    if (/^\d+$/.test(name) || /^[.\d\s]+$/.test(name)) return null;

    const grade = extractGradeNearBirthYear(line);
    const nums = extractRecordNumbersAfterWeight(line);
    const record = mapNumbersToResult(nums);

    return {
      athlete_name: name,
      category: currentCategory,
      age_grade: grade,
      snatch_best: record.snatch_best,
      snatch_rank: record.snatch_rank,
      cj_best: record.cj_best,
      cj_rank: record.cj_rank,
      total_weight: record.total_weight,
      total_rank: record.total_rank,
    };
  } catch {
    return null;
  }
}

/**
 * PDFから抽出したテキストをパースし、競技結果行の配列を返す。
 * 例外は握りつぶして空配列を返し、サーバーを落とさない。
 */
export function parseResultsFromText(text: string): ParsedResultRow[] {
  try {
    if (text == null || typeof text !== "string") return [];

    const lines = text
      .split(/\r?\n/)
      .map((l) => (l != null ? String(l).trim() : ""))
      .filter((l) => l.length > 0);

    if (lines.length === 0) return [];

    const rows: ParsedResultRow[] = [];
    let currentCategory: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line == null) continue;

      const categoryFromLine = extractCategoryFromLine(line);
      if (categoryFromLine != null) {
        currentCategory = categoryFromLine;
      }

      if (!isAthleteAnchorLine(line)) continue;
      if (looksLikeHeader(line)) continue;

      const row = parseAthleteLine(line, currentCategory);
      if (row != null) rows.push(row);
    }

    return rows;
  } catch {
    return [];
  }
}

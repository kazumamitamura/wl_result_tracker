import type { ParsedResultRow } from "@/types/database";

/** 階級パターン（55kg, +109kg 等） */
const CATEGORY_REGEX = /(55|59|61|64|67|71|73|76|81|89|96|102|109|\+87|\+109)[Kk]g/g;

/** 体重パターン（55.00 等の xx.xx）※ .test() を複数回使うため g なし */
const BODY_WEIGHT_REGEX = /\b\d{2,3}\.\d{2}\b/;

/** 生年パターン（2005, 1990 等）※ .test() を複数回使うため g なし */
const BIRTH_YEAR_REGEX = /\b(19|20)\d{2}\b/;

/** 行を空白（2つ以上 or タブ）で分割 */
function splitRow(line: string): string[] {
  return line
    .split(/\s{2,}|\t/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** 1行から階級を検出し、マッチした階級文字列を返す（複数あれば最後） */
function extractCategoryFromLine(line: string): string | null {
  const m = line.match(CATEGORY_REGEX);
  return m && m.length > 0 ? m[m.length - 1] : null;
}

/** 行が「選手データ行」かどうか（体重 or 生年を含む） */
function isAthleteAnchorLine(line: string): boolean {
  if (BODY_WEIGHT_REGEX.test(line)) return true;
  if (BIRTH_YEAR_REGEX.test(line)) return true;
  return false;
}

/** ヘッダー行らしきか（県名・所属名・順位などの典型的ヘッダー語） */
function looksLikeHeader(line: string): boolean {
  const t = line.replace(/\s/g, "");
  return (
    /県名|所属名|氏名|選手名|順位|スナッチ|クリーン|ジャーク|トータル|合計|体重|学年|年齢|区分|部門/.test(t) &&
    !BODY_WEIGHT_REGEX.test(line) &&
    !BIRTH_YEAR_REGEX.test(line)
  );
}

/** 生年の前の部分から選手名らしき文字列を抽出（最後の連続した日本語ブロックを採用） */
function extractNameBeforeBirthYear(line: string): string {
  const yearMatch = line.match(BIRTH_YEAR_REGEX);
  if (!yearMatch) return "";
  const yearIndex = line.indexOf(yearMatch[0]);
  const before = line.slice(0, yearIndex).trim();
  const tokens = splitRow(before);
  const nameParts: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (/^[\d.]+$/.test(t)) break;
    if (/^[①②③④⑤⑥⑦⑧⑨⑩]+$/.test(t)) break;
    if (t.length > 20) break;
    nameParts.unshift(t);
  }
  return nameParts.join(" ").trim() || before.replace(/\s{2,}/g, " ").trim();
}

/** 生年付近の1桁数字を学年として取得 */
function extractGradeNearBirthYear(line: string): string | null {
  const yearMatch = line.match(BIRTH_YEAR_REGEX);
  if (!yearMatch) return null;
  const idx = line.indexOf(yearMatch[0]);
  const around = line.slice(Math.max(0, idx - 4), idx + yearMatch[0].length + 4);
  const oneDigit = around.match(/\b([1-6])\b/);
  return oneDigit ? oneDigit[1] : null;
}

/** 行から体重後の数値列を抽出（スナッチ・C&J・トータルのベスト/順位の候補） */
function extractNumberSequenceAfterWeight(line: string): number[] {
  const nums: number[] = [];
  const tokens = line.split(/\s+/);
  let foundWeight = false;
  for (const t of tokens) {
    const cleaned = t.replace(/,/g, "").trim();
    if (BODY_WEIGHT_REGEX.test(cleaned)) {
      foundWeight = true;
      continue;
    }
    if (!foundWeight) continue;
    if (/^[\d.]+$/.test(cleaned)) {
      const n = Number(cleaned);
      if (Number.isFinite(n) && n >= 0 && n <= 500) nums.push(n);
    }
  }
  if (nums.length > 0) return nums;
  const globalNum = line.match(/\d{2,3}(?:\.\d{2})?/g);
  if (!globalNum) return [];
  return globalNum
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 500);
}

/**
 * 数値列からスナッチベスト/順位、C&Jベスト/順位、トータルベスト/順位を推測する。
 * 典型的な並び: [スナッチベスト, スナッチ順位, C&Jベスト, C&J順位, トータル, トータル順位] (6個)
 * または (重量, 順位) のペアが続くパターン。
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
  if (nums.length < 2) return out;

  const noDecimals = nums.filter((n) => n <= 300 && n === Math.floor(n));
  if (noDecimals.length >= 6) {
    out.snatch_best = noDecimals[0];
    out.snatch_rank = noDecimals[1];
    out.cj_best = noDecimals[2];
    out.cj_rank = noDecimals[3];
    out.total_weight = noDecimals[4];
    out.total_rank = noDecimals[5];
    return out;
  }

  for (let i = 0; i < nums.length - 1; i += 2) {
    const a = nums[i];
    const b = nums[i + 1];
    if (a >= 20 && a <= 300 && b >= 1 && b <= 50) {
      if (out.snatch_best == null) {
        out.snatch_best = a;
        out.snatch_rank = b;
      } else if (out.cj_best == null) {
        out.cj_best = a;
        out.cj_rank = b;
      } else if (out.total_weight == null) {
        out.total_weight = a;
        out.total_rank = b;
      }
    }
  }

  const withDecimals = nums.filter((n) => n > 0);
  if (withDecimals.length >= 3 && out.snatch_best == null && out.cj_best == null) {
    const sorted = [...withDecimals].sort((a, b) => b - a);
    if (sorted[0] >= 50) {
      out.total_weight = sorted[0];
      out.cj_best = sorted[1];
      out.snatch_best = sorted[2];
    }
  }
  return out;
}

/**
 * 1行をパースして選手1件分の ParsedResultRow を返す。
 * 階級は呼び出し側で渡す。名前・学年・数値は行から抽出。
 */
function parseAthleteLine(
  line: string,
  currentCategory: string | null
): ParsedResultRow | null {
  if (looksLikeHeader(line)) return null;

  const name = extractNameBeforeBirthYear(line);
  if (!name || name.length < 2) return null;
  if (/^\d+$/.test(name) || /^[.\d\s]+$/.test(name)) return null;

  const grade = extractGradeNearBirthYear(line);
  const nums = extractNumberSequenceAfterWeight(line);
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
}

/**
 * PDFから抽出したテキストをパースし、競技結果行の配列を返す。
 * ウエイトリフティング結果PDF特化：階級の追跡・体重/生年をアンカーにした選手行の検出。
 */
export function parseResultsFromText(text: string): ParsedResultRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const rows: ParsedResultRow[] = [];
  let currentCategory: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const categoryFromLine = extractCategoryFromLine(line);
    if (categoryFromLine) {
      currentCategory = categoryFromLine;
    }

    if (!isAthleteAnchorLine(line)) continue;
    if (looksLikeHeader(line)) continue;

    const row = parseAthleteLine(line, currentCategory);
    if (row) rows.push(row);
  }

  return rows;
}

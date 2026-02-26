"use server";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const SMART_HEADERS = [
  "階級", "No.", "氏名", "都道府県", "所属名", "学年",
  "生年", "体重", "Sベスト", "S順位", "CJベスト", "CJ順位",
  "トータル", "T順位",
];
const SMART_COL_COUNT = SMART_HEADERS.length;

export type ParsePdfResult =
  | { success: true; grid: string[][]; headers: string[] }
  | { success: false; error: string };

/* ------------------------------------------------------------------ */
/*  Regex / constants                                                 */
/* ------------------------------------------------------------------ */

const CATEGORY_RE =
  /^(45|49|55|59|61|64|67|71|73|76|81|89|96|102|109|\+87|\+109)\s*[Kk]g$/i;
const CATEGORY_NUM_RE =
  /^(45|49|55|59|61|64|67|71|73|76|81|89|96|102|109|\+87|\+109)$/;
const BIRTH_YEAR_RE = /^(19|20)\d{2}$/;
const BODY_WEIGHT_RE = /^\d{2,3}\.\d{2}$/;
const RECORD_NUM_RE = /^\d{1,3}$/;

const PREFECTURES = [
  "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
  "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
  "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜",
  "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫",
  "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口",
  "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎",
  "熊本", "大分", "宮崎", "鹿児島", "沖縄",
];
const PREF_DIRECT_RE = new RegExp(`(${PREFECTURES.join("|")})`);

function hasCJK(s: string): boolean {
  return /[\u3000-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FA1F}]/u.test(s);
}

/* ------------------------------------------------------------------ */
/*  infoString → structured fields                                    */
/* ------------------------------------------------------------------ */

function extractInfoFields(raw: string): {
  no: string;
  name: string;
  prefecture: string;
  affiliation: string;
  grade: string;
} {
  let rest = raw.trim();

  let no = "";
  const noMatch = rest.match(/^(\d+)\s*/);
  if (noMatch) {
    no = noMatch[1];
    rest = rest.slice(noMatch[0].length);
  }

  let grade = "";
  const gradeMatch = rest.match(/\s*(\d)\s*$/);
  if (gradeMatch) {
    grade = gradeMatch[1];
    rest = rest.slice(0, rest.length - gradeMatch[0].length).trim();
  }

  let name = rest;
  let prefecture = "";
  let affiliation = "";

  const directMatch = rest.match(PREF_DIRECT_RE);
  if (directMatch && directMatch.index !== undefined) {
    name = rest.slice(0, directMatch.index).trim();
    prefecture = directMatch[1];
    affiliation = rest.slice(directMatch.index + directMatch[1].length).trim();
  } else {
    for (const pref of PREFECTURES) {
      const pattern = [...pref].join("\\s*");
      const re = new RegExp(pattern);
      const m = rest.match(re);
      if (m && m.index !== undefined) {
        name = rest.slice(0, m.index).trim();
        prefecture = pref;
        affiliation = rest.slice(m.index + m[0].length).trim();
        break;
      }
    }
  }

  return { no, name, prefecture, affiliation, grade };
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */

function padRow(cells: string[]): string[] {
  const row = [...cells];
  while (row.length < SMART_COL_COUNT) row.push("");
  return row;
}

function findInfoStart(
  tokens: string[],
  from: number,
  to: number
): number {
  for (let j = from; j < to; j++) {
    if (hasCJK(tokens[j])) {
      if (j > from && /^\d{1,3}$/.test(tokens[j - 1])) return j - 1;
      return j;
    }
  }
  return to;
}

function extractRecordNumbers(
  tokens: string[],
  start: number,
  count: number
): string[] {
  const lookahead = tokens.slice(start, Math.min(start + count, tokens.length));
  return lookahead.filter((t) => RECORD_NUM_RE.test(t));
}

/* ------------------------------------------------------------------ */
/*  Strategy 1: Body-weight anchor (\d{2,3}\.\d{2})                   */
/* ------------------------------------------------------------------ */

function extractByBodyWeight(tokens: string[]): string[][] {
  const rows: string[][] = [];
  let currentCategory = "";
  let scanStart = 0;

  for (let i = 0; i < tokens.length; i++) {
    if (CATEGORY_RE.test(tokens[i])) {
      currentCategory = tokens[i];
      scanStart = i + 1;
      continue;
    }
    if (
      CATEGORY_NUM_RE.test(tokens[i]) &&
      i + 1 < tokens.length &&
      /^[Kk]g$/i.test(tokens[i + 1])
    ) {
      currentCategory = tokens[i] + tokens[i + 1];
      scanStart = i + 2;
      i++;
      continue;
    }

    if (!BODY_WEIGHT_RE.test(tokens[i])) continue;

    const bodyWeight = tokens[i];
    const infoStart = findInfoStart(tokens, scanStart, i);
    const rawInfo = [...tokens.slice(infoStart, i)];

    let birthYear = "";
    if (
      rawInfo.length > 0 &&
      BIRTH_YEAR_RE.test(rawInfo[rawInfo.length - 1])
    ) {
      birthYear = rawInfo.pop()!;
    }

    const infoString = rawInfo.join(" ");
    const { no, name, prefecture, affiliation, grade } =
      extractInfoFields(infoString);

    const numbers = extractRecordNumbers(tokens, i + 1, 30);

    rows.push(
      padRow([
        currentCategory, no, name, prefecture, affiliation, grade,
        birthYear, bodyWeight,
        numbers[6] ?? "", numbers[7] ?? "",
        numbers[8] ?? "", numbers[9] ?? "",
        numbers[10] ?? "", numbers[11] ?? "",
      ])
    );

    scanStart = i + 1;
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Strategy 2: Birth-year anchor ((19|20)\d{2})                      */
/* ------------------------------------------------------------------ */

function extractByBirthYear(tokens: string[]): string[][] {
  const rows: string[][] = [];
  let currentCategory = "";
  let scanStart = 0;

  for (let i = 0; i < tokens.length; i++) {
    if (CATEGORY_RE.test(tokens[i])) {
      currentCategory = tokens[i];
      scanStart = i + 1;
      continue;
    }
    if (
      CATEGORY_NUM_RE.test(tokens[i]) &&
      i + 1 < tokens.length &&
      /^[Kk]g$/i.test(tokens[i + 1])
    ) {
      currentCategory = tokens[i] + tokens[i + 1];
      scanStart = i + 2;
      i++;
      continue;
    }

    if (!BIRTH_YEAR_RE.test(tokens[i])) continue;

    const birthYear = tokens[i];
    const infoStart = findInfoStart(tokens, scanStart, i);
    const infoString = tokens.slice(infoStart, i).join(" ");
    const { no, name, prefecture, affiliation, grade } =
      extractInfoFields(infoString);

    const bodyWeight =
      i + 1 < tokens.length && BODY_WEIGHT_RE.test(tokens[i + 1])
        ? tokens[i + 1]
        : "";
    const recordStart = bodyWeight ? i + 2 : i + 1;
    const numbers = extractRecordNumbers(tokens, recordStart, 30);

    rows.push(
      padRow([
        currentCategory, no, name, prefecture, affiliation, grade,
        birthYear, bodyWeight,
        numbers[6] ?? "", numbers[7] ?? "",
        numbers[8] ?? "", numbers[9] ?? "",
        numbers[10] ?? "", numbers[11] ?? "",
      ])
    );

    scanStart = recordStart;
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Strategy 3: Prefecture anchor (47 prefectures)                    */
/* ------------------------------------------------------------------ */

function extractByPrefecture(tokens: string[]): string[][] {
  const rows: string[][] = [];
  let currentCategory = "";
  let scanStart = 0;

  for (let i = 0; i < tokens.length; i++) {
    if (CATEGORY_RE.test(tokens[i])) {
      currentCategory = tokens[i];
      scanStart = i + 1;
      continue;
    }
    if (
      CATEGORY_NUM_RE.test(tokens[i]) &&
      i + 1 < tokens.length &&
      /^[Kk]g$/i.test(tokens[i + 1])
    ) {
      currentCategory = tokens[i] + tokens[i + 1];
      scanStart = i + 2;
      i++;
      continue;
    }

    if (!PREF_DIRECT_RE.test(tokens[i])) continue;

    const prefecture = tokens[i];
    const infoStart = findInfoStart(tokens, scanStart, i);

    let no = "";
    let name = "";
    const before = tokens.slice(infoStart, i);
    if (before.length > 0 && /^\d{1,3}$/.test(before[0])) {
      no = before.shift()!;
    }
    name = before.join(" ");

    let affiliation = "";
    let grade = "";
    let birthYear = "";
    let bodyWeight = "";
    const after: string[] = [];

    for (let j = i + 1; j < Math.min(i + 10, tokens.length); j++) {
      const t = tokens[j];
      if (!bodyWeight && BODY_WEIGHT_RE.test(t)) {
        bodyWeight = t;
        const nums = extractRecordNumbers(tokens, j + 1, 30);
        rows.push(
          padRow([
            currentCategory, no, name, prefecture, affiliation, grade,
            birthYear, bodyWeight,
            nums[6] ?? "", nums[7] ?? "",
            nums[8] ?? "", nums[9] ?? "",
            nums[10] ?? "", nums[11] ?? "",
          ])
        );
        scanStart = j + 1;
        break;
      }
      if (!birthYear && BIRTH_YEAR_RE.test(t)) {
        birthYear = t;
        continue;
      }
      if (!grade && /^\d$/.test(t)) {
        grade = t;
        continue;
      }
      if (hasCJK(t)) {
        after.push(t);
        continue;
      }
    }
    affiliation = after.join(" ");

    if (!bodyWeight) {
      rows.push(
        padRow([
          currentCategory, no, name, prefecture, affiliation, grade,
          birthYear, bodyWeight,
        ])
      );
      scanStart = i + 1;
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                      */
/* ------------------------------------------------------------------ */

function parseSmartRows(text: string): string[][] {
  try {
    const tokens = text.split(/\s+/).filter((t) => t.length > 0);

    const bw = extractByBodyWeight(tokens);
    if (bw.length > 0) return bw;

    const by = extractByBirthYear(tokens);
    if (by.length > 0) return by;

    const pref = extractByPrefecture(tokens);
    if (pref.length > 0) return pref;

    return [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Server Action                                                     */
/* ------------------------------------------------------------------ */

export async function parsePdf(formData: FormData): Promise<ParsePdfResult> {
  try {
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { success: false, error: "PDFファイルを選択してください。" };
    }
    if (file.type !== "application/pdf") {
      return { success: false, error: "PDF形式のファイルを選択してください。" };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `ファイルサイズは${MAX_FILE_SIZE_MB}MB以下にしてください。`,
      };
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    let text = "";
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(buffer, { mergePages: true });
      text = typeof result.text === "string" ? result.text : "";
    } catch (extractError) {
      const msg =
        extractError instanceof Error
          ? extractError.message
          : String(extractError);
      console.error("[parsePdf] unpdf extractText failed:", msg);
      return {
        success: false,
        error: `PDFのテキスト抽出に失敗しました: ${msg}`,
      };
    }

    if (!text.trim()) {
      return {
        success: false,
        error:
          "PDFからテキストを抽出できませんでした。画像ベースのPDFの場合はOCR処理が必要です。",
      };
    }

    const smartRows = parseSmartRows(text);
    if (smartRows.length > 0) {
      return { success: true, grid: smartRows, headers: SMART_HEADERS };
    }

    const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
    const rawGrid = lines.map((l) =>
      l.split(/\s+/).filter((c) => c.length > 0)
    );
    if (rawGrid.length === 0) {
      return {
        success: false,
        error: "PDFからデータ行を検出できませんでした。",
      };
    }
    const maxCols = Math.max(...rawGrid.map((r) => r.length));
    const normalized = rawGrid.map((r) => {
      const p = [...r];
      while (p.length < maxCols) p.push("");
      return p;
    });
    const genericHeaders =
      normalized[0]?.map((_, idx) => `列${idx + 1}`) ?? [];

    return { success: true, grid: normalized, headers: genericHeaders };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `PDFの読み取りに失敗しました: ${message}`,
    };
  }
}

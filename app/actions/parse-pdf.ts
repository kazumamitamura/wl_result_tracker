"use server";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** スマート抽出時の固定14カラム */
const SMART_HEADERS = [
  "階級", "No.", "氏名", "都道府県", "所属名", "学年",
  "生年", "体重", "Sベスト", "S順位", "CJベスト", "CJ順位",
  "トータル", "T順位",
];

export type ParsePdfResult =
  | { success: true; grid: string[][]; headers: string[] }
  | { success: false; error: string };

const CATEGORY_RE =
  /^(45|49|55|59|61|64|67|71|73|76|81|89|96|102|109|\+87|\+109)\s*[Kk]g$/i;
const CATEGORY_NUM_RE =
  /^(45|49|55|59|61|64|67|71|73|76|81|89|96|102|109|\+87|\+109)$/;
const BIRTH_YEAR_RE = /^(19|20)\d{2}$/;
const RECORD_NUM_RE = /^\d{1,3}$/;

function safeToken(tokens: string[], idx: number): string {
  return idx >= 0 && idx < tokens.length ? tokens[idx] : "";
}

/**
 * Token-based pre-parser: 生年をアンカーとして選手データを14列に整形する。
 * 抽出できない場合は空配列を返し、呼び出し元でフォールバックさせる。
 */
function parseAthleteTokens(text: string): string[][] {
  try {
    const tokens = text.split(/\s+/).filter((t) => t.length > 0);
    const rows: string[][] = [];
    let currentCategory = "";

    for (let i = 0; i < tokens.length; i++) {
      if (CATEGORY_RE.test(tokens[i])) {
        currentCategory = tokens[i];
        continue;
      }
      if (
        CATEGORY_NUM_RE.test(tokens[i]) &&
        i + 1 < tokens.length &&
        /^[Kk]g$/i.test(tokens[i + 1])
      ) {
        currentCategory = tokens[i] + tokens[i + 1];
        i++;
        continue;
      }

      if (!BIRTH_YEAR_RE.test(tokens[i])) continue;

      const birthYear = tokens[i];
      const grade = safeToken(tokens, i - 1);
      const affiliation = safeToken(tokens, i - 2);
      const prefecture = safeToken(tokens, i - 3);
      const firstName = safeToken(tokens, i - 4);
      const lastName = safeToken(tokens, i - 5);
      const name = (lastName + " " + firstName).trim();
      const no = safeToken(tokens, i - 6);
      const bodyWeight = safeToken(tokens, i + 1);

      const lookahead = tokens.slice(i + 2, Math.min(i + 32, tokens.length));
      const numbers = lookahead.filter((t) => RECORD_NUM_RE.test(t));

      rows.push([
        currentCategory,
        no,
        name,
        prefecture,
        affiliation,
        grade,
        birthYear,
        bodyWeight,
        numbers[6] ?? "",
        numbers[7] ?? "",
        numbers[8] ?? "",
        numbers[9] ?? "",
        numbers[10] ?? "",
        numbers[11] ?? "",
      ]);
    }
    return rows;
  } catch {
    return [];
  }
}

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

    const athleteRows = parseAthleteTokens(text);
    if (athleteRows.length > 0) {
      return { success: true, grid: athleteRows, headers: SMART_HEADERS };
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
    const genericHeaders = normalized[0]?.map((_, idx) => `列${idx + 1}`) ?? [];

    return { success: true, grid: normalized, headers: genericHeaders };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `PDFの読み取りに失敗しました: ${message}`,
    };
  }
}

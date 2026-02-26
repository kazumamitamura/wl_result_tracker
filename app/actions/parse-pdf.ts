"use server";

import { parseResultsFromText } from "@/lib/parse-results";
import type { ParsedResultRow } from "@/types/database";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type ParsePdfResult =
  | { success: true; rows: ParsedResultRow[] }
  | { success: false; error: string };

function sanitizeParsedRows(rows: ParsedResultRow[]): ParsedResultRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const safeNum = (v: unknown): number | null => {
      if (v === undefined || v === null) return null;
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isNaN(n) || !Number.isFinite(n)) return null;
      return n;
    };
    const safeStr = (v: unknown): string => {
      if (v === undefined || v === null) return "";
      return typeof v === "string" ? v : String(v);
    };
    const safeNullableStr = (v: unknown): string | null => {
      if (v === undefined || v === null) return null;
      return typeof v === "string" ? v : String(v);
    };
    return {
      athlete_name: safeStr(row?.athlete_name),
      category: safeNullableStr(row?.category),
      age_grade: safeNullableStr(row?.age_grade),
      snatch_best: safeNum(row?.snatch_best),
      snatch_rank: safeNum(row?.snatch_rank),
      cj_best: safeNum(row?.cj_best),
      cj_rank: safeNum(row?.cj_rank),
      total_weight: safeNum(row?.total_weight),
      total_rank: safeNum(row?.total_rank),
    };
  });
}

/**
 * pdfjs-dist を直接使ってテキストを抽出する。
 * @napi-rs/canvas は optionalDependencies なので無くても動作する。
 * pdf-parse v2 のラッパーを避けることで Vercel 環境での native module クラッシュを回避。
 */
async function extractTextWithPdfjs(data: Uint8Array): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items ?? [];
    const strings: string[] = [];
    for (const item of items) {
      if (item != null && typeof item === "object" && "str" in item) {
        const s = (item as { str: string }).str;
        if (typeof s === "string") strings.push(s);
      }
    }
    pageTexts.push(strings.join(" "));
  }
  doc.destroy();
  return pageTexts.join("\n");
}

/**
 * pdf-parse v2（PDFParse クラス）でテキスト抽出を試みる。
 * ネイティブモジュールが無い環境では動的 import が失敗するため、呼び出し側でフォールバックする。
 */
async function extractTextWithPdfParse(data: Uint8Array): Promise<string> {
  const mod = await import("pdf-parse");
  const parser = new mod.PDFParse({ data });
  const result = await parser.getText();
  const text = typeof result?.text === "string" ? result.text : "";
  await parser.destroy();
  return text;
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
      return { success: false, error: `ファイルサイズは${MAX_FILE_SIZE_MB}MB以下にしてください。` };
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    let text = "";

    // 1st: pdf-parse v2 (ローカルや canvas が使える環境向け)
    try {
      text = await extractTextWithPdfParse(buffer);
    } catch (e1) {
      console.log("[parsePdf] pdf-parse failed, falling back to pdfjs-dist:", String(e1));
      // 2nd: pdfjs-dist 直接 (Vercel 等 native module が使えない環境向け)
      try {
        text = await extractTextWithPdfjs(buffer);
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2);
        return { success: false, error: `PDFのテキスト抽出に失敗しました: ${msg}` };
      }
    }

    console.log("=== RAW PDF TEXT START ===");
    console.log(text);
    console.log("=== RAW PDF TEXT END ===");

    if (!text.trim()) {
      return { success: false, error: "PDFからテキストを抽出できませんでした。" };
    }

    let rows: ParsedResultRow[];
    try {
      rows = parseResultsFromText(text);
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError);
      return { success: false, error: `データの抽出に失敗しました: ${msg}` };
    }

    if (!Array.isArray(rows)) {
      return { success: false, error: "データの抽出に失敗しました。（結果が不正です）" };
    }

    let sanitized: ParsedResultRow[];
    try {
      sanitized = sanitizeParsedRows(rows);
    } catch (sanitizeError) {
      const msg = sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError);
      return { success: false, error: `データのサニタイズに失敗しました: ${msg}` };
    }

    return { success: true, rows: sanitized };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `PDFの読み取りに失敗しました: ${message}` };
  }
}

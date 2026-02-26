"use server";

import { PDFParse } from "pdf-parse";
import { parseResultsFromText } from "@/lib/parse-results";
import type { ParsedResultRow } from "@/types/database";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type ParsePdfResult =
  | { success: true; rows: ParsedResultRow[] }
  | { success: false; error: string };

/**
 * フロントエンドに返す前に配列をサニタイズする。
 * NaN / undefined を除去し、Next.js がシリアライズできる安全なオブジェクトだけを返す。
 */
function sanitizeParsedRows(rows: ParsedResultRow[]): ParsedResultRow[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const safeNum = (v: unknown): number | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === "number") {
        if (Number.isNaN(v)) return null;
        if (!Number.isFinite(v)) return null;
        return v;
      }
      const n = Number(v);
      if (Number.isNaN(n) || !Number.isFinite(n)) return null;
      return n;
    };
    const safeStr = (v: unknown): string => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string") return v;
      return String(v);
    };

    return {
      athlete_name: safeStr(row?.athlete_name),
      category: (() => {
        const s = row?.category;
        if (s === undefined || s === null) return null;
        return typeof s === "string" ? s : String(s);
      })(),
      age_grade: (() => {
        const s = row?.age_grade;
        if (s === undefined || s === null) return null;
        return typeof s === "string" ? s : String(s);
      })(),
      snatch_best: safeNum(row?.snatch_best),
      snatch_rank: safeNum(row?.snatch_rank),
      cj_best: safeNum(row?.cj_best),
      cj_rank: safeNum(row?.cj_rank),
      total_weight: safeNum(row?.total_weight),
      total_rank: safeNum(row?.total_rank),
    };
  });
}

export async function parsePdf(formData: FormData): Promise<ParsePdfResult> {
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

  let parser: PDFParse | null = null;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = typeof textResult?.text === "string" ? textResult.text : "";
    console.log("=== RAW PDF TEXT START ===");
    console.log(text);
    console.log("=== RAW PDF TEXT END ===");
    await parser.destroy();
    parser = null;

    if (!text.trim()) {
      return { success: false, error: "PDFからテキストを抽出できませんでした。" };
    }

    let rows: ParsedResultRow[];
    try {
      rows = parseResultsFromText(text);
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError);
      return {
        success: false,
        error: `データの抽出に失敗しました: ${msg}`,
      };
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
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // ignore
      }
    }
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `PDFの読み取りに失敗しました: ${message}`,
    };
  }
}

"use server";

import { PDFParse } from "pdf-parse";
import { parseResultsFromText } from "@/lib/parse-results";
import type { ParsedResultRow } from "@/types/database";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type ParsePdfResult =
  | { success: true; rows: ParsedResultRow[] }
  | { success: false; error: string };

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
    const text = textResult.text ?? "";
    console.log("=== RAW PDF TEXT START ===");
    console.log(text);
    console.log("=== RAW PDF TEXT END ===");
    await parser.destroy();
    parser = null;

    if (!text.trim()) {
      return { success: false, error: "PDFからテキストを抽出できませんでした。" };
    }

    const rows = parseResultsFromText(text);
    return { success: true, rows };
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

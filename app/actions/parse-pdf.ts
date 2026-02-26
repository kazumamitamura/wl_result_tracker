"use server";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type ParsePdfResult =
  | { success: true; grid: string[][] }
  | { success: false; error: string };

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
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(buffer, { mergePages: true });
      text = typeof result.text === "string" ? result.text : "";
    } catch (extractError) {
      const msg = extractError instanceof Error ? extractError.message : String(extractError);
      console.error("[parsePdf] unpdf extractText failed:", msg);
      return { success: false, error: `PDFのテキスト抽出に失敗しました: ${msg}` };
    }

    if (!text.trim()) {
      return {
        success: false,
        error: "PDFからテキストを抽出できませんでした。画像ベースのPDFの場合はOCR処理が必要です。",
      };
    }

    const lines = text.split(/\n/).filter((line) => line.trim().length > 0);
    const grid = lines.map((line) => line.split(/\s+/).filter((cell) => cell.length > 0));

    if (grid.length === 0) {
      return { success: false, error: "PDFからデータ行を検出できませんでした。" };
    }

    const maxCols = Math.max(...grid.map((row) => row.length));
    const normalized = grid.map((row) => {
      const padded = [...row];
      while (padded.length < maxCols) padded.push("");
      return padded;
    });

    return { success: true, grid: normalized };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `PDFの読み取りに失敗しました: ${message}` };
  }
}

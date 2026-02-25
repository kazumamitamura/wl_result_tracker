import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ResultRow } from "@/app/actions/search";

function getCompetition(row: ResultRow): ResultRow["wlre_competitions"] {
  const c = row.wlre_competitions;
  return Array.isArray(c) ? c[0] ?? null : c;
}

/**
 * ファイル名を生成: [年度]_[大会名]_競技結果.xlsx
 * 複数大会が混在する場合は 検索結果_YYYY-MM-DD_HHmm.xlsx
 */
function getFilename(rows: ResultRow[]): string {
  if (rows.length === 0) return `競技結果_${formatDate(new Date())}.xlsx`;
  const comp = getCompetition(rows[0]);
  const year = comp?.competition_year;
  const name = comp?.name?.replace(/[/\\?*\[\]:]/g, "_")?.trim() || "大会";
  const allSameComp = rows.every((r) => {
    const c = getCompetition(r);
    return c?.id === comp?.id;
  });
  if (allSameComp && year != null) {
    return `${year}_${name}_競技結果.xlsx`;
  }
  return `検索結果_${formatDate(new Date())}.xlsx`;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}_${h}${min}`;
}

const HEADERS = [
  "大会名",
  "選手名",
  "学年/年齢",
  "階級",
  "スナッチ(ベスト/順位)",
  "C&J(ベスト/順位)",
  "トータル(重量/順位)",
] as const;

function rowToExcelRow(row: ResultRow): (string | number)[] {
  const comp = getCompetition(row);
  const fmt = (v: number | null, r: number | null) => {
    if (v != null && r != null) return `${v} / ${r}`;
    if (v != null) return String(v);
    if (r != null) return `— / ${r}`;
    return "—";
  };
  return [
    comp?.name ?? "—",
    row.athlete_name.trim() || "—",
    row.age_grade ?? "—",
    row.category ?? "—",
    fmt(row.snatch_best, row.snatch_rank),
    fmt(row.cj_best, row.cj_rank),
    fmt(row.total_weight, row.total_rank),
  ];
}

export async function exportToExcel(rows: ResultRow[]): Promise<void> {
  if (rows.length === 0) return;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("競技結果", {
    pageSetup: {
      paperSize: 9, // A4 (isolatedModules のため enum ではなく数値)
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // ヘッダー行
  const headerRow = ws.addRow(HEADERS as unknown as (string | number)[]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8D6" }, // 薄いオレンジ
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 22;

  // データ行
  const dataRows = rows.map(rowToExcelRow);
  dataRows.forEach((cells) => {
    const r = ws.addRow(cells);
    r.alignment = { vertical: "middle" };
    // 数字列（5,6,7列目）は右寄せ
    [5, 6, 7].forEach((col) => {
      const cell = r.getCell(col);
      cell.alignment = { ...cell.alignment, horizontal: "right" };
    });
  });

  // 列幅
  ws.columns = [
    { width: 28 }, // 大会名
    { width: 16 }, // 選手名
    { width: 12 }, // 学年/年齢
    { width: 10 }, // 階級
    { width: 20 }, // スナッチ
    { width: 20 }, // C&J
    { width: 20 }, // トータル
  ];

  // 全セルに罫線
  const lastRow = ws.rowCount;
  const lastCol = HEADERS.length;
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, getFilename(rows));
}

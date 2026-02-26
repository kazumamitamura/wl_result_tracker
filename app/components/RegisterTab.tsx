"use client";

import { useCallback, useState, useTransition } from "react";
import { parsePdf } from "@/app/actions/parse-pdf";
import { saveCompetitionAndResults } from "@/app/actions/save-competition";
import type { ParsedResultRow } from "@/types/database";
import {
  FileUp,
  Loader2,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Column mapping definitions                                        */
/* ------------------------------------------------------------------ */

const COLUMN_MAPPINGS = [
  { value: "ignore", label: "無視する" },
  { value: "athlete_name", label: "選手名" },
  { value: "category", label: "カテゴリ(階級)" },
  { value: "age_grade", label: "学年/年齢" },
  { value: "snatch_best", label: "スナッチベスト" },
  { value: "snatch_rank", label: "スナッチ順位" },
  { value: "cj_best", label: "C&Jベスト" },
  { value: "cj_rank", label: "C&J順位" },
  { value: "total_weight", label: "トータル重量" },
  { value: "total_rank", label: "トータル順位" },
] as const;

type MappingValue = (typeof COLUMN_MAPPINGS)[number]["value"];

const NUM_FIELDS = new Set<MappingValue>([
  "snatch_best",
  "snatch_rank",
  "cj_best",
  "cj_rank",
  "total_weight",
  "total_rank",
]);

/** スマート抽出（14列）時のデフォルトマッピング */
const SMART_DEFAULT_MAPPINGS: MappingValue[] = [
  "category",      // 階級
  "ignore",        // No.
  "athlete_name",  // 氏名
  "ignore",        // 都道府県
  "ignore",        // 所属名
  "age_grade",     // 学年
  "ignore",        // 生年
  "ignore",        // 体重
  "snatch_best",   // Sベスト
  "snatch_rank",   // S順位
  "cj_best",       // CJベスト
  "cj_rank",       // CJ順位
  "total_weight",  // トータル
  "total_rank",    // T順位
];

/* ------------------------------------------------------------------ */
/*  Grid → DB rows conversion                                        */
/* ------------------------------------------------------------------ */

function gridToResults(
  grid: string[][],
  mappings: MappingValue[]
): ParsedResultRow[] {
  return grid.map((row) => {
    const out: ParsedResultRow = {
      athlete_name: "",
      category: null,
      age_grade: null,
      snatch_best: null,
      snatch_rank: null,
      cj_best: null,
      cj_rank: null,
      total_weight: null,
      total_rank: null,
    };
    mappings.forEach((mapping, colIdx) => {
      if (mapping === "ignore") return;
      const raw = (row[colIdx] ?? "").trim();
      if (mapping === "athlete_name") {
        out.athlete_name = raw;
      } else if (mapping === "category" || mapping === "age_grade") {
        out[mapping] = raw || null;
      } else if (NUM_FIELDS.has(mapping)) {
        const n = Number(raw);
        (out as Record<string, unknown>)[mapping] = Number.isFinite(n)
          ? n
          : null;
      }
    });
    return out;
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function RegisterTab() {
  const [file, setFile] = useState<File | null>(null);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<MappingValue[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [competitionYear, setCompetitionYear] = useState<string>(() =>
    String(new Date().getFullYear())
  );
  const [competitionName, setCompetitionName] = useState("");
  const [saveMessage, setSaveMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [isParsing, startParseTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  /* ---- handlers ---- */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setParseError(null);
    setSaveMessage(null);
  };

  const handleParse = () => {
    if (!file) return;
    setParseError(null);
    setSaveMessage(null);
    const fd = new FormData();
    fd.set("file", file);
    startParseTransition(async () => {
      try {
        const result = await parsePdf(fd);
        if (!result || !result.success) {
          setParseError(
            (!result ? null : "error" in result ? result.error : null) ??
              "PDFの解析に失敗しました。"
          );
          setGrid(null);
          setHeaders([]);
          setMappings([]);
          return;
        }
        const g = result.grid;
        const h = result.headers;
        setGrid(g);
        setHeaders(h);

        const isSmart =
          h.length === SMART_DEFAULT_MAPPINGS.length &&
          h[0] === "階級";
        setMappings(
          isSmart
            ? [...SMART_DEFAULT_MAPPINGS]
            : g.length > 0
              ? g[0].map(() => "ignore" as MappingValue)
              : []
        );
        setParseError(null);
      } catch {
        setParseError("PDFの解析に失敗しました。");
        setGrid(null);
        setHeaders([]);
        setMappings([]);
      }
    });
  };

  const updateCell = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      setGrid((prev) => {
        if (!prev) return prev;
        const next = prev.map((r) => [...r]);
        next[rowIdx][colIdx] = value;
        return next;
      });
    },
    []
  );

  const deleteRow = useCallback((rowIdx: number) => {
    setGrid((prev) => (prev ? prev.filter((_, i) => i !== rowIdx) : prev));
  }, []);

  const deleteColumn = useCallback((colIdx: number) => {
    setGrid((prev) =>
      prev ? prev.map((row) => row.filter((_, i) => i !== colIdx)) : prev
    );
    setHeaders((prev) => prev.filter((_, i) => i !== colIdx));
    setMappings((prev) => prev.filter((_, i) => i !== colIdx));
  }, []);

  const moveColumn = useCallback((colIdx: number, direction: -1 | 1) => {
    const target = colIdx + direction;
    const swap = <T,>(arr: T[]) => {
      const n = [...arr];
      [n[colIdx], n[target]] = [n[target], n[colIdx]];
      return n;
    };
    setGrid((prev) => (prev ? prev.map((row) => swap(row)) : prev));
    setHeaders(swap);
    setMappings(swap);
  }, []);

  const addRow = useCallback(() => {
    setGrid((prev) => {
      if (!prev) return prev;
      const cols = prev[0]?.length ?? 0;
      return [...prev, Array<string>(cols).fill("")];
    });
  }, []);

  const updateMapping = useCallback(
    (colIdx: number, value: MappingValue) => {
      setMappings((prev) => {
        const next = [...prev];
        next[colIdx] = value;
        return next;
      });
    },
    []
  );

  const handleSave = () => {
    if (!grid || grid.length === 0) {
      setSaveMessage({ type: "error", text: "保存するデータがありません。" });
      return;
    }
    const hasMapping = mappings.some((m) => m !== "ignore");
    if (!hasMapping) {
      setSaveMessage({
        type: "error",
        text: "少なくとも1つの列にマッピングを設定してください。",
      });
      return;
    }
    const year = parseInt(competitionYear, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      setSaveMessage({
        type: "error",
        text: "対象年度は1900〜2100の数値を入力してください。",
      });
      return;
    }
    if (!competitionName.trim()) {
      setSaveMessage({ type: "error", text: "大会名を入力してください。" });
      return;
    }
    setSaveMessage(null);
    startSaveTransition(async () => {
      const rows = gridToResults(grid, mappings);
      const result = await saveCompetitionAndResults(
        year,
        competitionName.trim(),
        rows
      );
      if (result.success) {
        setSaveMessage({ type: "ok", text: "データベースに保存しました。" });
        setGrid(null);
        setHeaders([]);
        setMappings([]);
        setCompetitionName("");
      } else {
        setSaveMessage({ type: "error", text: result.error });
      }
    });
  };

  const colCount = mappings.length;

  /* ---- render ---- */

  return (
    <section className="space-y-6 rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        データ登録（PDF読み込み）
      </h2>

      {/* PDF upload */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            PDFファイル
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="block w-full max-w-xs text-sm text-zinc-600 file:mr-3 file:rounded file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-amber-800 dark:file:bg-amber-900/40 dark:file:text-amber-200"
          />
        </label>
        <button
          type="button"
          onClick={handleParse}
          disabled={!file || isParsing}
          className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600"
        >
          {isParsing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="size-4" aria-hidden />
          )}
          {isParsing ? "解析中…" : "PDFを解析"}
        </button>
      </div>

      {parseError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {parseError}
        </p>
      )}

      {/* Spreadsheet editor */}
      {grid && grid.length > 0 && (
        <>
          <div className="space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              PDFから <strong>{grid.length}</strong> 行 ×{" "}
              <strong>{colCount}</strong> 列のデータを検出しました。
              不要な行・列を削除し、各列のマッピングを確認してから保存してください。
            </p>
            <div className="flex gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Trash2 className="size-3" /> 行・列を削除
              </span>
              <span className="inline-flex items-center gap-1">
                <ChevronLeft className="size-3" />
                <ChevronRight className="size-3" /> 列を移動
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <table className="border-collapse text-sm">
              <thead>
                {/* Row 1: Column mapping selects + controls */}
                <tr className="border-b border-zinc-300 bg-blue-50 dark:border-zinc-600 dark:bg-blue-950/40">
                  <th className="sticky left-0 z-10 border-r border-zinc-200 bg-blue-50 px-1 py-1 dark:border-zinc-700 dark:bg-blue-950/40">
                    <span className="text-[10px] font-medium text-zinc-400">
                      マッピング
                    </span>
                  </th>
                  {mappings.map((mapping, ci) => (
                    <th key={ci} className="px-1 py-1">
                      <div className="flex flex-col items-center gap-1">
                        <select
                          value={mapping}
                          onChange={(e) =>
                            updateMapping(ci, e.target.value as MappingValue)
                          }
                          className={`w-full min-w-[7rem] rounded border px-1 py-0.5 text-[11px] ${
                            mapping === "ignore"
                              ? "border-zinc-300 bg-zinc-50 text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500"
                              : "border-blue-400 bg-blue-50 font-semibold text-blue-700 dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {COLUMN_MAPPINGS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={ci === 0}
                            onClick={() => moveColumn(ci, -1)}
                            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            title="列を左へ移動"
                          >
                            <ChevronLeft className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteColumn(ci)}
                            className="rounded p-0.5 text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                            title="列を削除"
                          >
                            <Trash2 className="size-3" />
                          </button>
                          <button
                            type="button"
                            disabled={ci === colCount - 1}
                            onClick={() => moveColumn(ci, 1)}
                            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            title="列を右へ移動"
                          >
                            <ChevronRight className="size-3" />
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>

                {/* Row 2: Column header labels */}
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <th className="sticky left-0 z-10 border-r border-zinc-200 bg-zinc-100 px-2 py-1 text-center text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
                    #
                  </th>
                  {headers.map((header, ci) => (
                    <th
                      key={ci}
                      className="whitespace-nowrap px-2 py-1 text-center text-[10px] font-medium text-zinc-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {grid.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-zinc-100 hover:bg-zinc-50/80 dark:border-zinc-700/50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="sticky left-0 z-10 border-r border-zinc-200 bg-white px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => deleteRow(ri)}
                          className="rounded p-0.5 text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                          title="行を削除"
                        >
                          <Trash2 className="size-3" />
                        </button>
                        <span className="w-5 text-center text-[10px] text-zinc-400">
                          {ri + 1}
                        </span>
                      </div>
                    </td>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-0.5 py-0.5">
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) =>
                            updateCell(ri, ci, e.target.value)
                          }
                          className={`w-full min-w-[4rem] rounded border px-1.5 py-0.5 text-xs ${
                            mappings[ci] === "ignore"
                              ? "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-500"
                              : "border-zinc-300 bg-white text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add row button */}
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
          >
            <Plus className="size-3.5" />
            行を追加
          </button>

          {/* Year, competition name, save */}
          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                対象年度（西暦）
              </span>
              <input
                type="number"
                min={1900}
                max={2100}
                value={competitionYear}
                onChange={(e) => setCompetitionYear(e.target.value)}
                className="w-28 rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                大会名
              </span>
              <input
                type="text"
                value={competitionName}
                onChange={(e) => setCompetitionName(e.target.value)}
                placeholder="例: 〇〇高等学校 校内大会"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </label>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {isSaving ? "保存中…" : "データベースに保存"}
            </button>
          </div>
        </>
      )}

      {saveMessage && (
        <p
          role="alert"
          className={
            saveMessage.type === "ok"
              ? "text-sm text-green-700 dark:text-green-400"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {saveMessage.text}
        </p>
      )}
    </section>
  );
}

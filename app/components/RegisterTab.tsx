"use client";

import { useState, useTransition } from "react";
import { parsePdf } from "@/app/actions/parse-pdf";
import { saveCompetitionAndResults } from "@/app/actions/save-competition";
import type { ParsedResultRow } from "@/types/database";
import { FileUp, Loader2, Save } from "lucide-react";

function cellValue(
  v: string | number | null | undefined
): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function RegisterTab() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedResultRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [competitionYear, setCompetitionYear] = useState<string>(() =>
    String(new Date().getFullYear())
  );
  const [competitionName, setCompetitionName] = useState("");
  const [saveMessage, setSaveMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isParsing, startParseTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setParseError(null);
    setSaveMessage(null);
    if (!rows && !f) setRows(null);
  };

  const handleParse = () => {
    if (!file) return;
    setParseError(null);
    const fd = new FormData();
    fd.set("file", file);
    startParseTransition(async () => {
      const result = await parsePdf(fd);
      if (result.success) {
        setRows(result.rows);
      } else {
        setParseError(result.error);
        setRows(null);
      }
    });
  };

  const updateRow = (index: number, field: keyof ParsedResultRow, value: string | number | null) => {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const r = { ...next[index] };
      if (field === "athlete_name") r.athlete_name = String(value ?? "").trim();
      else if (field === "category") r.category = value === "" ? null : String(value).trim();
      else if (field === "age_grade") r.age_grade = value === "" ? null : String(value).trim();
      else if (field === "snatch_best" || field === "snatch_rank" || field === "cj_best" || field === "cj_rank" || field === "total_weight" || field === "total_rank") {
        const n = value === "" || value === null ? null : Number(value);
        (r as Record<string, unknown>)[field] = Number.isFinite(n) ? n : null;
      }
      next[index] = r;
      return next;
    });
  };

  const handleSave = () => {
    if (!rows || rows.length === 0) {
      setSaveMessage({ type: "error", text: "保存するデータがありません。" });
      return;
    }
    const year = parseInt(competitionYear, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      setSaveMessage({ type: "error", text: "対象年度は1900〜2100の数値を入力してください。" });
      return;
    }
    setSaveMessage(null);
    startSaveTransition(async () => {
      const result = await saveCompetitionAndResults(year, competitionName.trim(), rows);
      if (result.success) {
        setSaveMessage({ type: "ok", text: "データベースに保存しました。" });
        setRows(null);
        setCompetitionName("");
      } else {
        setSaveMessage({ type: "error", text: result.error });
      }
    });
  };

  return (
    <section className="space-y-6 rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        データ登録（PDF読み込み）
      </h2>

      {/* PDFアップロード */}
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

      {/* 確認・修正テーブル */}
      {rows && rows.length > 0 && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            下表で内容を確認・修正し、対象年度と大会名を入力してから「データベースに保存」を押してください。
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <table className="min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <th className="px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">選手名</th>
                  <th className="px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">階級</th>
                  <th className="px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">学年/年齢</th>
                  <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">スナッチ(kg)</th>
                  <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">スナッチ順位</th>
                  <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">C&amp;J(kg)</th>
                  <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">C&amp;J順位</th>
                  <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">トータル(kg)</th>
                  <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">トータル順位</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-100 dark:border-zinc-700/70"
                  >
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={row.athlete_name}
                        onChange={(e) => updateRow(i, "athlete_name", e.target.value)}
                        className="w-full min-w-[6rem] rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={cellValue(row.category)}
                        onChange={(e) => updateRow(i, "category", e.target.value || null)}
                        className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={cellValue(row.age_grade)}
                        onChange={(e) => updateRow(i, "age_grade", e.target.value || null)}
                        className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={cellValue(row.snatch_best)}
                        onChange={(e) => updateRow(i, "snatch_best", e.target.value === "" ? null : e.target.value)}
                        className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cellValue(row.snatch_rank)}
                        onChange={(e) => updateRow(i, "snatch_rank", e.target.value === "" ? null : e.target.value)}
                        className="w-14 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={cellValue(row.cj_best)}
                        onChange={(e) => updateRow(i, "cj_best", e.target.value === "" ? null : e.target.value)}
                        className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cellValue(row.cj_rank)}
                        onChange={(e) => updateRow(i, "cj_rank", e.target.value === "" ? null : e.target.value)}
                        className="w-14 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={cellValue(row.total_weight)}
                        onChange={(e) => updateRow(i, "total_weight", e.target.value === "" ? null : e.target.value)}
                        className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cellValue(row.total_rank)}
                        onChange={(e) => updateRow(i, "total_rank", e.target.value === "" ? null : e.target.value)}
                        className="w-14 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 対象年度・大会名・保存ボタン */}
          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">対象年度（西暦）</span>
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
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">大会名</span>
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

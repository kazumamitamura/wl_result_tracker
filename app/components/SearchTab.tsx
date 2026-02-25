"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getFilterOptions,
  searchResults,
  type ResultRow,
  type FilterOptions,
  type SearchFilters,
} from "@/app/actions/search";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-excel";

type SortKey =
  | "athlete_name"
  | "competition_year"
  | "competition_name"
  | "category"
  | "age_grade"
  | "snatch_best"
  | "snatch_rank"
  | "cj_best"
  | "cj_rank"
  | "total_weight"
  | "total_rank";
type SortDir = "asc" | "desc";

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: "athlete_name", label: "選手名" },
  { key: "competition_year", label: "年度" },
  { key: "competition_name", label: "大会名" },
  { key: "category", label: "階級" },
  { key: "age_grade", label: "学年/年齢" },
  { key: "snatch_best", label: "スナッチ(kg)" },
  { key: "snatch_rank", label: "スナッチ順位" },
  { key: "cj_best", label: "C&J(kg)" },
  { key: "cj_rank", label: "C&J順位" },
  { key: "total_weight", label: "トータル(kg)" },
  { key: "total_rank", label: "トータル順位" },
];

function getCompetition(row: ResultRow): ResultRow["wlre_competitions"] {
  const c = row.wlre_competitions;
  return Array.isArray(c) ? c[0] ?? null : c;
}

function getSortValue(row: ResultRow, key: SortKey): string | number | null {
  const comp = getCompetition(row);
  if (key === "competition_name") return comp?.name ?? "";
  if (key === "competition_year") return comp?.competition_year ?? 0;
  const v = row[key as keyof ResultRow];
  if (v === null || v === undefined) return "";
  return v as string | number;
}

function sortRows(rows: ResultRow[], key: SortKey, dir: SortDir): ResultRow[] {
  return [...rows].sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);
    const na = typeof va === "number";
    const nb = typeof vb === "number";
    let cmp = 0;
    if (na && nb) {
      cmp = (va as number) - (vb as number);
    } else {
      cmp = String(va).localeCompare(String(vb));
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function TableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <table className="min-w-[800px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
            {SORT_KEYS.map(({ label }) => (
              <th key={label} className="px-2 py-3 text-left font-medium">
                <span className="inline-block h-4 w-16 animate-pulse rounded bg-zinc-300 dark:bg-zinc-600" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <tr key={i} className="border-b border-zinc-100 dark:border-zinc-700/70">
              {SORT_KEYS.map((_, j) => (
                <td key={j} className="px-2 py-2">
                  <span
                    className="inline-block h-4 w-full max-w-[6rem] animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"
                    style={{ animationDelay: `${i * 50}ms` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchTab() {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [filters, setFilters] = useState<SearchFilters>({
    year: null,
    competitionName: "",
    athleteName: "",
    category: "",
  });

  const [results, setResults] = useState<ResultRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("total_weight");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [exporting, setExporting] = useState(false);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError(null);
    const res = await getFilterOptions();
    if (res.success) {
      setOptions(res.data);
    } else {
      setOptionsError(res.error);
      setOptions(null);
    }
    setOptionsLoading(false);
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const runSearch = useCallback(async () => {
    setSearchLoading(true);
    setSearchError(null);
    const res = await searchResults(filters);
    if (res.success) {
      setResults(res.data);
    } else {
      setSearchError(res.error);
      setResults([]);
    }
    setSearchLoading(false);
  }, [filters]);

  useEffect(() => {
    if (!options) return;
    runSearch();
    // 初回のみ: フィルター選択肢読み込み後に検索実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedResults = sortRows(results, sortKey, sortDir);

  const renderCell = (row: ResultRow, key: SortKey) => {
    const comp = getCompetition(row);
    if (key === "competition_name") return comp?.name ?? "—";
    if (key === "competition_year") return comp?.competition_year ?? "—";
    const v = row[key as keyof ResultRow];
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  };

  return (
    <section className="space-y-6 rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        データ検索・一覧
      </h2>

      {/* フィルターバー */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        {optionsLoading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="size-4 animate-spin" />
            フィルター選択肢を読み込み中…
          </div>
        )}
        {optionsError && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400" role="alert">
            <AlertCircle className="size-4 shrink-0" />
            {optionsError}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              年度
            </span>
            <select
              value={filters.year ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  year: e.target.value === "" ? null : parseInt(e.target.value, 10),
                }))
              }
              disabled={optionsLoading}
              className="min-w-[6rem] rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 disabled:opacity-50"
            >
              <option value="">すべて</option>
              {options?.years.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              大会名
            </span>
            <input
              type="text"
              value={filters.competitionName}
              onChange={(e) =>
                setFilters((f) => ({ ...f, competitionName: e.target.value }))
              }
              placeholder="部分一致で検索"
              list="competition-list"
              className="min-w-[12rem] rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <datalist id="competition-list">
              {options?.competitionNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              選手名
            </span>
            <input
              type="text"
              value={filters.athleteName}
              onChange={(e) =>
                setFilters((f) => ({ ...f, athleteName: e.target.value }))
              }
              placeholder="部分一致で検索"
              className="min-w-[10rem] rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              階級
            </span>
            <input
              type="text"
              value={filters.category}
              onChange={(e) =>
                setFilters((f) => ({ ...f, category: e.target.value }))
              }
              placeholder="部分一致"
              list="category-list"
              className="min-w-[7rem] rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <datalist id="category-list">
              {options?.categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            onClick={runSearch}
            disabled={searchLoading}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            {searchLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            {searchLoading ? "検索中…" : "検索"}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (sortedResults.length === 0) return;
              setExporting(true);
              try {
                await exportToExcel(sortedResults);
              } finally {
                setExporting(false);
              }
            }}
            disabled={sortedResults.length === 0 || exporting}
            className="inline-flex items-center gap-2 rounded-md border-2 border-green-600 bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:border-zinc-300 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:border-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
            title={sortedResults.length === 0 ? "検索結果を表示後に出力できます" : "表示中の検索結果をExcelでダウンロード"}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="size-4" aria-hidden />
            )}
            {exporting ? "出力中…" : "Excelで出力"}
          </button>
        </div>
      </div>

      {/* 検索結果テーブル */}
      <div className="space-y-2">
        {searchLoading && results.length === 0 && <TableSkeleton />}
        {!searchLoading && searchError && (
          <div
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
            role="alert"
          >
            <AlertCircle className="size-4 shrink-0" />
            {searchError}
          </div>
        )}
        {!searchLoading && !searchError && results.length === 0 && (
          <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
            条件に一致するデータがありません。
          </p>
        )}
        {!searchLoading && !searchError && results.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {sortedResults.length} 件
                {searchLoading && "（再検索中…）"}
              </p>
              <button
                type="button"
                onClick={async () => {
                  setExporting(true);
                  try {
                    await exportToExcel(sortedResults);
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-md border-2 border-green-600 bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-70 dark:border-green-500 dark:bg-green-600 dark:hover:bg-green-700"
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="size-4" aria-hidden />
                )}
                {exporting ? "出力中…" : "Excelで出力"}
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <table className="min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                    {SORT_KEYS.map(({ key, label }) => (
                      <th key={key} className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleSort(key)}
                          className="flex w-full items-center justify-between gap-1 font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                        >
                          {label}
                          {sortKey === key ? (
                            sortDir === "asc" ? (
                              <ChevronUp className="size-4 shrink-0" />
                            ) : (
                              <ChevronDown className="size-4 shrink-0" />
                            )
                          ) : (
                            <span className="size-4 shrink-0" />
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-700/70 dark:hover:bg-zinc-800/50"
                    >
                      {SORT_KEYS.map((col) => (
                        <td
                          key={col.key}
                          className={`px-2 py-2 text-zinc-900 dark:text-zinc-100 ${
                            col.key === "snatch_best" ||
                            col.key === "cj_best" ||
                            col.key === "total_weight"
                              ? "text-right tabular-nums"
                              : ""
                          } ${col.key === "snatch_rank" || col.key === "cj_rank" || col.key === "total_rank" ? "text-right tabular-nums" : ""}`}
                        >
                          {renderCell(row, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

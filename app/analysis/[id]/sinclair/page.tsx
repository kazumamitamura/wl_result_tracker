"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getCompetitionResultsForMvp } from "@/app/actions/get-competition-mvp";
import type { MvpResultRow } from "@/app/actions/get-competition-mvp";
import { calculateSinclair, parseBodyweightFromCategory } from "@/lib/sinclair";
import { ArrowLeft, Trophy } from "lucide-react";

type MvpRow = MvpResultRow & {
  bodyweight: number;
  sinclair: number;
};

export default function SinclairMvpPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [competitionName, setCompetitionName] = useState("");
  const [rows, setRows] = useState<MvpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("大会IDがありません。");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCompetitionResultsForMvp(id).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setCompetitionName(result.competitionName);
        const withSinclair: MvpRow[] = result.data
          .map((r) => {
            const total = r.total_weight != null ? Number(r.total_weight) : 0;
            const bodyweight = parseBodyweightFromCategory(r.category);
            const sinclair =
              total > 0 && bodyweight > 0
                ? calculateSinclair(total, bodyweight, false)
                : 0;
            return { ...r, bodyweight, sinclair };
          })
          .filter((r) => r.sinclair > 0)
          .sort((a, b) => b.sinclair - a.sinclair);
        setRows(withSinclair);
      } else {
        setError(result.error);
        setRows([]);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-600 dark:text-zinc-400">読み込み中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline dark:text-amber-400"
          >
            <ArrowLeft className="size-4" />
            トップへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            href={id ? `/analysis/${id}` : "/"}
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            <ArrowLeft className="size-4" />
            分析ページへ戻る
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            <Trophy className="size-6 text-amber-500" aria-hidden />
            {competitionName} — シンクレア係数 MVPランキング
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            IWF 2021-2024 係数で算出。体重は階級から推定しています。
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            シンクレアを算出できるデータがありません（トータル・階級が必須です）。
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      順位
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      選手名
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      階級
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300">
                      トータル(kg)
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300">
                      推定体重(kg)
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300">
                      シンクレア
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-b border-zinc-100 dark:border-zinc-700/70"
                    >
                      <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                        {row.athlete_name}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {row.category ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {row.total_weight != null ? row.total_weight : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {row.bodyweight}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-amber-700 dark:text-amber-400">
                        {row.sinclair.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

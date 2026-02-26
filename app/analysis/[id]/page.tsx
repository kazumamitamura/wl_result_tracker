"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getCompetitionAnalysis } from "@/app/actions/get-competition-analysis";
import type { CompetitionAnalysisRow } from "@/app/actions/get-competition-analysis";
import { ArrowLeft, Download, Loader2, Trophy } from "lucide-react";

export default function AnalysisPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [name, setName] = useState<string>("");
  const [data, setData] = useState<CompetitionAnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("大会IDがありません。");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCompetitionAnalysis(id).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setName(result.competitionName);
        setData(result.data);
      } else {
        setError(result.error);
        setData([]);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePdfDownload = useCallback(async () => {
    const el = chartRef.current;
    if (!el || data.length === 0) return;

    setPdfLoading(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.height / canvas.width;
      const imgH = pageW * ratio;
      const y = imgH > pageH ? 0 : (pageH - imgH) / 2;
      pdf.addImage(imgData, "PNG", 0, y, pageW, imgH > pageH ? pageH : imgH);

      const safeName = name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80);
      const filename = `${safeName}_階級別上位平均レポート.pdf`;
      pdf.save(filename);
    } finally {
      setPdfLoading(false);
    }
  }, [data.length, name]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          読み込み中…
        </div>
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
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              <ArrowLeft className="size-4" />
              トップへ戻る
            </Link>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {name} — 階級別上位10名平均
            </h1>
          </div>
          <button
            type="button"
            onClick={handlePdfDownload}
            disabled={pdfLoading || data.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            {pdfLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            PDFでダウンロード
          </button>
          {id && (
            <Link
              href={`/analysis/${id}/sinclair`}
              className="inline-flex items-center gap-2 rounded-md border border-amber-600 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:bg-zinc-900 dark:text-amber-400 dark:hover:bg-amber-950/30"
            >
              <Trophy className="size-4" aria-hidden />
              MVPランキング（シンクレア）
            </Link>
          )}
        </div>

        {data.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            この大会には階級別の集計データがありません。
          </p>
        ) : (
          <div
            ref={chartRef}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 12, right: 20, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e4e4e7"
                    className="dark:stroke-zinc-600"
                  />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 12, fill: "#71717a" }}
                    stroke="#a1a1aa"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#71717a" }}
                    stroke="#a1a1aa"
                    label={{
                      value: "平均重量（kg）",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "#71717a", fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        avgSnatch: "スナッチ",
                        avgCj: "C&J",
                        avgTotal: "トータル",
                      };
                      return [
                        `${Number(value ?? 0)} kg`,
                        name ? labels[name] ?? name : "",
                      ];
                    }}
                    labelFormatter={(label) => `階級: ${label}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => {
                      if (value === "avgSnatch") return "スナッチ";
                      if (value === "avgCj") return "C&J";
                      if (value === "avgTotal") return "トータル";
                      return value;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgSnatch"
                    name="avgSnatch"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#2563eb" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgCj"
                    name="avgCj"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#16a34a" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgTotal"
                    name="avgTotal"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#dc2626" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              各階級のトータル重量上位10名の平均値（kg）
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

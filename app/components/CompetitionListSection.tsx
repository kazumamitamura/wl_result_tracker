"use client";

import { useCallback, useEffect, useState } from "react";
import { getCompetitionsList } from "@/app/actions/search";
import { deleteCompetition } from "@/app/actions/delete-competition";
import type { CompetitionListItem } from "@/app/actions/search";
import { Loader2, Trash2 } from "lucide-react";

export function CompetitionListSection() {
  const [list, setList] = useState<CompetitionListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await getCompetitionsList();
    if (result.success) {
      setList(result.data);
    } else {
      setLoadError(result.error);
      setList([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleDelete = useCallback(
    async (item: CompetitionListItem) => {
      const message = `「${item.name}」（${item.competition_year}年）のデータと、それに紐づく全選手の記録を完全に削除します。よろしいですか？`;
      if (!window.confirm(message)) return;

      setDeletingId(item.id);
      setFeedback(null);

      const result = await deleteCompetition(item.id);

      if (result.success) {
        setFeedback("削除しました。");
        await fetchList();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback(`削除に失敗しました: ${result.error}`);
      }

      setDeletingId(null);
    },
    [fetchList]
  );

  return (
    <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        登録済みの大会一覧
      </h2>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          読み込み中…
        </div>
      )}

      {loadError && (
        <p className="py-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {loadError}
        </p>
      )}

      {feedback && !loading && (
        <p
          className="mb-2 text-sm text-green-700 dark:text-green-400"
          role="status"
        >
          {feedback}
        </p>
      )}

      {!loading && list.length === 0 && !loadError && (
        <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
          登録された大会はありません。
        </p>
      )}

      {!loading && list.length > 0 && (
        <ul className="space-y-2" role="list">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-100 py-2 pl-3 pr-2 dark:border-zinc-700"
            >
              <span className="text-sm text-zinc-900 dark:text-zinc-100">
                {item.name}
                <span className="ml-1.5 text-zinc-500 dark:text-zinc-400">
                  （{item.competition_year}年）
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleDelete(item)}
                disabled={deletingId !== null}
                className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
                aria-label={`「${item.name}」を削除する`}
              >
                {deletingId === item.id ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden />
                )}
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

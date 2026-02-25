"use client";

import { useState } from "react";
import { FileUp, Search } from "lucide-react";

type TabId = "register" | "search";

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "register", label: "データ登録（PDF読み込み）", icon: <FileUp className="size-4" /> },
  { id: "search", label: "データ検索・一覧", icon: <Search className="size-4" /> },
];

export function TabLayout() {
  const [activeTab, setActiveTab] = useState<TabId>("register");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      {/* タブナビゲーション */}
      <div className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="-mb-px flex gap-1" aria-label="タブ">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-400"
                    : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* メインエリア */}
      <main className="flex-1 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {activeTab === "register" && (
            <section className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                データ登録（PDF読み込み）
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                大会結果PDFをアップロードしてデータを登録する画面です。（Step 2 で実装予定）
              </p>
            </section>
          )}
          {activeTab === "search" && (
            <section className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                データ検索・一覧
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                大会・選手・階級などで検索し、結果一覧を表示する画面です。（Step 2 で実装予定）
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

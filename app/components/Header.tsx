"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          ウエイトリフティング 大会結果
        </Link>
        <nav className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="hidden sm:inline">wl_result_tracker</span>
        </nav>
      </div>
    </header>
  );
}

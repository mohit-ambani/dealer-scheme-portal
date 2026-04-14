"use client";
import { useMemo } from "react";

export function usePagination<T>(items: T[], pageSize: number, page: number) {
  return useMemo(() => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageItems = items.slice(start, end);
    return { pageItems, total, totalPages, safePage, start, end };
  }, [items, pageSize, page]);
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  onChange: (page: number) => void;
  accent?: "orange" | "blue" | "purple" | "green" | "red";
  label?: string;
}

export function Pagination({ page, totalPages, total, start, end, onChange, accent = "orange", label = "items" }: PaginationProps) {
  if (total === 0) return null;
  const accentBg: Record<string, string> = {
    orange: "bg-orange-500 hover:bg-orange-600",
    blue: "bg-blue-500 hover:bg-blue-600",
    purple: "bg-purple-500 hover:bg-purple-600",
    green: "bg-green-500 hover:bg-green-600",
    red: "bg-red-500 hover:bg-red-600",
  };
  const activeBg = accentBg[accent];

  // Window of page numbers to show (max 5 including ellipsis logic)
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    const from = Math.max(2, page - 1);
    const to = Math.min(totalPages - 1, page + 1);
    for (let i = from; i <= to; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-t border-gray-100 flex-wrap">
      <div className="text-xs text-gray-500">
        Showing <span className="font-semibold text-gray-700">{start + 1}</span>–<span className="font-semibold text-gray-700">{end}</span> of <span className="font-semibold text-gray-700">{total}</span> {label}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          ← Prev
        </button>
        {pages.map((p, i) => p === "…" ? (
          <span key={`e${i}`} className="px-2 text-gray-400 text-xs">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              p === page ? `${activeBg} text-white` : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

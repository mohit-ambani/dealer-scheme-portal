"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pagination, usePagination } from "@/components/Pagination";

interface Scheme {
  id: number; name: string; scheme_code: string; description: string;
  status: string; start_date: string; end_date: string;
  incentive_type: string; is_backdated: boolean;
  applicable_regions: string[]; applicable_dealer_types: string[];
  rule_count: number; bonus_count: number; ai_prompt: string;
}

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 12;

  useEffect(() => {
    fetch("/api/schemes").then(r => r.json()).then(d => { setSchemes(d); setLoading(false); });
  }, []);

  const filtered = filter === "all" ? schemes : schemes.filter(s => s.status === filter);
  const { pageItems, total, totalPages, safePage, start, end } = usePagination(filtered, pageSize, page);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scheme Management</h1>
          <p className="text-gray-500 mt-1">{schemes.length} total schemes configured</p>
        </div>
        <Link href="/admin/schemes/create" className="px-6 py-3 bg-gw-orange-gradient text-white rounded-xl font-semibold hover:shadow-lg transition-shadow flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          AI Create Scheme
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {["all", "active", "draft", "paused", "expired"].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
            {f} {f === "all" ? `(${schemes.length})` : `(${schemes.filter(s => s.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Scheme Cards */}
      <div className="grid gap-4">
        {pageItems.map(scheme => (
          <Link key={scheme.id} href={`/admin/schemes/${scheme.id}`}
            className="bg-white rounded-2xl p-6 shadow-sm card-hover block border border-transparent hover:border-blue-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{scheme.name}</h3>
                  <span className={`status-${scheme.status} px-3 py-1 rounded-full text-xs font-semibold capitalize`}>{scheme.status}</span>
                  {scheme.is_backdated && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Backdated</span>}
                  {scheme.ai_prompt && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">AI Created</span>}
                </div>
                <p className="text-gray-500 text-sm mb-3">{scheme.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-gray-400 font-mono">{scheme.scheme_code}</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">{scheme.start_date} → {scheme.end_date}</span>
                  <span className="px-2 py-1 bg-green-50 text-green-700 rounded capitalize">{scheme.incentive_type.replace("_", " ")}</span>
                  <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded">{scheme.rule_count} rules</span>
                  {Number(scheme.bonus_count) > 0 && <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded">{scheme.bonus_count} combo bonus</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {(scheme.applicable_regions || []).map(r => (
                    <span key={r} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] capitalize">{r}</span>
                  ))}
                  {(scheme.applicable_dealer_types || []).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-teal-50 text-teal-600 rounded text-[10px] capitalize">{t.replace("_", " ")}</span>
                  ))}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <Pagination page={safePage} totalPages={totalPages} total={total} start={start} end={end} onChange={setPage} accent="orange" label="schemes" />
      </div>
    </div>
  );
}

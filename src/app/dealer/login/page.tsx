"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pagination, usePagination } from "@/components/Pagination";

interface Dealer {
  id: number;
  name: string;
  code?: string;
  city?: string;
  state?: string;
  dealer_type?: string;
  invoice_count?: number;
  total_purchase?: number;
}

export default function DealerLoginPage() {
  const router = useRouter();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetch("/api/dealers")
      .then(r => r.json())
      .then(d => { setDealers(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleLogin = (id: number | string) => {
    router.push(`/dealer?id=${id}`);
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    handleLogin(userId.trim());
  };

  const filtered = search.trim()
    ? dealers.filter(d =>
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.code?.toLowerCase().includes(search.toLowerCase()) ||
        d.city?.toLowerCase().includes(search.toLowerCase()) ||
        String(d.id).includes(search)
      )
    : dealers;

  const { pageItems, total, totalPages, safePage, start, end } = usePagination(filtered, pageSize, page);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#2d4a72] to-[#f47920]/30">
      <div className="max-w-lg mx-auto px-4 pt-10 pb-8">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl font-black text-[#1e3a5f]">GW</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Greatwhite Dealer Portal</h1>
          <p className="text-white/70 text-sm mt-1">Select your account to continue</p>
        </div>

        {/* Manual ID login */}
        <form onSubmit={handleManualLogin} className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <label className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Log in with User ID</label>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your dealer ID"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#f47920] focus:ring-2 focus:ring-orange-100"
            />
            <button
              type="submit"
              className="bg-[#f47920] hover:bg-orange-600 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
              disabled={!userId.trim()}
            >
              Login
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Password not required for testing</p>
        </form>

        {/* Dealer picker */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Quick Select</div>
              <div className="text-sm font-bold text-gray-900">{loading ? "…" : `${dealers.length} Dealers`}</div>
            </div>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search…"
                className="px-3 py-1.5 pl-8 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#f47920] w-40"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="p-8 text-center text-gray-400 text-sm">Loading dealers…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No dealers found</div>
            )}
            {!loading && pageItems.map(d => (
              <button
                key={d.id}
                onClick={() => handleLogin(d.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-orange-50 border-b border-gray-50 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#f47920] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {d.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "D"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{d.name}</div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2">
                    <span className="font-mono">ID: {d.id}</span>
                    {d.code && <span>· {d.code}</span>}
                    {d.city && <span>· {d.city}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {d.dealer_type && (
                    <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">{d.dealer_type}</div>
                  )}
                  <div className="text-[10px] text-gray-500">{d.invoice_count ?? 0} invoices</div>
                </div>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            ))}
          </div>
          {!loading && <Pagination page={safePage} totalPages={totalPages} total={total} start={start} end={end} onChange={setPage} accent="orange" label="dealers" />}
        </div>

        <div className="text-center mt-6 text-white/60 text-[11px]">
          Testing mode · Password not required
        </div>
      </div>
    </div>
  );
}

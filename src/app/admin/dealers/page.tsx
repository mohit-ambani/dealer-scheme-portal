"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pagination, usePagination } from "@/components/Pagination";

interface Dealer { id: number; name: string; code: string; firm_name: string; type: string; region: string; state: string; city: string; phone: string; email: string; gst_number: string; invoice_count: number; total_purchase: number }

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [filterType, setFilterType] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 24;

  useEffect(() => {
    fetch("/api/dealers").then(r => r.json()).then(d => { setDealers(d); setLoading(false); });
  }, []);

  const types = ["all", ...new Set(dealers.map(d => d.type))];
  const regions = ["all", ...new Set(dealers.map(d => d.region))];
  const filtered = dealers.filter(d => {
    if (filterType !== "all" && d.type !== filterType) return false;
    if (filterRegion !== "all" && d.region !== filterRegion) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.name?.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q) || d.firm_name?.toLowerCase().includes(q) || d.city?.toLowerCase().includes(q);
  });
  const { pageItems, total, totalPages, safePage, start, end } = usePagination(filtered, pageSize, page);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Dealer Master</h1>
      <p className="text-gray-500 mb-8">{dealers.length} registered dealers</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-6 mb-4">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Dealer Type</label>
          <div className="flex gap-1">{types.map(t => (
            <button key={t} onClick={() => { setFilterType(t); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filterType === t ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
              {t === "all" ? "All" : t.replace("_", " ")}
            </button>
          ))}</div>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Region</label>
          <div className="flex gap-1">{regions.map(r => (
            <button key={r} onClick={() => { setFilterRegion(r); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filterRegion === r ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
              {r}
            </button>
          ))}</div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Search</label>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name, code, firm, city…"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>

      {/* Dealer Cards */}
      <div className="grid grid-cols-2 gap-4">
        {pageItems.map(dealer => (
          <Link key={dealer.id} href={`/admin/dealers/${dealer.id}`}
            className="bg-white rounded-2xl p-5 shadow-sm card-hover border border-transparent hover:border-blue-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{dealer.name}</h3>
                <p className="text-sm text-gray-500">{dealer.firm_name}</p>
              </div>
              <span className="font-mono text-xs text-gray-400">{dealer.code}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs capitalize">{dealer.type.replace("_", " ")}</span>
              <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs capitalize">{dealer.region}</span>
              <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded text-xs">{dealer.city}, {dealer.state}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3 mt-3">
              <span>{dealer.invoice_count} invoices</span>
              <span className="font-semibold text-gray-900">₹{Number(dealer.total_purchase).toLocaleString("en-IN")}</span>
            </div>
          </Link>
        ))}
        {pageItems.length === 0 && (
          <div className="col-span-2 text-center text-gray-400 text-sm py-12">No dealers match your filters</div>
        )}
      </div>
      <div className="mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <Pagination page={safePage} totalPages={totalPages} total={total} start={start} end={end} onChange={setPage} accent="blue" label="dealers" />
      </div>
    </div>
  );
}

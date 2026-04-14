"use client";
import { useEffect, useState } from "react";
import { Pagination, usePagination } from "@/components/Pagination";

interface SKU { id: number; name: string; code: string; category_id: number; category_name: string; category_code: string; unit_price: number; unit: string; hsn_code: string; is_active: boolean }
interface Category { id: number; name: string; code: string; description: string }

export default function SKUMasterPage() {
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 30;

  useEffect(() => {
    fetch("/api/sku").then(r => r.json()).then(d => {
      setSKUs(d.skus);
      setCategories(d.categories);
      setLoading(false);
    });
  }, []);

  const filtered = skus.filter(s => {
    if (selectedCat && s.category_id !== selectedCat) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q);
  });

  const { pageItems, total, totalPages, safePage, start, end } = usePagination(filtered, pageSize, page);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">SKU Master</h1>
      <p className="text-gray-500 mb-8">{skus.length} products across {categories.length} categories</p>

      {/* Category Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {categories.map(cat => {
          const count = skus.filter(s => s.category_id === cat.id).length;
          const isSelected = selectedCat === cat.id;
          return (
            <button key={cat.id} onClick={() => { setSelectedCat(isSelected ? null : cat.id); setPage(1); }}
              className={`p-4 rounded-xl text-left transition-all card-hover ${isSelected ? "bg-blue-600 text-white shadow-lg" : "bg-white shadow-sm hover:shadow-md"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-mono ${isSelected ? "text-blue-200" : "text-gray-400"}`}>{cat.code}</span>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isSelected ? "bg-white/20" : "bg-blue-50 text-blue-600"}`}>{count}</span>
              </div>
              <div className={`font-semibold text-sm ${isSelected ? "" : "text-gray-900"}`}>{cat.name}</div>
              <div className={`text-xs mt-1 ${isSelected ? "text-blue-200" : "text-gray-400"}`}>{cat.description}</div>
            </button>
          );
        })}
      </div>

      {/* SKU Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-bold text-gray-900">{selectedCat ? categories.find(c => c.id === selectedCat)?.name : "All Products"} ({filtered.length})</h2>
          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or code…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-50">
              <th className="px-6 py-3">Code</th>
              <th className="px-6 py-3">Product Name</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">HSN</th>
              <th className="px-6 py-3 text-right">Unit Price</th>
              <th className="px-6 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageItems.map(sku => (
              <tr key={sku.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-blue-600">{sku.code}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{sku.name}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{sku.category_name}</span></td>
                <td className="px-6 py-4 text-xs text-gray-500">{sku.hsn_code}</td>
                <td className="px-6 py-4 text-right font-semibold">₹{Number(sku.unit_price).toLocaleString("en-IN")}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${sku.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {sku.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={safePage} totalPages={totalPages} total={total} start={start} end={end} onChange={setPage} accent="orange" label="SKUs" />
      </div>
    </div>
  );
}

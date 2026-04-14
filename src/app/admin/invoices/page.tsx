"use client";
import { useEffect, useState } from "react";
import { Pagination, usePagination } from "@/components/Pagination";

interface Invoice { id: number; invoice_number: string; dealer_name: string; dealer_code: string; invoice_date: string; total_amount: number; payment_terms: string; status: string; item_count: number }

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const pageSize = 25;

  useEffect(() => {
    fetch("/api/invoices").then(r => r.json()).then(d => { setInvoices(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const totalValue = invoices.reduce((s, i) => s + Number(i.total_amount), 0);

  const filtered = invoices.filter(inv => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return inv.invoice_number?.toLowerCase().includes(q)
      || inv.dealer_name?.toLowerCase().includes(q)
      || inv.dealer_code?.toLowerCase().includes(q);
  });

  const { pageItems, total, totalPages, safePage, start, end } = usePagination(filtered, pageSize, page);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoice Management</h1>
      <p className="text-gray-500 mb-6">{invoices.length} invoices totaling ₹{totalValue.toLocaleString("en-IN")}</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search invoice # or dealer…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-50">
              <th className="px-6 py-3">Invoice #</th>
              <th className="px-6 py-3">Dealer</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Items</th>
              <th className="px-6 py-3">Payment Terms</th>
              <th className="px-6 py-3 text-right">Amount</th>
              <th className="px-6 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageItems.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-blue-600">{inv.invoice_number}</td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900 text-sm">{inv.dealer_name}</div>
                  <div className="text-xs text-gray-400">{inv.dealer_code}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{inv.invoice_date}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{inv.item_count} items</span></td>
                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{inv.payment_terms}</td>
                <td className="px-6 py-4 text-right font-semibold text-gray-900">₹{Number(inv.total_amount).toLocaleString("en-IN")}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === "confirmed" ? "bg-green-100 text-green-700" : inv.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm">No invoices match your filters</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={safePage} totalPages={totalPages} total={total} start={start} end={end} onChange={setPage} accent="blue" label="invoices" />
      </div>
    </div>
  );
}

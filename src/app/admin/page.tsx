"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Scheme {
  id: number; name: string; status: string; start_date: string; end_date: string;
  incentive_type: string; rule_count: number; bonus_count: number;
  applicable_regions: string[]; applicable_dealer_types: string[];
}

export default function AdminDashboard() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [dealers, setDealers] = useState<{ id: number; name: string; type: string; region: string; total_purchase: number }[]>([]);
  const [skuData, setSkuData] = useState<{ categories: { id: number; name: string }[]; skus: { id: number }[] }>({ categories: [], skus: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/schemes").then(r => r.json()),
      fetch("/api/dealers").then(r => r.json()),
      fetch("/api/sku").then(r => r.json()),
    ]).then(([s, d, sk]) => {
      setSchemes(s);
      setDealers(d);
      setSkuData(sk);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const activeSchemes = schemes.filter(s => s.status === "active");
  const totalDealerPurchase = dealers.reduce((s, d) => s + Number(d.total_purchase || 0), 0);

  const stats = [
    { label: "Active Schemes", value: activeSchemes.length, total: schemes.length, color: "bg-blue-500", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { label: "Total Dealers", value: dealers.length, total: null, color: "bg-green-500", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "SKU Products", value: skuData.skus.length, total: `${skuData.categories.length} categories`, color: "bg-purple-500", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Total Purchase Value", value: `₹${(totalDealerPurchase / 100000).toFixed(1)}L`, total: null, color: "bg-orange-500", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage dealer incentive schemes with AI-powered intelligence</p>
        </div>
        <Link href="/admin/schemes/create" className="px-6 py-3 bg-gw-orange-gradient text-white rounded-xl font-semibold hover:shadow-lg transition-shadow flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Create Scheme with AI
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            {stat.total && <div className="text-xs text-gray-400 mt-1">{typeof stat.total === "number" ? `of ${stat.total} total` : stat.total}</div>}
          </div>
        ))}
      </div>

      {/* Active Schemes */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Active Schemes</h2>
          <Link href="/admin/schemes" className="text-blue-600 text-sm font-medium hover:underline">View All →</Link>
        </div>
        <div className="space-y-4">
          {activeSchemes.slice(0, 5).map(scheme => (
            <Link key={scheme.id} href={`/admin/schemes/${scheme.id}`} className="block p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{scheme.name}</h3>
                    <span className="status-active px-2 py-0.5 rounded-full text-xs font-medium">{scheme.status}</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{scheme.incentive_type.replace("_", " ")}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{scheme.start_date} → {scheme.end_date}</span>
                    <span>{scheme.rule_count} rules</span>
                    {Number(scheme.bonus_count) > 0 && <span className="text-orange-600 font-medium">{scheme.bonus_count} bonus</span>}
                    <span>Regions: {(scheme.applicable_regions || []).join(", ")}</span>
                    <span>Types: {(scheme.applicable_dealer_types || []).join(", ")}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Dealers */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Top Dealers by Purchase</h2>
          <Link href="/admin/dealers" className="text-blue-600 text-sm font-medium hover:underline">View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="pb-3 pl-4">Rank</th>
                <th className="pb-3">Dealer</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Region</th>
                <th className="pb-3 text-right pr-4">Total Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dealers.sort((a, b) => Number(b.total_purchase) - Number(a.total_purchase)).slice(0, 8).map((d, i) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-4">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{i + 1}</span>
                  </td>
                  <td className="py-3 font-medium text-gray-900">{d.name}</td>
                  <td className="py-3"><span className="px-2 py-1 bg-gray-100 rounded-full text-xs capitalize">{d.type.replace("_", " ")}</span></td>
                  <td className="py-3 capitalize text-sm text-gray-600">{d.region}</td>
                  <td className="py-3 text-right pr-4 font-semibold">₹{Number(d.total_purchase).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState, useRef, useCallback } from "react";

interface Category { id: number; name: string; code: string }
interface Scheme { id: number; name: string; scheme_code: string; status: string; start_date: string; end_date: string; incentive_type: string; applicable_regions: string[]; applicable_dealer_types: string[] }
interface Dealer { id: number; name: string; code: string; firm_name: string; type: string; region: string; total_purchase: number; invoice_count: number }

interface SimPurchase { category_id: number; category_name: string; value: number; quantity: number }
interface DealerSim { dealer_id: number; dealer_name: string; dealer_type: string; region: string; purchases: SimPurchase[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SimRuleResult { rule_id: number; rule_name: string; target_met: boolean; progress_percentage: number; incentive_earned: number; incentive_breakdown: string; achieved_value: number; achieved_quantity: number; target: number; condition_type: string; active_slab?: any }
interface SimBonusResult { bonus_name: string; achieved: boolean; bonus_earned: number; breakdown: string }
interface DealerSimResult { dealer_id: number; dealer_name: string; dealer_type: string; region: string; total_revenue: number; total_incentive: number; rules: SimRuleResult[]; bonuses: SimBonusResult[]; cost_percentage: number }
interface Summary { total_dealers: number; dealers_earning: number; min_revenue: number; max_revenue: number; avg_revenue: number; total_revenue: number; min_cost: number; max_cost: number; avg_cost: number; total_cost: number; avg_cost_percentage: number }
interface WhatIfResult { scheme_id: number; scheme_name: string; incentive_type: string; dealer_results: DealerSimResult[]; summary: Summary }

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtL = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : fmt(n);

export default function WhatIfPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<number>(0);
  const [applicableDealers, setApplicableDealers] = useState<Dealer[]>([]);

  // Per-dealer, per-category purchase values: dealerId -> categoryId -> { value, quantity }
  const [simData, setSimData] = useState<Record<number, Record<number, { value: number; quantity: number }>>>({});
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [expandedDealer, setExpandedDealer] = useState<number | null>(null);
  const [uploadingHistorical, setUploadingHistorical] = useState(false);
  const [historicalStats, setHistoricalStats] = useState<{ total_rows: number; matched_rows: number; dealers_found: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load reference data
  useEffect(() => {
    Promise.all([
      fetch("/api/schemes").then(r => r.json()),
      fetch("/api/sku").then(r => r.json()),
      fetch("/api/dealers").then(r => r.json()),
    ]).then(([s, sku, d]) => {
      const activeSchemes = (Array.isArray(s) ? s : s.schemes || []).filter((sc: Scheme) => sc.status === "active");
      setSchemes(activeSchemes);
      setCategories(sku.categories || []);
      setDealers(Array.isArray(d) ? d : []);
    });
  }, []);

  // Filter dealers by scheme applicability
  useEffect(() => {
    if (!selectedScheme) { setApplicableDealers([]); return; }
    const scheme = schemes.find(s => s.id === selectedScheme);
    if (!scheme) return;
    const regions = scheme.applicable_regions || [];
    const types = scheme.applicable_dealer_types || [];
    const filtered = dealers.filter(d => {
      if (regions.length > 0 && !regions.includes(d.region)) return false;
      if (types.length > 0 && !types.includes(d.type)) return false;
      return true;
    });
    setApplicableDealers(filtered);

    // Initialize sim data with zeros (or existing data)
    setSimData(prev => {
      const next = { ...prev };
      for (const d of filtered) {
        if (!next[d.id]) {
          next[d.id] = {};
          for (const c of categories) {
            next[d.id][c.id] = { value: 0, quantity: 0 };
          }
        }
      }
      return next;
    });
    setResult(null);
  }, [selectedScheme, schemes, dealers, categories]);

  const updateSimValue = useCallback((dealerId: number, catId: number, field: "value" | "quantity", val: number) => {
    setSimData(prev => ({
      ...prev,
      [dealerId]: {
        ...prev[dealerId],
        [catId]: { ...prev[dealerId]?.[catId], [field]: val },
      },
    }));
  }, []);

  const fillFromActual = useCallback(() => {
    // Fill sim data from actual dealer purchase totals (distributed proportionally)
    setSimData(prev => {
      const next = { ...prev };
      for (const d of applicableDealers) {
        if (!next[d.id]) next[d.id] = {};
        const totalPurchase = Number(d.total_purchase) || 0;
        const perCat = categories.length > 0 ? Math.round(totalPurchase / categories.length) : 0;
        const perQty = Math.round(perCat / 500) || 10; // rough estimate
        for (const c of categories) {
          next[d.id][c.id] = { value: perCat, quantity: perQty };
        }
      }
      return next;
    });
  }, [applicableDealers, categories]);

  const applyMultiplier = useCallback((multiplier: number) => {
    setSimData(prev => {
      const next: typeof prev = {};
      for (const [did, cats] of Object.entries(prev)) {
        next[Number(did)] = {};
        for (const [cid, data] of Object.entries(cats)) {
          next[Number(did)][Number(cid)] = {
            value: Math.round(data.value * multiplier),
            quantity: Math.round(data.quantity * multiplier),
          };
        }
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSimData(prev => {
      const next: typeof prev = {};
      for (const did of Object.keys(prev)) {
        next[Number(did)] = {};
        for (const c of categories) {
          next[Number(did)][c.id] = { value: 0, quantity: 0 };
        }
      }
      return next;
    });
    setResult(null);
  }, [categories]);

  const runSimulation = async () => {
    if (!selectedScheme) return;
    setSimulating(true);
    setResult(null);

    const dealerSimulations: DealerSim[] = applicableDealers.map(d => ({
      dealer_id: d.id,
      dealer_name: d.name,
      dealer_type: d.type,
      region: d.region,
      purchases: categories.map(c => ({
        category_id: c.id,
        category_name: c.name,
        value: simData[d.id]?.[c.id]?.value || 0,
        quantity: simData[d.id]?.[c.id]?.quantity || 0,
      })).filter(p => p.value > 0 || p.quantity > 0),
    }));

    try {
      const res = await fetch("/api/whatif/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheme_id: selectedScheme, dealer_simulations: dealerSimulations }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else setResult(data);
    } catch (e) { alert(String(e)); }
    setSimulating(false);
  };

  const handleHistoricalUpload = async (file: File) => {
    setUploadingHistorical(true);
    setHistoricalStats(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/whatif/historical", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { alert(data.error); setUploadingHistorical(false); return; }

      setHistoricalStats(data.stats);

      // Fill sim data from historical
      const sims: DealerSim[] = data.dealer_simulations || [];
      setSimData(prev => {
        const next = { ...prev };
        for (const sim of sims) {
          if (!next[sim.dealer_id]) next[sim.dealer_id] = {};
          for (const c of categories) {
            next[sim.dealer_id][c.id] = next[sim.dealer_id]?.[c.id] || { value: 0, quantity: 0 };
          }
          for (const p of sim.purchases) {
            if (next[sim.dealer_id]) {
              next[sim.dealer_id][p.category_id] = { value: p.value, quantity: p.quantity };
            }
          }
        }
        return next;
      });
    } catch (e) { alert(String(e)); }
    setUploadingHistorical(false);
  };

  const selectedSchemeObj = schemes.find(s => s.id === selectedScheme);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">What-If Battleground</h1>
          <p className="text-gray-500 mt-1">Simulate dealer purchases and forecast scheme costs vs revenue</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl border border-red-200">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span className="text-sm font-medium text-red-700">Simulation Mode</span>
        </div>
      </div>

      {/* Scheme Selector */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="text-xs text-gray-400 uppercase font-semibold mb-2 block">Select Scheme</label>
            <select value={selectedScheme} onChange={e => setSelectedScheme(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value={0}>-- Choose a scheme --</option>
              {schemes.map(s => <option key={s.id} value={s.id}>{s.name} ({s.scheme_code})</option>)}
            </select>
          </div>
          {selectedSchemeObj && (
            <>
              <div>
                <label className="text-xs text-gray-400 uppercase font-semibold mb-2 block">Applicable</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(selectedSchemeObj.applicable_regions || []).map(r => <span key={r} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs capitalize">{r}</span>)}
                  {(selectedSchemeObj.applicable_dealer_types || []).map(t => <span key={t} className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs capitalize">{t.replaceAll("_"," ")}</span>)}
                </div>
                <div className="text-xs text-gray-400 mt-2">{applicableDealers.length} dealers eligible</div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-semibold mb-2 block">Period & Type</label>
                <div className="text-sm font-medium text-gray-700">{selectedSchemeObj.start_date} → {selectedSchemeObj.end_date}</div>
                <div className="text-xs text-gray-400 mt-1 capitalize">{selectedSchemeObj.incentive_type.replaceAll("_"," ")}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedScheme > 0 && applicableDealers.length > 0 && (
        <>
          {/* Quick Actions Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-400 font-semibold uppercase">Quick Fill:</span>
            <button onClick={fillFromActual} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 border border-blue-200">
              From Current Purchases
            </button>
            <button onClick={() => applyMultiplier(1.5)} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 border border-green-200">
              1.5x Multiplier
            </button>
            <button onClick={() => applyMultiplier(2)} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 border border-green-200">
              2x Multiplier
            </button>
            <button onClick={() => applyMultiplier(0.5)} className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-100 border border-orange-200">
              0.5x (Conservative)
            </button>
            <button onClick={clearAll} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-200">
              Clear All
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploadingHistorical}
                className="px-4 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 border border-purple-200 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                {uploadingHistorical ? "Uploading..." : "Upload Historical Data"}
              </button>
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { if (e.target.files?.[0]) handleHistoricalUpload(e.target.files[0]); }} />
            </div>
          </div>

          {historicalStats && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4 flex items-center gap-4 text-xs text-purple-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Historical data loaded: {historicalStats.matched_rows}/{historicalStats.total_rows} rows matched, {historicalStats.dealers_found} dealers populated
            </div>
          )}

          {/* Input Table */}
          <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Simulated Purchase Data (per dealer, per category)</h3>
              <div className="text-xs text-gray-400">Enter values in ₹ and quantities in units</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-2 px-3 font-semibold text-gray-500 sticky left-0 bg-gray-50 min-w-[160px]">Dealer</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-500 min-w-[60px]">Type</th>
                    {categories.map(c => (
                      <th key={c.id} className="text-center py-2 px-2 font-semibold text-gray-500 min-w-[140px]" colSpan={2}>
                        <div>{c.name}</div>
                        <div className="flex text-[10px] text-gray-400 font-normal mt-1">
                          <span className="flex-1">Value (₹)</span>
                          <span className="flex-1">Qty</span>
                        </div>
                      </th>
                    ))}
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 min-w-[100px]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {applicableDealers.map(d => {
                    const dealerTotal = categories.reduce((s, c) => s + (simData[d.id]?.[c.id]?.value || 0), 0);
                    return (
                      <tr key={d.id} className="hover:bg-blue-50/30">
                        <td className="py-1.5 px-3 font-medium text-gray-800 sticky left-0 bg-white">
                          <div>{d.name}</div>
                          <div className="text-[10px] text-gray-400">{d.code}</div>
                        </td>
                        <td className="py-1.5 px-2 text-gray-500 capitalize">{d.type.replaceAll("_"," ")}</td>
                        {categories.map(c => {
                          const val = simData[d.id]?.[c.id]?.value || 0;
                          const qty = simData[d.id]?.[c.id]?.quantity || 0;
                          return (
                            <td key={c.id} className="py-1 px-2" colSpan={2}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <input type="range" min={0} max={1000000} step={5000}
                                    value={val}
                                    onChange={e => updateSimValue(d.id, c.id, "value", Number(e.target.value))}
                                    className="flex-1 accent-orange-600 h-1.5" />
                                  <span className="text-[10px] font-semibold text-orange-700 w-[48px] text-right">{val > 0 ? fmtL(val) : "—"}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input type="range" min={0} max={1000} step={1}
                                    value={qty}
                                    onChange={e => updateSimValue(d.id, c.id, "quantity", Number(e.target.value))}
                                    className="flex-1 accent-blue-600 h-1.5" />
                                  <span className="text-[10px] font-semibold text-blue-700 w-[48px] text-right">{qty > 0 ? `${qty}u` : "—"}</span>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-3 text-right font-semibold text-gray-700">{fmtL(dealerTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Run Simulation Button */}
          <div className="text-center mb-8">
            <button onClick={runSimulation} disabled={simulating}
              className="px-12 py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 flex items-center gap-3 mx-auto">
              {simulating ? (
                <><svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Simulating...</>
              ) : (
                <><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Run What-If Simulation</>
              )}
            </button>
          </div>

          {/* Results */}
          {result && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <SummaryCard label="Total Revenue" primary={fmtL(result.summary.total_revenue)} sub={`${result.summary.total_dealers} dealers`} color="blue" />
                <SummaryCard label="Total Scheme Cost" primary={fmtL(result.summary.total_cost)} sub={`${result.summary.avg_cost_percentage}% of revenue`} color="red" />
                <SummaryCard label="Dealers Earning" primary={`${result.summary.dealers_earning} / ${result.summary.total_dealers}`} sub={`${Math.round((result.summary.dealers_earning / result.summary.total_dealers) * 100)}% earning`} color="green" />
                <SummaryCard label="Avg Cost per Dealer" primary={fmtL(result.summary.avg_cost)} sub={`Range: ${fmtL(result.summary.min_cost)} - ${fmtL(result.summary.max_cost)}`} color="orange" />
              </div>

              {/* Revenue vs Cost Breakdown */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    Revenue Analysis
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <MetricBox label="Minimum" value={fmtL(result.summary.min_revenue)} color="blue" />
                    <MetricBox label="Average" value={fmtL(result.summary.avg_revenue)} color="blue" />
                    <MetricBox label="Maximum" value={fmtL(result.summary.max_revenue)} color="blue" />
                  </div>
                  <div className="mt-4 h-3 bg-blue-100 rounded-full overflow-hidden flex">
                    {result.dealer_results.slice().sort((a, b) => a.total_revenue - b.total_revenue).map((d, i) => (
                      <div key={i} className="h-full bg-blue-500 border-r border-blue-200"
                        style={{ width: `${result.summary.total_revenue > 0 ? (d.total_revenue / result.summary.total_revenue) * 100 : 0}%`, opacity: 0.4 + (i / result.dealer_results.length) * 0.6 }}
                        title={`${d.dealer_name}: ${fmtL(d.total_revenue)}`} />
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    Scheme Cost Analysis
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <MetricBox label="Minimum" value={fmtL(result.summary.min_cost)} color="red" />
                    <MetricBox label="Average" value={fmtL(result.summary.avg_cost)} color="red" />
                    <MetricBox label="Maximum" value={fmtL(result.summary.max_cost)} color="red" />
                  </div>
                  <div className="mt-4 h-3 bg-red-100 rounded-full overflow-hidden flex">
                    {result.dealer_results.slice().sort((a, b) => a.total_incentive - b.total_incentive).map((d, i) => (
                      <div key={i} className="h-full bg-red-500 border-r border-red-200"
                        style={{ width: `${result.summary.total_cost > 0 ? (d.total_incentive / result.summary.total_cost) * 100 : 0}%`, opacity: 0.4 + (i / result.dealer_results.length) * 0.6 }}
                        title={`${d.dealer_name}: ${fmtL(d.total_incentive)}`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ROI Visual */}
              <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5f8f] rounded-2xl p-6 mb-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-200 uppercase font-semibold">Scheme ROI</div>
                    <div className="text-4xl font-bold mt-1">
                      {result.summary.total_cost > 0 ? `${Math.round(result.summary.total_revenue / result.summary.total_cost)}:1` : "N/A"}
                    </div>
                    <div className="text-sm text-blue-300 mt-1">For every ₹1 in incentive, you generate {result.summary.total_cost > 0 ? fmt(Math.round(result.summary.total_revenue / result.summary.total_cost)) : "N/A"} in revenue</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-blue-200">Cost-to-Revenue Ratio</div>
                    <div className="text-3xl font-bold mt-1">{result.summary.avg_cost_percentage}%</div>
                    <div className={`text-sm mt-1 ${result.summary.avg_cost_percentage < 3 ? "text-green-300" : result.summary.avg_cost_percentage < 5 ? "text-yellow-300" : "text-red-300"}`}>
                      {result.summary.avg_cost_percentage < 3 ? "Excellent efficiency" : result.summary.avg_cost_percentage < 5 ? "Good efficiency" : "High cost scheme"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dealer-wise Results Table */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Dealer-wise Simulation Results</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                        <th className="text-left py-3 px-4">Dealer</th>
                        <th className="text-left py-3 px-2">Type</th>
                        <th className="text-left py-3 px-2">Region</th>
                        <th className="text-right py-3 px-2">Revenue</th>
                        <th className="text-right py-3 px-2">Incentive Cost</th>
                        <th className="text-right py-3 px-2">Cost %</th>
                        <th className="text-center py-3 px-2">Rules Met</th>
                        <th className="text-center py-3 px-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.dealer_results.sort((a, b) => b.total_incentive - a.total_incentive).map(d => {
                        const rulesMet = d.rules.filter(r => r.target_met).length;
                        return (
                          <tr key={d.dealer_id} className="hover:bg-gray-50" onClick={() => setExpandedDealer(expandedDealer === d.dealer_id ? null : d.dealer_id)}>
                            <td className="py-3 px-4 font-medium">{d.dealer_name}</td>
                            <td className="py-3 px-2 text-xs capitalize text-gray-500">{d.dealer_type.replaceAll("_"," ")}</td>
                            <td className="py-3 px-2 text-xs capitalize text-gray-500">{d.region}</td>
                            <td className="py-3 px-2 text-right font-medium">{fmtL(d.total_revenue)}</td>
                            <td className={`py-3 px-2 text-right font-bold ${d.total_incentive > 0 ? "text-red-600" : "text-gray-300"}`}>{fmtL(d.total_incentive)}</td>
                            <td className="py-3 px-2 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.cost_percentage < 3 ? "bg-green-100 text-green-700" : d.cost_percentage < 5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                {d.cost_percentage}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={`text-xs font-medium ${rulesMet === d.rules.length ? "text-green-600" : rulesMet > 0 ? "text-orange-600" : "text-gray-400"}`}>
                                {rulesMet}/{d.rules.length}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button className="text-blue-600 hover:text-blue-800">
                                <svg className={`w-4 h-4 transition-transform ${expandedDealer === d.dealer_id ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Expanded Dealer Detail */}
                {expandedDealer && (() => {
                  const d = result.dealer_results.find(x => x.dealer_id === expandedDealer);
                  if (!d) return null;
                  return (
                    <div className="border-t-2 border-blue-200 bg-blue-50/30 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">{d.dealer_name.charAt(0)}</div>
                        <div>
                          <div className="font-bold text-gray-900">{d.dealer_name}</div>
                          <div className="text-xs text-gray-500 capitalize">{d.dealer_type.replaceAll("_"," ")} &bull; {d.region} &bull; Revenue: {fmtL(d.total_revenue)}</div>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-2xl font-bold text-red-600">{fmt(d.total_incentive)}</div>
                          <div className="text-xs text-gray-400">Total Incentive Cost</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Rule Breakdown</div>
                          <div className="space-y-2">
                            {d.rules.map(r => (
                              <div key={r.rule_id} className="bg-white rounded-xl p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${r.target_met ? "bg-green-500" : "bg-gray-400"}`}>
                                      {r.target_met ? "✓" : "✗"}
                                    </span>
                                    <span className="text-sm font-medium">{r.rule_name}</span>
                                  </div>
                                  <span className={`text-sm font-bold ${r.incentive_earned > 0 ? "text-green-600" : "text-gray-300"}`}>{fmt(r.incentive_earned)}</span>
                                </div>
                                <div className="ml-7 text-xs text-gray-500">{r.incentive_breakdown}</div>
                                <div className="ml-7 mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${r.target_met ? "bg-green-500" : "bg-blue-400"}`} style={{ width: `${Math.min(r.progress_percentage, 100)}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          {d.bonuses.length > 0 && (
                            <div>
                              <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Bonuses</div>
                              <div className="space-y-2">
                                {d.bonuses.map((b, i) => (
                                  <div key={i} className={`bg-white rounded-xl p-3 border ${b.achieved ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className={b.achieved ? "text-yellow-500" : "text-gray-300"}>{b.achieved ? "★" : "☆"}</span>
                                        <span className="text-sm font-medium">{b.bonus_name}</span>
                                      </div>
                                      <span className={`text-sm font-bold ${b.achieved ? "text-yellow-600" : "text-gray-300"}`}>
                                        {b.achieved ? `+${fmt(b.bonus_earned)}` : "—"}
                                      </span>
                                    </div>
                                    <div className="ml-6 text-xs text-gray-500 mt-1">{b.breakdown}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="mt-4 bg-white rounded-xl p-4 border border-gray-200">
                            <div className="text-xs text-gray-500 font-semibold uppercase mb-3">Cost Analysis</div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-gray-600">Revenue (purchases)</span>
                              <span className="font-semibold text-blue-700">{fmt(d.total_revenue)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-gray-600">Incentive cost</span>
                              <span className="font-semibold text-red-600">-{fmt(d.total_incentive)}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between text-sm">
                              <span className="font-semibold text-gray-900">Net Revenue</span>
                              <span className="font-bold text-green-700">{fmt(d.total_revenue - d.total_incentive)}</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-400">Cost ratio: {d.cost_percentage}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </>
      )}

      {selectedScheme > 0 && applicableDealers.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">🚫</div>
          <h3 className="font-bold text-yellow-800">No Eligible Dealers</h3>
          <p className="text-sm text-yellow-600 mt-1">No dealers match this scheme&apos;s region and type criteria.</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, primary, sub, color }: { label: string; primary: string; sub: string; color: string }) {
  const bg: Record<string, string> = { blue: "bg-blue-50 border-blue-200", red: "bg-red-50 border-red-200", green: "bg-green-50 border-green-200", orange: "bg-orange-50 border-orange-200" };
  const text: Record<string, string> = { blue: "text-blue-700", red: "text-red-700", green: "text-green-700", orange: "text-orange-700" };
  return (
    <div className={`rounded-2xl p-5 border ${bg[color]}`}>
      <div className="text-xs text-gray-400 uppercase font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${text[color]}`}>{primary}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  const text: Record<string, string> = { blue: "text-blue-700", red: "text-red-700" };
  return (
    <div className="text-center p-3 bg-white rounded-xl border border-gray-100">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-bold mt-1 ${text[color]}`}>{value}</div>
    </div>
  );
}

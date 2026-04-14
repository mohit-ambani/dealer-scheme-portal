"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SKU { id: number; name: string; code: string; category_id: number; category_name: string; unit_price: number }
interface Category { id: number; name: string; code: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SimRule { rule_id: number; rule_name: string; target_met: boolean; progress_percentage: number; incentive_earned: number; incentive_breakdown: string; condition_type: string; target: number; achieved_value: number; achieved_quantity: number; active_slab?: any }
interface SimBonus { bonus_name: string; achieved: boolean; bonus_earned: number; breakdown: string }
interface DealerSimResult { dealer_id: number; dealer_name: string; total_revenue: number; total_incentive: number; rules: SimRule[]; bonuses: SimBonus[]; cost_percentage: number }
interface Scheme { id: number; name: string; scheme_code: string; incentive_type: string }
interface SchemeResult { scheme_id: number; scheme_name: string; incentive_type: string; dealer_results: DealerSimResult[] }

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function WhatIfInner() {
  const searchParams = useSearchParams();
  const dealerId = searchParams.get("id") || "1";
  const [skus, setSkus] = useState<SKU[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);

  // SKU-level inputs: skuId -> quantity
  const [skuInputs, setSkuInputs] = useState<Record<number, { qty: number; value: number }>>({});
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState<SchemeResult[]>([]);
  const [expandedScheme, setExpandedScheme] = useState<number | null>(null);
  const [inputMode, setInputMode] = useState<"sku" | "category">("category");
  const [catInputs, setCatInputs] = useState<Record<number, { qty: number; value: number }>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/sku").then(r => r.json()),
      fetch("/api/schemes").then(r => r.json()),
    ]).then(([skuData, schemeData]) => {
      setSkus(skuData.skus || []);
      setCategories(skuData.categories || []);
      setSchemes(Array.isArray(schemeData) ? schemeData.filter((s: Scheme) => s.id) : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const computeCatPurchases = () => {
    if (inputMode === "category") {
      return categories.map(c => ({
        category_id: c.id,
        category_name: c.name,
        value: catInputs[c.id]?.value || 0,
        quantity: catInputs[c.id]?.qty || 0,
      })).filter(p => p.value > 0 || p.quantity > 0);
    }
    // Aggregate SKU inputs by category
    const catAgg: Record<number, { value: number; quantity: number }> = {};
    for (const sku of skus) {
      const input = skuInputs[sku.id];
      if (!input || (input.qty <= 0 && input.value <= 0)) continue;
      if (!catAgg[sku.category_id]) catAgg[sku.category_id] = { value: 0, quantity: 0 };
      catAgg[sku.category_id].value += input.value || (input.qty * Number(sku.unit_price));
      catAgg[sku.category_id].quantity += input.qty || 0;
    }
    return Object.entries(catAgg).map(([catId, data]) => ({
      category_id: Number(catId),
      category_name: categories.find(c => c.id === Number(catId))?.name || '',
      value: Math.round(data.value),
      quantity: data.quantity,
    }));
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setResults([]);

    const purchases = computeCatPurchases();
    if (purchases.length === 0) {
      alert("Please enter some purchase quantities or values");
      setSimulating(false);
      return;
    }

    // Fetch dealer info
    let dealerInfo = { dealer_id: Number(dealerId), dealer_name: "Dealer", dealer_type: "retailer", region: "north" };
    try {
      const dealersRes = await fetch("/api/dealers");
      const dealersData = await dealersRes.json();
      const allDealers = Array.isArray(dealersData) ? dealersData : [];
      const d = allDealers.find((d: Record<string, unknown>) => d.id === Number(dealerId));
      if (d) dealerInfo = { dealer_id: d.id, dealer_name: d.name, dealer_type: d.type, region: d.region };
    } catch { /* use default */ }

    const sim = {
      dealer_id: dealerInfo.dealer_id,
      dealer_name: dealerInfo.dealer_name,
      dealer_type: dealerInfo.dealer_type,
      region: dealerInfo.region,
      purchases,
    };

    // Simulate against all active schemes
    const schemeResults: SchemeResult[] = [];
    for (const scheme of schemes) {
      try {
        const res = await fetch("/api/whatif/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheme_id: scheme.id, dealer_simulations: [sim] }),
        });
        const data = await res.json();
        if (!data.error && data.dealer_results?.length > 0 && data.dealer_results[0].total_incentive > 0) {
          schemeResults.push(data);
        }
      } catch { /* skip */ }
    }

    // Sort by incentive descending
    schemeResults.sort((a, b) => (b.dealer_results[0]?.total_incentive || 0) - (a.dealer_results[0]?.total_incentive || 0));
    setResults(schemeResults);
    setSimulating(false);
  };

  const totalIncentive = results.reduce((s, r) => s + (r.dealer_results[0]?.total_incentive || 0), 0);
  const totalPurchase = computeCatPurchases().reduce((s, p) => s + p.value, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 px-6 pt-8 pb-8 rounded-b-3xl">
        <Link href={`/dealer?id=${dealerId}`} className="text-white/70 text-sm mb-3 inline-flex items-center gap-1 hover:text-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back
        </Link>
        <h1 className="text-2xl font-bold text-white">Incentive Calculator</h1>
        <p className="text-purple-200 text-sm mt-1">Enter what you plan to buy and see all incentives you qualify for</p>
        {results.length > 0 && (
          <div className="mt-4 bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="text-purple-100 text-xs uppercase">Estimated Total Incentives</div>
            <div className="text-4xl font-bold text-white mt-1">{fmt(totalIncentive)}</div>
            <div className="text-purple-200 text-sm mt-1">{results.length} scheme{results.length !== 1 ? "s" : ""} qualifying &bull; on {fmt(totalPurchase)} purchase</div>
          </div>
        )}
      </div>

      {/* Input Mode Toggle */}
      <div className="px-4 mt-4 flex gap-2">
        <button onClick={() => setInputMode("category")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${inputMode === "category" ? "bg-purple-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
          By Category
        </button>
        <button onClick={() => setInputMode("sku")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${inputMode === "sku" ? "bg-purple-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
          By SKU Product
        </button>
      </div>

      {/* Input Section */}
      <div className="px-4 mt-4">
        {inputMode === "category" ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Enter Purchase Plan by Category</h3>
              <p className="text-xs text-gray-400 mt-1">Enter value in ₹ or quantity (units)</p>
            </div>
            <div className="divide-y divide-gray-50">
              {categories.map(c => {
                const val = catInputs[c.id]?.value || 0;
                const qty = catInputs[c.id]?.qty || 0;
                return (
                  <div key={c.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{c.name}</div>
                      <div className="flex gap-2 items-center flex-shrink-0">
                        <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">{fmt(val)}</span>
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{qty} units</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-400 w-14">Value ₹</span>
                        <input type="range" min={0} max={1000000} step={5000}
                          value={val}
                          onChange={e => setCatInputs(prev => ({ ...prev, [c.id]: { ...prev[c.id], value: Number(e.target.value), qty: prev[c.id]?.qty || 0 } }))}
                          className="flex-1 accent-purple-600 h-2" />
                        <span className="text-[9px] text-gray-400 w-10 text-right">10L</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-400 w-14">Qty (u)</span>
                        <input type="range" min={0} max={1000} step={1}
                          value={qty}
                          onChange={e => setCatInputs(prev => ({ ...prev, [c.id]: { ...prev[c.id], qty: Number(e.target.value), value: prev[c.id]?.value || 0 } }))}
                          className="flex-1 accent-indigo-600 h-2" />
                        <span className="text-[9px] text-gray-400 w-10 text-right">1000</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Enter Purchase Plan by SKU</h3>
              <p className="text-xs text-gray-400 mt-1">Enter qty - value auto-calculates from MRP</p>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
              {categories.map(cat => {
                const catSkus = skus.filter(s => s.category_id === cat.id);
                if (catSkus.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0">{cat.name}</div>
                    {catSkus.map(sku => {
                      const qty = skuInputs[sku.id]?.qty || 0;
                      return (
                        <div key={sku.id} className="px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-800 truncate">{sku.name}</div>
                              <div className="text-[10px] text-gray-400">₹{Number(sku.unit_price).toLocaleString("en-IN")}/unit</div>
                            </div>
                            <div className="flex gap-2 items-center flex-shrink-0">
                              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{qty} u</span>
                              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md min-w-[60px] text-right">
                                {qty > 0 ? fmt(qty * Number(sku.unit_price)) : "—"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-400 w-6">0</span>
                            <input type="range" min={0} max={500} step={1}
                              value={qty}
                              onChange={e => {
                                const q = Number(e.target.value);
                                setSkuInputs(prev => ({ ...prev, [sku.id]: { qty: q, value: q * Number(sku.unit_price) } }));
                              }}
                              className="flex-1 accent-purple-600 h-2" />
                            <span className="text-[9px] text-gray-400 w-8 text-right">500</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Calculate Button */}
      <div className="px-4 mt-4">
        <button onClick={handleSimulate} disabled={simulating}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-base shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
          {simulating ? (
            <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Calculating Incentives...</>
          ) : (
            <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Calculate My Incentives</>
          )}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="px-4 mt-6 space-y-4 mb-6">
          <h2 className="font-bold text-gray-900">Qualifying Schemes ({results.length})</h2>

          {results.map(schemeResult => {
            const dr = schemeResult.dealer_results[0];
            if (!dr) return null;
            const expanded = expandedScheme === schemeResult.scheme_id;

            return (
              <div key={schemeResult.scheme_id} className="bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-green-200">
                {/* Scheme Header */}
                <div className="p-4 cursor-pointer" onClick={() => setExpandedScheme(expanded ? null : schemeResult.scheme_id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 uppercase capitalize">{schemeResult.incentive_type.replaceAll("_"," ")}</div>
                      <h3 className="font-semibold text-gray-900 text-sm mt-0.5">{schemeResult.scheme_name}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">{fmt(dr.total_incentive)}</div>
                      <div className="text-[10px] text-gray-400">{dr.rules.filter(r => r.target_met).length}/{dr.rules.length} rules met</div>
                    </div>
                    <svg className={`w-5 h-5 ml-2 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  </div>

                  {/* Quick progress bar */}
                  <div className="mt-3 flex gap-1">
                    {dr.rules.map(r => (
                      <div key={r.rule_id} className="flex-1 h-2 rounded-full overflow-hidden bg-gray-100">
                        <div className={`h-full rounded-full ${r.target_met ? "bg-green-500" : r.progress_percentage > 50 ? "bg-orange-400" : "bg-blue-400"}`}
                          style={{ width: `${Math.min(r.progress_percentage, 100)}%` }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expanded Detail */}
                {expanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {dr.rules.map(rule => (
                      <div key={rule.rule_id} className={`rounded-xl p-3 ${rule.target_met ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${rule.target_met ? "bg-green-500" : "bg-gray-400"}`}>
                              {rule.target_met ? "✓" : "✗"}
                            </span>
                            <span className="text-sm font-medium text-gray-800">{rule.rule_name}</span>
                          </div>
                          <span className={`text-sm font-bold ${rule.incentive_earned > 0 ? "text-green-600" : "text-gray-300"}`}>{fmt(rule.incentive_earned)}</span>
                        </div>
                        <div className="ml-7 text-xs text-gray-500 mb-1">{rule.incentive_breakdown}</div>
                        <div className="ml-7 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${rule.target_met ? "bg-green-500" : "bg-blue-400"}`} style={{ width: `${Math.min(rule.progress_percentage, 100)}%` }} />
                        </div>
                        <div className="ml-7 mt-1 flex justify-between text-[10px] text-gray-400">
                          <span>Achieved: {rule.condition_type === "value" ? fmt(rule.achieved_value) : `${rule.achieved_quantity} units`}</span>
                          <span>Target: {rule.condition_type === "value" ? fmt(rule.target) : `${rule.target} units`}</span>
                        </div>
                      </div>
                    ))}

                    {dr.bonuses.map((b, i) => (
                      <div key={i} className={`rounded-xl p-3 ${b.achieved ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50 border border-gray-200"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={b.achieved ? "text-yellow-500" : "text-gray-300"}>★</span>
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {!simulating && results.length === 0 && totalPurchase === 0 && (
        <div className="px-4 mt-8 text-center">
          <div className="text-4xl mb-3">🧮</div>
          <h3 className="font-bold text-gray-700">Plan Your Purchases</h3>
          <p className="text-sm text-gray-500 mt-1">Enter what you plan to buy and instantly see all incentives you qualify for across all active schemes</p>
        </div>
      )}

      {!simulating && results.length === 0 && totalPurchase > 0 && (
        <div className="px-4 mt-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="font-bold text-gray-700">No qualifying schemes</h3>
          <p className="text-sm text-gray-500 mt-1">Try increasing your purchase quantities to meet scheme targets</p>
        </div>
      )}

      <div className="h-8"></div>
    </div>
  );
}

export default function DealerWhatIfPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
    <WhatIfInner />
  </Suspense>;
}

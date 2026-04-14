"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Slab { slab_from: number; slab_to: number | null; incentive_calc_type: string; incentive_value: number }
interface Rule { id: number; rule_order: number; rule_name: string; sku_category_id: number; sku_id: number; condition_type: string; min_threshold: number; incentive_calc_type: string; incentive_value: number; is_additional: boolean; apply_on: string; description: string; slabs?: Slab[] }
interface BonusRule { id: number; bonus_name: string; required_rule_ids: number[]; bonus_calc_type: string; bonus_value: number; apply_on: string; description: string }
interface SchemeDetail {
  id: number; name: string; description: string; scheme_code: string;
  start_date: string; end_date: string; status: string;
  applicable_regions: string[]; applicable_dealer_types: string[];
  incentive_type: string; is_backdated: boolean; created_date: string;
  ai_prompt: string; calculation_logic: string; notes: string;
  rules: Rule[]; bonus_rules: BonusRule[];
}

interface CalcResult { dealer_id: number; dealer_name: string; total_incentive: number; rules: { rule_name: string; target_met: boolean; progress_percentage: number; incentive_earned: number }[]; error?: string }

export default function SchemeDetailPage() {
  const { id } = useParams();
  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [calcResults, setCalcResults] = useState<CalcResult[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/schemes/${id}`).then(r => r.json()).then(d => { setScheme(d); setLoading(false); });
  }, [id]);

  const handleCalculate = async () => {
    setCalculating(true);
    const res = await fetch(`/api/schemes/${id}/calculate`);
    const data = await res.json();
    setCalcResults(Array.isArray(data) ? data : [data]);
    setCalculating(false);
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/schemes/${id}/report`);
      if (!res.ok) { alert("Failed to generate report"); setDownloading(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Scheme_${id}_Report.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Download failed"); }
    setDownloading(false);
  };

  if (loading || !scheme) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/schemes" className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></Link>
        <h1 className="text-3xl font-bold text-gray-900">{scheme.name}</h1>
        <span className={`status-${scheme.status} px-3 py-1 rounded-full text-xs font-semibold capitalize`}>{scheme.status}</span>
        {scheme.is_backdated && <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">Backdated</span>}
        <button onClick={handleDownloadReport} disabled={downloading}
          className="ml-auto px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
          {downloading ? (
            <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Download Report</>
          )}
        </button>
      </div>
      <p className="text-gray-500 mb-6">{scheme.description}</p>

      {/* Meta */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Period", value: `${scheme.start_date} → ${scheme.end_date}` },
          { label: "Incentive Type", value: scheme.incentive_type.replace("_", " ") },
          { label: "Scheme Code", value: scheme.scheme_code },
          { label: "Created", value: scheme.created_date },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{m.label}</div>
            <div className="font-semibold text-gray-900 capitalize">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Applicability */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Applicability</h2>
        <div className="flex gap-8">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Regions</div>
            <div className="flex gap-2">{(scheme.applicable_regions || []).map(r => <span key={r} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm capitalize font-medium">{r}</span>)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Dealer Types</div>
            <div className="flex gap-2">{(scheme.applicable_dealer_types || []).map(t => <span key={t} className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm capitalize font-medium">{t.replace("_", " ")}</span>)}</div>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Scheme Rules ({scheme.rules.length})</h2>
        <div className="space-y-4">
          {scheme.rules.map((rule, i) => (
            <div key={rule.id} className={`p-5 rounded-xl border-2 ${rule.is_additional ? "border-orange-200 bg-orange-50/30" : "border-gray-100 bg-gray-50/30"}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{i + 1}</span>
                <h3 className="font-semibold text-gray-900">{rule.rule_name}</h3>
                {rule.is_additional && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">Additional / Stacking</span>}
              </div>
              <p className="text-gray-600 text-sm mb-3 ml-11">{rule.description}</p>
              <div className="flex flex-wrap gap-3 ml-11 text-xs">
                <span className="px-2 py-1 bg-white rounded border"><strong>Condition:</strong> {rule.condition_type === "value" ? "Value Based" : "Quantity Based"}</span>
                <span className="px-2 py-1 bg-white rounded border"><strong>Target:</strong> {rule.condition_type === "value" ? `₹${Number(rule.min_threshold).toLocaleString("en-IN")}` : `${rule.min_threshold} units`}</span>
                <span className="px-2 py-1 bg-white rounded border"><strong>Incentive:</strong> {rule.incentive_calc_type === "slab" ? "Slab Based" : rule.incentive_calc_type === "percentage" ? `${rule.incentive_value}%` : rule.incentive_calc_type === "per_unit" ? `₹${rule.incentive_value}/unit` : `₹${Number(rule.incentive_value).toLocaleString("en-IN")} flat`}</span>
                <span className="px-2 py-1 bg-white rounded border"><strong>Apply On:</strong> {rule.apply_on}</span>
              </div>
              {/* Slabs */}
              {rule.slabs && rule.slabs.length > 0 && (
                <div className="ml-11 mt-3">
                  <div className="text-xs font-semibold text-gray-500 mb-2">SLAB STRUCTURE</div>
                  <div className="grid gap-2">
                    {rule.slabs.map((slab, si) => (
                      <div key={si} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border text-sm">
                        <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded flex items-center justify-center text-xs font-bold">{si + 1}</span>
                        <span>₹{Number(slab.slab_from).toLocaleString("en-IN")} {slab.slab_to ? `→ ₹${Number(slab.slab_to).toLocaleString("en-IN")}` : "& above"}</span>
                        <span className="ml-auto font-semibold text-green-700">
                          {slab.incentive_calc_type === "percentage" ? `${slab.incentive_value}%` : `₹${slab.incentive_value}/unit`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bonus Rules */}
      {scheme.bonus_rules.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Combo Bonus Rules</h2>
          {scheme.bonus_rules.map(bonus => (
            <div key={bonus.id} className="p-5 rounded-xl border-2 border-yellow-200 bg-yellow-50/30">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center">★</span>
                <h3 className="font-semibold text-gray-900">{bonus.bonus_name}</h3>
              </div>
              <p className="text-gray-600 text-sm mb-2 ml-11">{bonus.description}</p>
              <div className="flex gap-3 ml-11 text-xs">
                <span className="px-2 py-1 bg-white rounded border"><strong>Requires:</strong> Rules {(bonus.required_rule_ids || []).join(", ")}</span>
                <span className="px-2 py-1 bg-white rounded border"><strong>Bonus:</strong> {bonus.bonus_calc_type === "percentage" ? `${bonus.bonus_value}%` : `₹${bonus.bonus_value}`}</span>
                <span className="px-2 py-1 bg-white rounded border"><strong>Applied On:</strong> {bonus.apply_on.replace("_", " ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Prompt */}
      {scheme.ai_prompt && (
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">AI</span>
            Original AI Prompt
          </h2>
          <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700 italic">&ldquo;{scheme.ai_prompt}&rdquo;</div>
          {scheme.calculation_logic && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
              <strong>Calculation Logic:</strong> {scheme.calculation_logic}
            </div>
          )}
        </div>
      )}

      {/* Calculate Button */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Live Calculation Results</h2>
          <div className="flex gap-3">
            <a href={`/admin/what-if`} className="px-4 py-2 bg-orange-50 text-orange-700 rounded-xl text-sm font-semibold border border-orange-200 hover:bg-orange-100 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              What-If Simulation
            </a>
            <button onClick={handleCalculate} disabled={calculating}
              className="px-6 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {calculating ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Calculating...</> : "Run Calculation for All Dealers"}
            </button>
          </div>
        </div>

        {calcResults.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b">
                  <th className="pb-3 pl-3">Dealer</th>
                  {scheme.rules.map(r => <th key={r.id} className="pb-3 text-center">{r.rule_name}</th>)}
                  <th className="pb-3 text-right pr-3">Total Incentive</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calcResults.filter(c => !c.error).map(calc => (
                  <tr key={calc.dealer_id} className="hover:bg-gray-50">
                    <td className="py-3 pl-3 font-medium">{calc.dealer_name}</td>
                    {(calc.rules || []).map(r => (
                      <td key={r.rule_name} className="py-3 text-center">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${r.target_met ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {r.target_met ? "✓" : `${r.progress_percentage.toFixed(0)}%`}
                          {r.incentive_earned > 0 && <span className="ml-1">₹{r.incentive_earned.toLocaleString("en-IN")}</span>}
                        </div>
                      </td>
                    ))}
                    <td className="py-3 text-right pr-3 font-bold text-green-700">₹{calc.total_incentive.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

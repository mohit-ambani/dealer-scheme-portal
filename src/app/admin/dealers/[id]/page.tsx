"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

interface Dealer { id: number; name: string; firm_name: string; code: string; type: string; region: string; state: string; city: string; phone: string; email: string }
interface Trend { month: string; revenue: number; invoice_count: number; total_units: number }
interface Category { category_id: number; category: string; total_value: number; total_qty: number }
interface Slab { id: number; slab_from: number; slab_to: number | null; incentive_calc_type: string; incentive_value: number }
interface Rule {
  rule_id: number;
  rule_name: string;
  condition_type: string;
  min_threshold: number;
  max_threshold: number | null;
  incentive_calc_type: string;
  incentive_value: number;
  is_additional: boolean;
  apply_on: string;
  description: string | null;
  progress: number;
  achieved: boolean;
  earned: number;
  current_value: number;
  current_quantity: number;
  slabs: Slab[];
}
interface SchemeProg { scheme_id: number; scheme_name: string; incentive_type: string; total_earned: number; rules: Rule[] }
interface Invoice { id: number; invoice_number: string; invoice_date: string; total_amount: number; item_count: number }
interface Note { id: number; content: string; note_type: string; author_name: string; created_at: string }
interface Intelligence {
  purchase_trends: { growth_rate_pct: number; trend_direction: string; seasonal_patterns: string[]; avg_monthly_revenue: number };
  scheme_predictions: { scheme_name: string; likelihood_pct: number; reasoning: string; key_gap: string }[];
  churn_risk: { score: number; level: string; signals: string[]; recommendation: string };
  dealer_dna: { top_categories: string[]; weak_categories: string[]; purchasing_pattern: string; behavioral_tags: string[]; personality_type: string };
  ai_summary: string;
  recommended_actions: string[];
  cached?: boolean; model?: string;
}

export default function DealerIntelligencePage() {
  const { id } = useParams();
  const [data, setData] = useState<{ dealer: Dealer; trends: Trend[]; categories: Category[]; schemes: SchemeProg[]; invoices: Invoice[]; notes: Note[] } | null>(null);
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/dealers/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const generateIntelligence = async () => {
    setLoadingAI(true);
    const res = await fetch("/api/ai/dealer-intelligence", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealer_id: Number(id) }),
    });
    if (res.ok) setIntel(await res.json());
    else alert("AI generation failed");
    setLoadingAI(false);
  };

  const saveNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/dealers/${id}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newNote, note_type: noteType, author_role: "admin", author_name: "Admin" }),
    });
    if (res.ok) { setNewNote(""); loadData(); }
    setSaving(false);
  };

  if (loading || !data) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const totalPurchase = data.trends.reduce((s, t) => s + Number(t.revenue), 0);
  const totalIncentive = data.schemes.reduce((s, x) => s + Number(x.total_earned), 0);
  const activeSchemeCount = data.schemes.length;
  const chartData = data.trends.map(t => ({ month: new Date(t.month).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), revenue: Number(t.revenue) }));
  const radarData = data.categories.filter(c => Number(c.total_value) > 0).map(c => ({ category: c.category.replace(" & ", "/"), value: Number(c.total_value) }));
  const maxRadar = Math.max(...radarData.map(r => r.value), 1);

  const churnColor = intel?.churn_risk?.level === "critical" ? "bg-red-500" : intel?.churn_risk?.level === "high" ? "bg-orange-500" : intel?.churn_risk?.level === "medium" ? "bg-yellow-500" : "bg-green-500";
  const trendColor = intel?.purchase_trends?.trend_direction === "growing" ? "text-green-600" : intel?.purchase_trends?.trend_direction === "declining" ? "text-red-600" : "text-gray-600";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/dealers" className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900">{data.dealer.name}</h1>
            <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{data.dealer.code}</span>
          </div>
          <p className="text-gray-500">{data.dealer.firm_name} • {data.dealer.city}, {data.dealer.state}</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold capitalize">{data.dealer.type.replace("_", " ")}</span>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold capitalize">{data.dealer.region}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider opacity-75 mb-1">Total Purchase (12mo)</div>
          <div className="text-2xl font-bold">₹{totalPurchase.toLocaleString("en-IN")}</div>
          <div className="text-xs opacity-75 mt-2">{data.invoices.length} invoices</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-2xl p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider opacity-75 mb-1">Incentives Earned</div>
          <div className="text-2xl font-bold">₹{totalIncentive.toLocaleString("en-IN")}</div>
          <div className="text-xs opacity-75 mt-2">{totalPurchase > 0 ? ((totalIncentive / totalPurchase) * 100).toFixed(2) : 0}% of purchase</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider opacity-75 mb-1">Active Schemes</div>
          <div className="text-2xl font-bold">{activeSchemeCount}</div>
          <div className="text-xs opacity-75 mt-2">{data.schemes.filter(s => Number(s.total_earned) > 0).length} earning</div>
        </div>
        <div className={`text-white rounded-2xl p-5 shadow-lg ${intel ? churnColor : "bg-gradient-to-br from-gray-400 to-gray-600"}`}>
          <div className="text-xs uppercase tracking-wider opacity-75 mb-1">Churn Risk Score</div>
          <div className="text-2xl font-bold">{intel?.churn_risk?.score ?? "—"}{intel?.churn_risk?.score !== undefined && "/100"}</div>
          <div className="text-xs opacity-75 mt-2 capitalize">{intel?.churn_risk?.level ?? "Generate AI profile"}</div>
        </div>
      </div>

      {/* AI Intelligence Panel */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 border-2 border-purple-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold">AI</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Dealer Intelligence Profile</h2>
              <p className="text-xs text-gray-500">AI-generated insights from purchase history, scheme progress, and notes {intel?.cached && <span className="text-blue-600 font-medium">(cached)</span>}</p>
            </div>
          </div>
          <button onClick={generateIntelligence} disabled={loadingAI}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-md">
            {loadingAI ? (
              <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Analyzing...</>
            ) : intel ? "Refresh Intelligence" : "Generate AI Profile"}
          </button>
        </div>

        {!intel && (
          <div className="p-8 bg-purple-50 rounded-xl text-center">
            <div className="text-4xl mb-3">🧠</div>
            <p className="text-gray-700 font-medium mb-1">AI profile not yet generated</p>
            <p className="text-sm text-gray-500">Click the button to analyze this dealer&apos;s purchase patterns, predict scheme outcomes, and reveal strategic insights.</p>
          </div>
        )}

        {intel && (
          <div className="space-y-5">
            {/* AI Summary */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
              <div className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">Executive Summary</div>
              <p className="text-gray-800 italic">&ldquo;{intel.ai_summary}&rdquo;</p>
            </div>

            {/* Trend + DNA row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Purchase Trend */}
              <div className="p-5 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">Purchase Trend</h3>
                  <span className={`text-sm font-bold ${trendColor}`}>
                    {intel.purchase_trends.growth_rate_pct > 0 && "+"}{intel.purchase_trends.growth_rate_pct}%
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
                    <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="text-xs text-gray-500 mt-2">Direction: <span className={`capitalize font-semibold ${trendColor}`}>{intel.purchase_trends.trend_direction}</span> • Avg ₹{Number(intel.purchase_trends.avg_monthly_revenue).toLocaleString("en-IN")}/mo</div>
                {intel.purchase_trends.seasonal_patterns?.length > 0 && (
                  <div className="mt-3 text-xs">
                    <div className="font-semibold text-gray-700 mb-1">Patterns:</div>
                    {intel.purchase_trends.seasonal_patterns.map((p, i) => <div key={i} className="text-gray-600">• {p}</div>)}
                  </div>
                )}
              </div>

              {/* Dealer DNA */}
              <div className="p-5 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">Dealer DNA</h3>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold capitalize">{intel.dealer_dna.purchasing_pattern.replace("_", " ")}</span>
                </div>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" tick={{ fontSize: 9 }} />
                      <PolarRadiusAxis domain={[0, maxRadar]} tick={false} />
                      <Radar dataKey="value" stroke="#ec4899" fill="#ec4899" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : <div className="h-40 flex items-center justify-center text-sm text-gray-400">No purchase data</div>}
                <div className="mt-2 text-xs">
                  <div className="italic text-gray-700 mb-2">&ldquo;{intel.dealer_dna.personality_type}&rdquo;</div>
                  <div className="flex flex-wrap gap-1">
                    {intel.dealer_dna.behavioral_tags.map((tag, i) => <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">{tag}</span>)}
                  </div>
                </div>
              </div>
            </div>

            {/* Scheme Predictions */}
            {intel.scheme_predictions?.length > 0 && (
              <div className="p-5 bg-gray-50 rounded-xl">
                <h3 className="font-bold text-gray-900 mb-3">Scheme Target Predictions</h3>
                <div className="grid grid-cols-2 gap-3">
                  {intel.scheme_predictions.map((p, i) => (
                    <div key={i} className="p-3 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-gray-900">{p.scheme_name}</span>
                        <span className={`text-lg font-bold ${p.likelihood_pct >= 70 ? "text-green-600" : p.likelihood_pct >= 40 ? "text-yellow-600" : "text-red-600"}`}>{p.likelihood_pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full mb-2">
                        <div className={`h-full rounded-full ${p.likelihood_pct >= 70 ? "bg-green-500" : p.likelihood_pct >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${p.likelihood_pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{p.reasoning}</p>
                      <p className="text-xs text-orange-700"><strong>Gap:</strong> {p.key_gap}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Churn Risk & Actions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-gray-50 rounded-xl">
                <h3 className="font-bold text-gray-900 mb-3">Churn Risk Analysis</h3>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-white mb-3 ${churnColor}`}>
                  {intel.churn_risk.level.toUpperCase()} • {intel.churn_risk.score}/100
                </div>
                {intel.churn_risk.signals?.length > 0 && (
                  <div className="text-xs mb-2">
                    <div className="font-semibold text-gray-700 mb-1">Warning Signals:</div>
                    {intel.churn_risk.signals.map((s, i) => <div key={i} className="text-gray-600">⚠ {s}</div>)}
                  </div>
                )}
                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-900 mt-2">
                  <strong>Recommended:</strong> {intel.churn_risk.recommendation}
                </div>
              </div>
              <div className="p-5 bg-gray-50 rounded-xl">
                <h3 className="font-bold text-gray-900 mb-3">Recommended Actions</h3>
                <ul className="space-y-2">
                  {intel.recommended_actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rewards Timeline */}
      <RewardsTimeline schemes={data.schemes} />

      {/* Scheme Progress */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Active Scheme Progress</h2>
        {data.schemes.length === 0 ? <p className="text-gray-500 text-sm">No active schemes applicable to this dealer.</p> : (
          <div className="space-y-3">
            {data.schemes.map(s => (
              <div key={s.scheme_id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/admin/schemes/${s.scheme_id}`} className="font-semibold text-gray-900 hover:text-blue-600">{s.scheme_name}</Link>
                  <span className="font-bold text-green-700">₹{Number(s.total_earned).toLocaleString("en-IN")}</span>
                </div>
                <div className="space-y-1.5">
                  {s.rules.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="w-32 truncate text-gray-600">{r.rule_name}</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${r.achieved ? "bg-green-500" : "bg-blue-400"}`} style={{ width: `${Math.min(r.progress, 100)}%` }} />
                      </div>
                      <span className={`font-semibold ${r.achieved ? "text-green-700" : "text-gray-600"}`}>{r.achieved ? "✓" : `${Math.round(r.progress)}%`}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes / CRM */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Salesperson Notes / CRM</h2>
        <div className="flex gap-2 mb-4">
          <select value={noteType} onChange={e => setNoteType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="general">General</option>
            <option value="visit">Visit Report</option>
            <option value="performance">Performance</option>
            <option value="opportunity">Opportunity</option>
            <option value="complaint">Complaint</option>
            <option value="territory">Territory</option>
          </select>
          <input value={newNote} onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveNote()}
            placeholder="Add a note... e.g., 'Rajesh is price-sensitive, prefers per-unit incentives'"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <button onClick={saveNote} disabled={saving || !newNote.trim()}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? "..." : "Save"}</button>
        </div>
        {data.notes.length === 0 ? <p className="text-sm text-gray-500">No notes yet. Add the first one above.</p> : (
          <div className="space-y-2">
            {data.notes.map(n => (
              <div key={n.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase">{n.note_type}</span>
                  <span className="text-xs text-gray-500">{n.author_name} • {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <p className="text-sm text-gray-800">{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Invoices</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 uppercase border-b">
            <th className="pb-2">Invoice #</th><th className="pb-2">Date</th><th className="pb-2 text-center">Items</th><th className="pb-2 text-right">Amount</th>
          </tr></thead>
          <tbody className="divide-y">
            {data.invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="py-2 font-mono text-xs">{inv.invoice_number}</td>
                <td className="py-2 text-gray-600">{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</td>
                <td className="py-2 text-center text-gray-600">{inv.item_count}</td>
                <td className="py-2 text-right font-semibold">₹{Number(inv.total_amount).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Rewards Timeline ----------

const INCENTIVE_META: Record<string, { icon: string; label: string; bg: string; text: string }> = {
  credit_note: { icon: "💳", label: "Credit Note", bg: "bg-blue-100", text: "text-blue-700" },
  cash: { icon: "💵", label: "Cash", bg: "bg-emerald-100", text: "text-emerald-700" },
  gift: { icon: "🎁", label: "Gift", bg: "bg-pink-100", text: "text-pink-700" },
  foreign_trip: { icon: "✈️", label: "Foreign Trip", bg: "bg-sky-100", text: "text-sky-700" },
  voucher: { icon: "🎟️", label: "Voucher", bg: "bg-amber-100", text: "text-amber-700" },
};

function formatValue(calcType: string, value: number): string {
  const n = Number(value);
  if (calcType === "percentage") return `${n}%`;
  if (calcType === "per_unit") return `₹${n}/unit`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatThreshold(n: number | null, condition: string): string {
  if (n === null || n === undefined) return "∞";
  const v = Number(n);
  if (condition === "value") return `₹${v.toLocaleString("en-IN")}`;
  return `${v.toLocaleString("en-IN")}`;
}

function getCurrentMetric(rule: Rule): number {
  return rule.condition_type === "quantity" ? Number(rule.current_quantity) : Number(rule.current_value);
}

interface EffectiveSlab {
  from: number;
  to: number | null;
  calc_type: string;
  value: number;
}

function getEffectiveSlabs(rule: Rule): EffectiveSlab[] {
  if (rule.slabs && rule.slabs.length > 0) {
    return rule.slabs.map(s => ({
      from: Number(s.slab_from),
      to: s.slab_to === null || s.slab_to === undefined ? null : Number(s.slab_to),
      calc_type: s.incentive_calc_type,
      value: Number(s.incentive_value),
    }));
  }
  // No slabs — synthesise a single slab from min_threshold to max_threshold (or ∞)
  return [{
    from: Number(rule.min_threshold),
    to: rule.max_threshold === null || rule.max_threshold === undefined ? null : Number(rule.max_threshold),
    calc_type: rule.incentive_calc_type,
    value: Number(rule.incentive_value),
  }];
}

function slabStatus(slab: EffectiveSlab, current: number): "achieved" | "in_progress" | "locked" {
  const reachedTop = slab.to === null ? false : current >= slab.to;
  if (reachedTop) return "achieved";
  if (current >= slab.from) return "in_progress";
  return "locked";
}

function slabProgressPct(slab: EffectiveSlab, current: number): number {
  if (current <= slab.from) return 0;
  if (slab.to === null) {
    // Open-ended slab — show visually filled proportionally but cap at 100 once entered
    return 100;
  }
  if (current >= slab.to) return 100;
  const span = slab.to - slab.from;
  if (span <= 0) return 100;
  return Math.round(((current - slab.from) / span) * 100);
}

function RewardsTimeline({ schemes }: { schemes: SchemeProg[] }) {
  const hasSchemes = schemes.length > 0;
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Rewards Timeline</h2>
          <p className="text-xs text-gray-500">Slab-based growth rewards unlocked by this dealer across active schemes.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block"></span>Achieved</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded-sm inline-block"></span>In progress</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-300 rounded-sm inline-block"></span>Locked</span>
        </div>
      </div>

      {!hasSchemes ? (
        <p className="text-gray-500 text-sm">No active schemes applicable to this dealer.</p>
      ) : (
        <div className="space-y-6">
          {schemes.map(scheme => {
            const meta = INCENTIVE_META[scheme.incentive_type] ?? { icon: "🎯", label: scheme.incentive_type, bg: "bg-gray-100", text: "text-gray-700" };
            return (
              <div key={scheme.scheme_id} className="border border-gray-100 rounded-xl p-4 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${meta.bg}`}>{meta.icon}</span>
                    <div>
                      <Link href={`/admin/schemes/${scheme.scheme_id}`} className="font-semibold text-gray-900 hover:text-blue-600">{scheme.scheme_name}</Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${meta.bg} ${meta.text}`}>{meta.label}</span>
                        <span className="text-[11px] text-gray-500">{scheme.rules.length} rule{scheme.rules.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Earned</div>
                    <div className="font-bold text-green-700">₹{Number(scheme.total_earned).toLocaleString("en-IN")}</div>
                  </div>
                </div>

                {scheme.rules.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No rules configured.</p>
                ) : (
                  <div className="space-y-4">
                    {scheme.rules.map(rule => {
                      const slabs = getEffectiveSlabs(rule);
                      const current = getCurrentMetric(rule);
                      const unit = rule.condition_type === "quantity" ? "units" : "₹";
                      const currentLabel = rule.condition_type === "quantity"
                        ? `${current.toLocaleString("en-IN")} units`
                        : `₹${current.toLocaleString("en-IN")}`;
                      return (
                        <div key={rule.rule_id} className="bg-white rounded-lg p-3 border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{rule.rule_name}</div>
                              <div className="text-[11px] text-gray-500 capitalize">
                                Measured by {rule.condition_type} • Current: <span className="font-semibold text-gray-700">{currentLabel}</span>
                              </div>
                            </div>
                            {rule.achieved && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">✓ Achieved</span>
                            )}
                          </div>

                          <div className="flex gap-1 items-stretch">
                            {slabs.map((slab, idx) => {
                              const status = slabStatus(slab, current);
                              const pct = slabProgressPct(slab, current);
                              const color = status === "achieved" ? "bg-green-500" : status === "in_progress" ? "bg-orange-400" : "bg-gray-200";
                              const border = status === "achieved" ? "border-green-600" : status === "in_progress" ? "border-orange-500" : "border-gray-300";
                              const textColor = status === "locked" ? "text-gray-500" : "text-white";
                              return (
                                <div key={idx} className="flex-1 min-w-0">
                                  <div className={`relative h-14 rounded-lg border ${border} overflow-hidden bg-gray-100`}>
                                    <div className={`absolute inset-y-0 left-0 ${color} transition-all`} style={{ width: `${pct}%` }} />
                                    <div className={`relative h-full flex flex-col justify-center px-2 ${textColor}`}>
                                      <div className={`text-[10px] font-medium leading-tight ${status === "locked" ? "text-gray-500" : "text-white drop-shadow"}`}>
                                        {formatThreshold(slab.from, rule.condition_type)} – {formatThreshold(slab.to, rule.condition_type)}
                                      </div>
                                      <div className={`text-xs font-bold leading-tight ${status === "locked" ? "text-gray-700" : "text-white drop-shadow"}`}>
                                        {formatValue(slab.calc_type, slab.value)}
                                      </div>
                                    </div>
                                    {status === "in_progress" && (
                                      <div className="absolute top-0 bottom-0 border-r-2 border-orange-700" style={{ left: `${pct}%` }} />
                                    )}
                                  </div>
                                  <div className="text-center mt-1">
                                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${status === "achieved" ? "text-green-700" : status === "in_progress" ? "text-orange-700" : "text-gray-400"}`}>
                                      {status === "achieved" ? "Unlocked" : status === "in_progress" ? `${pct}%` : "Locked"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {rule.description && (
                            <div className="text-[11px] text-gray-500 mt-2 italic">{rule.description}</div>
                          )}
                          <div className="text-[10px] text-gray-400 mt-1">
                            Unit: {unit} • Apply: {rule.apply_on.replace("_", " ")}
                            {rule.is_additional && <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">+ Additional</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

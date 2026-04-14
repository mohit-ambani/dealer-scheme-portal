"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

interface SlabInfo { from: number; to: number | null; rate: number; type: string; status: "achieved" | "current" | "locked" }

interface RuleCalc {
  rule_id: number; rule_name: string; condition_type: string; target: number;
  incentive_calc_type?: string;
  achieved_value: number; achieved_quantity: number; progress_percentage: number;
  target_met: boolean; incentive_earned: number; incentive_breakdown: string;
  active_slab?: { from: number; to: number | null; rate: number; type: string } | null;
  all_slabs?: SlabInfo[];
  matching_invoices: { invoice_number: string; invoice_date: string; sku_name: string; quantity: number; value: number }[];
}

interface BonusCalc {
  bonus_name: string; achieved: boolean; bonus_earned: number; breakdown: string;
  rules_required: number[]; rules_met: number[];
}

interface CalcResult {
  scheme_id: number; scheme_name: string; dealer_name: string;
  period: { start: string; end: string }; is_backdated: boolean;
  rules: RuleCalc[]; bonuses: BonusCalc[];
  total_incentive: number; incentive_type: string; calculated_at: string;
}

function SchemeDetailInner() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const dealerId = searchParams.get("id") || "1";
  const [data, setData] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/schemes/${id}/calculate?dealer_id=${dealerId}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => { setLoading(false); });
  }, [id, dealerId]);

  if (loading || !data) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Calculating scheme...</p>
      </div>
    </div>
  );

  const allMet = data.rules.every(r => r.target_met);

  return (
    <div>
      {/* Header */}
      <div className={`px-6 pt-8 pb-6 rounded-b-3xl ${allMet ? "bg-gw-green-gradient" : "bg-gw-gradient"}`}>
        <Link href={`/dealer/schemes?id=${dealerId}`} className="text-white/70 text-sm mb-3 inline-flex items-center gap-1 hover:text-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to Schemes
        </Link>
        <h1 className="text-xl font-bold text-white">{data.scheme_name}</h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-white/70">
          <span>{data.period.start} → {data.period.end}</span>
          {data.is_backdated && <span className="px-2 py-0.5 bg-yellow-500/30 rounded text-yellow-200 text-xs">Backdated</span>}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-white">₹{data.total_incentive.toLocaleString("en-IN")}</div>
            <div className="text-white/60 text-xs uppercase capitalize">{data.incentive_type.replaceAll("_", " ")} earned</div>
          </div>
          {allMet && (
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center badge-pop">
              <span className="text-3xl">🏆</span>
            </div>
          )}
        </div>
      </div>

      {/* Incentive Summary Card */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100">
          <div className="text-xs text-gray-400 uppercase font-semibold mb-3 tracking-wide">Incentive Summary</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
              <div className="text-xs text-green-600 mb-1">Earned</div>
              <div className="text-lg font-bold text-green-700">₹{data.total_incentive.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-200">
              <div className="text-xs text-orange-600 mb-1">Rules Met</div>
              <div className="text-lg font-bold text-orange-700">{data.rules.filter(r => r.target_met).length} / {data.rules.length}</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-200">
              <div className="text-xs text-purple-600 mb-1">Incentive Type</div>
              <div className="text-sm font-bold text-purple-700 capitalize">{data.incentive_type.replaceAll("_", " ")}</div>
            </div>
          </div>
          {data.bonuses.length > 0 && (
            <div className="mt-3 bg-yellow-50 rounded-xl p-2 flex items-center justify-between border border-yellow-200">
              <div className="flex items-center gap-2 text-xs text-yellow-700">
                <span>★</span>
                <span>Combo Bonus: {data.bonuses.filter(b => b.achieved).length > 0 ? `₹${data.bonuses.reduce((s, b) => s + b.bonus_earned, 0).toLocaleString("en-IN")} earned` : `${data.bonuses.length} bonus${data.bonuses.length > 1 ? "es" : ""} available`}</span>
              </div>
              {data.bonuses.some(b => b.achieved) && <span className="text-yellow-600 text-xs font-bold">UNLOCKED</span>}
            </div>
          )}
          <div className="mt-3 text-[10px] text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Last calculated: {new Date(data.calculated_at).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Rules Detail */}
      <div className="px-4 mt-4 space-y-4">
        <h2 className="font-bold text-gray-900">Scheme Rules & Calculation</h2>

        {data.rules.map((rule, i) => (
          <div key={rule.rule_id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-2 ${rule.target_met ? "border-green-300" : "border-gray-100"}`}>
            {/* Rule Header */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${rule.target_met ? "bg-green-500" : "bg-gray-400"}`}>
                  {rule.target_met ? "✓" : i + 1}
                </span>
                <h3 className="font-semibold text-gray-900 text-sm flex-1">{rule.rule_name}</h3>
                <span className={`text-sm font-bold ${rule.target_met ? "text-green-600" : "text-gray-400"}`}>
                  {rule.progress_percentage.toFixed(0)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all duration-1000 ${rule.target_met ? "bg-green-500" : rule.progress_percentage > 70 ? "bg-gradient-to-r from-orange-400 to-orange-500" : "bg-gradient-to-r from-blue-400 to-blue-500"}`}
                  style={{ width: `${Math.min(rule.progress_percentage, 100)}%` }} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] text-gray-400 uppercase">
                    {rule.condition_type === "value" ? "Purchase Value" : "Quantity Bought"}
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {rule.condition_type === "value"
                      ? `₹${Number(rule.achieved_value).toLocaleString("en-IN")}`
                      : rule.achieved_quantity
                    }
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] text-gray-400 uppercase">Target</div>
                  <div className="text-lg font-bold text-gray-900">
                    {rule.condition_type === "value"
                      ? `₹${Number(rule.target).toLocaleString("en-IN")}`
                      : `${rule.target} units`
                    }
                  </div>
                </div>
              </div>

              {/* === JOURNEY (slab rules) or GOAL (non-slab) === */}
              {rule.incentive_calc_type === "slab" && rule.all_slabs && rule.all_slabs.length > 0 ? (
                <div className="relative rounded-2xl p-4 mb-3 overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-50">
                  {/* Decorative scenery */}
                  <div className="absolute inset-0 pointer-events-none select-none opacity-70">
                    <span className="absolute top-2 left-4 text-2xl">☁️</span>
                    <span className="absolute top-3 right-8 text-xl">☀️</span>
                    <span className="absolute top-6 left-1/3 text-lg">☁️</span>
                    <span className="absolute bottom-2 left-6 text-xl">🌳</span>
                    <span className="absolute bottom-2 right-10 text-xl">🌳</span>
                    <span className="absolute bottom-3 left-1/2 text-lg">⚡</span>
                  </div>

                  <div className="relative flex items-center justify-between mb-3">
                    <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">🗺️ Your Growth Journey</div>
                    <div className="text-[10px] text-amber-700 bg-white/70 rounded-full px-2 py-0.5 font-semibold">
                      {rule.condition_type === "value" ? `₹${Number(rule.achieved_value).toLocaleString("en-IN")}` : `${rule.achieved_quantity} units`}
                    </div>
                  </div>

                  {/* Journey track - horizontal scrollable */}
                  <div className="relative overflow-x-auto pb-2">
                    <div className="flex items-end gap-0 min-w-max px-2 pt-8">
                      {rule.all_slabs.map((slab, si) => {
                        const isAchieved = slab.status === "achieved";
                        const isCurrent = slab.status === "current";
                        const rangeLabel = rule.condition_type === "value"
                          ? `₹${(slab.from / 1000).toFixed(0)}k${slab.to ? `–${(slab.to / 1000).toFixed(0)}k` : "+"}`
                          : `${slab.from}${slab.to ? `–${slab.to}` : "+"}`;
                        const rateLabel = slab.type === "percentage" ? `${slab.rate}%` : slab.type === "per_unit" ? `₹${slab.rate}/u` : `₹${slab.rate}`;
                        const milestoneIcon = isAchieved ? "🏆" : isCurrent ? "🏪" : "🔒";
                        const isLast = si === rule.all_slabs!.length - 1;
                        return (
                          <div key={si} className="flex items-end flex-shrink-0">
                            {/* Milestone node */}
                            <div className="flex flex-col items-center relative w-24">
                              {/* Floating reward badge */}
                              <div className={`mb-1 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm ${
                                isAchieved ? "bg-green-500 text-white" : isCurrent ? "bg-orange-500 text-white animate-pulse" : "bg-white/80 text-gray-500 border border-gray-200"
                              }`}>
                                {rateLabel}
                              </div>
                              {/* Rope/arrow */}
                              <div className={`text-[8px] mb-0.5 ${isAchieved || isCurrent ? "text-amber-600" : "text-gray-300"}`}>▼</div>
                              {/* Milestone circle */}
                              <div className={`relative w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-md ${
                                isAchieved ? "bg-gradient-to-br from-green-400 to-green-600 ring-2 ring-green-300"
                                : isCurrent ? "bg-gradient-to-br from-orange-400 to-orange-600 ring-4 ring-orange-200 animate-bounce"
                                : "bg-gradient-to-br from-gray-200 to-gray-300 grayscale"
                              }`}>
                                <span>{milestoneIcon}</span>
                                {isCurrent && (
                                  <span className="absolute -top-1 -right-1 text-xs bg-white rounded-full px-1 shadow-sm border border-orange-300">📍</span>
                                )}
                              </div>
                              {/* Range label */}
                              <div className={`mt-1.5 text-[10px] font-bold ${isAchieved ? "text-green-700" : isCurrent ? "text-orange-700" : "text-gray-400"}`}>
                                {rangeLabel}
                              </div>
                              <div className={`text-[9px] ${isAchieved ? "text-green-600" : isCurrent ? "text-orange-600 font-semibold" : "text-gray-400"}`}>
                                Level {si + 1}
                              </div>
                            </div>
                            {/* Path connector */}
                            {!isLast && (
                              <div className="flex items-center h-14 mb-7 w-6">
                                <div className={`h-1 w-full rounded-full ${
                                  isAchieved && rule.all_slabs![si + 1].status !== "locked" ? "bg-green-400"
                                  : isAchieved ? "bg-gradient-to-r from-green-400 to-gray-300"
                                  : "bg-gray-300 border-t-2 border-dashed border-gray-400"
                                }`}></div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status message */}
                  <div className="relative mt-2 bg-white/80 backdrop-blur rounded-xl p-3 border border-amber-200">
                    {rule.target_met ? (
                      <div>
                        <div className="text-[10px] text-green-600 uppercase font-bold mb-0.5">🎉 Journey Reward Earned</div>
                        <div className="text-xl font-bold text-green-700">₹{rule.incentive_earned.toLocaleString("en-IN")}</div>
                        <div className="text-[10px] text-green-600 mt-0.5">{rule.incentive_breakdown}</div>
                      </div>
                    ) : rule.incentive_earned > 0 ? (
                      <div>
                        <div className="text-[10px] text-orange-600 uppercase font-bold mb-0.5">Earned so far on this journey</div>
                        <div className="text-xl font-bold text-orange-700">₹{rule.incentive_earned.toLocaleString("en-IN")}</div>
                        {rule.active_slab?.to && (
                          <div className="text-[10px] text-orange-600 mt-0.5">
                            🎯 Reach {rule.condition_type === "value" ? `₹${rule.active_slab.to.toLocaleString("en-IN")}` : `${rule.active_slab.to} units`} to unlock the next milestone
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="text-[10px] text-gray-600 uppercase font-bold mb-0.5">🚀 Your journey awaits</div>
                        <div className="text-sm font-semibold text-gray-700">
                          {rule.condition_type === "value"
                            ? `Purchase ₹${(rule.all_slabs[0].from - rule.achieved_value).toLocaleString("en-IN")} more to reach Level 1`
                            : `Buy ${rule.all_slabs[0].from - rule.achieved_quantity} more units to reach Level 1`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* === GOAL / TARGET UI for non-slab rules === */
                <div className={`relative rounded-2xl p-4 mb-3 overflow-hidden border ${
                  rule.target_met ? "border-green-300 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50"
                  : "border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50"
                }`}>
                  {/* Decorative */}
                  <div className="absolute inset-0 pointer-events-none select-none opacity-60">
                    <span className="absolute top-2 right-4 text-xl">{rule.target_met ? "🎉" : "✨"}</span>
                    <span className="absolute bottom-2 left-4 text-lg">{rule.target_met ? "🌟" : "⭐"}</span>
                  </div>

                  <div className="relative flex items-center justify-between mb-3">
                    <div className={`text-xs font-bold uppercase tracking-wider ${rule.target_met ? "text-green-800" : "text-orange-800"}`}>
                      {rule.target_met ? "🏆 Goal Achieved" : "🎯 Your Target"}
                    </div>
                  </div>

                  {/* Bullseye progress ring */}
                  <div className="relative flex items-center justify-center my-3">
                    <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                      {/* Outer ring */}
                      <circle cx="80" cy="80" r="70" fill="none" stroke="#fed7aa" strokeWidth="2" />
                      {/* Middle ring */}
                      <circle cx="80" cy="80" r="56" fill="none" stroke="#fdba74" strokeWidth="2" />
                      {/* Inner ring bg */}
                      <circle cx="80" cy="80" r="42" fill="none" stroke={rule.target_met ? "#86efac" : "#fed7aa"} strokeWidth="10" />
                      {/* Progress arc */}
                      <circle
                        cx="80" cy="80" r="42"
                        fill="none"
                        stroke={rule.target_met ? "#16a34a" : "#f97316"}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(rule.progress_percentage, 100) / 100)}`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    {/* Center content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-3xl">{rule.target_met ? "🏆" : "🎯"}</div>
                      <div className={`text-xl font-bold ${rule.target_met ? "text-green-700" : "text-orange-700"}`}>
                        {rule.progress_percentage.toFixed(0)}%
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase font-semibold">Progress</div>
                    </div>
                  </div>

                  {/* Start → You → Goal bar */}
                  <div className="relative flex items-center justify-between mt-2 px-1">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl">🏁</span>
                      <span className="text-[9px] text-gray-500 mt-0.5 uppercase font-semibold">Start</span>
                    </div>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full mx-2 relative overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${
                        rule.target_met ? "bg-gradient-to-r from-green-400 to-green-600"
                        : "bg-gradient-to-r from-orange-400 to-orange-500"
                      }`} style={{ width: `${Math.min(rule.progress_percentage, 100)}%` }} />
                      {/* Floating shop marker */}
                      {!rule.target_met && rule.progress_percentage > 0 && rule.progress_percentage < 100 && (
                        <span
                          className="absolute -top-5 text-xl transform -translate-x-1/2 animate-bounce"
                          style={{ left: `${Math.min(rule.progress_percentage, 100)}%` }}
                        >🏪</span>
                      )}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl">{rule.target_met ? "🏆" : "🎯"}</span>
                      <span className="text-[9px] text-gray-500 mt-0.5 uppercase font-semibold">Goal</span>
                    </div>
                  </div>

                  {/* Status card */}
                  <div className="relative mt-3 bg-white/80 backdrop-blur rounded-xl p-3 border border-gray-200">
                    {rule.target_met ? (
                      <div>
                        <div className="text-[10px] text-green-600 uppercase font-bold mb-0.5">🎊 Reward Earned</div>
                        <div className="text-xl font-bold text-green-700">₹{rule.incentive_earned.toLocaleString("en-IN")}</div>
                        <div className="text-[10px] text-green-600 mt-0.5">{rule.incentive_breakdown}</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[10px] text-orange-600 uppercase font-bold mb-0.5">Reward on hitting goal</div>
                        <div className="text-sm font-semibold text-orange-700">
                          {rule.incentive_breakdown || "Complete the target to unlock your reward"}
                        </div>
                        <div className="text-[10px] text-orange-600 mt-1">
                          {rule.condition_type === "value"
                            ? `Purchase ₹${(rule.target - rule.achieved_value).toLocaleString("en-IN")} more to hit the goal`
                            : `Buy ${rule.target - rule.achieved_quantity} more units to hit the goal`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Toggle Invoice Details */}
              <button onClick={() => setExpandedRule(expandedRule === rule.rule_id ? null : rule.rule_id)}
                className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800">
                <svg className={`w-4 h-4 transition-transform ${expandedRule === rule.rule_id ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                {expandedRule === rule.rule_id ? "Hide" : "Show"} contributing invoices ({rule.matching_invoices.length})
              </button>
            </div>

            {/* Invoice Details */}
            {expandedRule === rule.rule_id && (
              <div className="border-t border-gray-100 bg-gray-50 p-4">
                <div className="text-[10px] text-gray-400 uppercase font-semibold mb-3">Contributing Invoices</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rule.matching_invoices.map((inv, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-gray-900">{inv.invoice_number}</div>
                        <div className="text-gray-400">{inv.invoice_date}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-700">{inv.sku_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{inv.quantity} pcs</div>
                        <div className="text-gray-500">₹{inv.value.toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Bonuses */}
        {data.bonuses.length > 0 && (
          <>
            <h2 className="font-bold text-gray-900 mt-6">Combo Bonuses</h2>
            {data.bonuses.map((bonus, i) => (
              <div key={i} className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${bonus.achieved ? "border-yellow-300 bg-yellow-50/30" : "border-gray-100"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{bonus.achieved ? "★" : "☆"}</span>
                  <h3 className="font-semibold text-gray-900 text-sm">{bonus.bonus_name}</h3>
                </div>
                <div className="text-xs text-gray-500 mb-2">{bonus.breakdown}</div>
                {bonus.achieved && (
                  <div className="bg-yellow-100 rounded-xl p-3">
                    <div className="text-xl font-bold text-yellow-700">+₹{bonus.bonus_earned.toLocaleString("en-IN")}</div>
                    <div className="text-xs text-yellow-600">Combo bonus achieved!</div>
                  </div>
                )}
                {!bonus.achieved && (
                  <div className="text-xs text-gray-400">
                    Required rules: {bonus.rules_required.length} &bull; Met: {bonus.rules_met.length}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Total Summary */}
        <div className={`rounded-2xl p-5 ${allMet ? "bg-green-600" : "bg-gw-gradient"} text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/70 uppercase">Total Scheme Incentive</div>
              <div className="text-3xl font-bold mt-1">₹{data.total_incentive.toLocaleString("en-IN")}</div>
              <div className="text-sm text-white/70 capitalize mt-1">{data.incentive_type.replaceAll("_", " ")}</div>
            </div>
            {allMet && <span className="text-5xl">🎉</span>}
          </div>
        </div>
      </div>

      <div className="h-8"></div>
    </div>
  );
}

export default function SchemeDetailPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
    <SchemeDetailInner />
  </Suspense>;
}

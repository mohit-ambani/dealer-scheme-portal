"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface SchemeResult {
  scheme_id: number; scheme_name: string; total_incentive: number; incentive_type: string;
  rules: { rule_name: string; target_met: boolean; incentive_earned: number }[];
  bonuses: { bonus_name: string; achieved: boolean; bonus_earned: number }[];
}

function IncentivesInner() {
  const searchParams = useSearchParams();
  const dealerId = searchParams.get("id") || "1";
  const [schemes, setSchemes] = useState<SchemeResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dealers/${dealerId}/schemes`).then(r => r.json()).then(d => { setSchemes(d.schemes || []); setLoading(false); }).catch(() => { setLoading(false); });
  }, [dealerId]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const earned = schemes.filter(s => s.total_incentive > 0);
  const totalEarned = earned.reduce((s, e) => s + e.total_incentive, 0);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "gift": return "🎁";
      case "voucher": return "🎫";
      case "credit_note": return "📄";
      default: return "💰";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "gift": return "from-pink-500 to-rose-500";
      case "voucher": return "from-purple-500 to-indigo-500";
      case "credit_note": return "from-emerald-500 to-teal-500";
      default: return "from-blue-500 to-cyan-500";
    }
  };

  // Compute breakdown by incentive type
  const typeBreakdown = schemes.reduce<Record<string, { total: number; count: number }>>((acc, s) => {
    if (s.total_incentive <= 0) return acc;
    const t = s.incentive_type || "other";
    if (!acc[t]) acc[t] = { total: 0, count: 0 };
    acc[t].total += s.total_incentive;
    acc[t].count += 1;
    return acc;
  }, {});

  const typeLabels: Record<string, string> = {
    gift: "Gifts",
    voucher: "Vouchers",
    credit_note: "Credit Notes",
    other: "Other",
  };

  const typeBgColors: Record<string, string> = {
    gift: "bg-pink-50 border-pink-200",
    voucher: "bg-purple-50 border-purple-200",
    credit_note: "bg-emerald-50 border-emerald-200",
    other: "bg-blue-50 border-blue-200",
  };

  const typeTextColors: Record<string, string> = {
    gift: "text-pink-700",
    voucher: "text-purple-700",
    credit_note: "text-emerald-700",
    other: "text-blue-700",
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-gw-orange-gradient px-6 pt-8 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold text-white">My Rewards</h1>
        <p className="text-orange-100 text-sm mt-1">Incentives earned from active schemes</p>
        <div className="mt-4 bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="text-orange-100 text-xs uppercase">Total Incentives Earned</div>
          <div className="text-4xl font-bold text-white mt-1">₹{totalEarned.toLocaleString("en-IN")}</div>
          <div className="text-orange-200 text-sm mt-1">{earned.length} of {schemes.length} schemes earning</div>
        </div>
      </div>

      {/* Total Rewards Summary — Breakdown by Type */}
      {Object.keys(typeBreakdown).length > 0 && (
        <div className="px-4 -mt-4">
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="text-xs text-gray-400 uppercase font-semibold mb-3 tracking-wide">Rewards Breakdown</div>
            <div className={`grid gap-3 ${Object.keys(typeBreakdown).length === 1 ? "grid-cols-1" : Object.keys(typeBreakdown).length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {Object.entries(typeBreakdown).map(([type, info]) => (
                <div key={type} className={`rounded-xl p-3 border ${typeBgColors[type] || typeBgColors.other}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">{getTypeIcon(type)}</span>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">{typeLabels[type] || type}</span>
                  </div>
                  <div className={`text-lg font-bold ${typeTextColors[type] || typeTextColors.other}`}>
                    ₹{info.total.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-gray-400">{info.count} scheme{info.count !== 1 ? "s" : ""}</div>
                </div>
              ))}
            </div>
            {/* Visual proportion bar */}
            {totalEarned > 0 && (
              <div className="mt-3 h-2 rounded-full overflow-hidden flex">
                {Object.entries(typeBreakdown).map(([type, info]) => {
                  const pct = (info.total / totalEarned) * 100;
                  const barColors: Record<string, string> = {
                    gift: "bg-pink-400",
                    voucher: "bg-purple-400",
                    credit_note: "bg-emerald-400",
                    other: "bg-blue-400",
                  };
                  return (
                    <div key={type} className={`h-full ${barColors[type] || barColors.other} first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${pct}%` }}
                      title={`${typeLabels[type] || type}: ${pct.toFixed(0)}%`} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incentive Cards */}
      <div className="px-4 mt-4 space-y-4 mb-6">
        {earned.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-bold text-gray-700">No incentives yet</h3>
            <p className="text-sm text-gray-500 mt-1">Keep purchasing to achieve your scheme targets!</p>
          </div>
        )}

        {earned.map(scheme => (
          <div key={scheme.scheme_id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Gradient header */}
            <div className={`bg-gradient-to-r ${getTypeColor(scheme.incentive_type)} p-4 text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/70 uppercase mb-1 capitalize">{scheme.incentive_type.replaceAll("_", " ")}</div>
                  <div className="text-2xl font-bold">₹{scheme.total_incentive.toLocaleString("en-IN")}</div>
                </div>
                <div className="text-4xl">{getTypeIcon(scheme.incentive_type)}</div>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-900 text-sm mb-3">{scheme.scheme_name}</h3>

              {/* Breakdown */}
              <div className="space-y-2">
                {scheme.rules.filter(r => r.incentive_earned > 0).map((rule, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 flex items-center gap-1">
                      <span className="w-4 h-4 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[9px]">✓</span>
                      {rule.rule_name}
                    </span>
                    <span className="font-semibold text-green-600">₹{rule.incentive_earned.toLocaleString("en-IN")}</span>
                  </div>
                ))}
                {scheme.bonuses.filter(b => b.bonus_earned > 0).map((bonus, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-yellow-600 flex items-center gap-1">
                      <span>★</span> {bonus.bonus_name}
                    </span>
                    <span className="font-semibold text-yellow-600">+₹{bonus.bonus_earned.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>

              {/* Download button */}
              <button className="w-full mt-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 flex items-center justify-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download {scheme.incentive_type === "credit_note" ? "Credit Note" : scheme.incentive_type === "voucher" ? "Voucher" : "Gift Certificate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IncentivesPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
    <IncentivesInner />
  </Suspense>;
}

"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SchemeResult {
  scheme_id: number; scheme_name: string; total_incentive: number; incentive_type: string;
  period: { start: string; end: string }; is_backdated: boolean;
  rules: { rule_name: string; target_met: boolean; progress_percentage: number; incentive_earned: number; condition_type: string; target: number; achieved_value: number; achieved_quantity: number; incentive_breakdown: string }[];
  bonuses: { bonus_name: string; achieved: boolean; bonus_earned: number; breakdown: string }[];
}

function SchemesInner() {
  const searchParams = useSearchParams();
  const dealerId = searchParams.get("id") || "1";
  const [schemes, setSchemes] = useState<SchemeResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dealers/${dealerId}/schemes`).then(r => r.json()).then(d => { setSchemes(d.schemes || []); setLoading(false); }).catch(() => { setLoading(false); });
  }, [dealerId]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <div className="bg-gw-gradient px-6 pt-8 pb-6 rounded-b-3xl">
        <h1 className="text-2xl font-bold text-white">My Schemes</h1>
        <p className="text-blue-200 text-sm mt-1">{schemes.length} schemes applicable to you</p>
      </div>

      <div className="px-4 mt-4 space-y-4 mb-6">
        {schemes.map(scheme => {
          const allMet = scheme.rules.every(r => r.target_met);
          return (
            <Link key={scheme.scheme_id} href={`/dealer/schemes/${scheme.scheme_id}?id=${dealerId}`}
              className={`block bg-white rounded-2xl p-5 shadow-sm border-2 ${allMet ? "border-green-300" : "border-transparent"}`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900">{scheme.scheme_name}</h3>
                {allMet && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">COMPLETED</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <span>{scheme.period.start} → {scheme.period.end}</span>
                <span className="capitalize">{scheme.incentive_type.replaceAll("_", " ")}</span>
                {scheme.is_backdated && <span className="text-yellow-600 font-medium">Backdated</span>}
              </div>

              {/* Rules summary */}
              {scheme.rules.map((rule, i) => (
                <div key={i} className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium">{rule.rule_name}</span>
                    <span className="text-gray-500">
                      {rule.condition_type === "value"
                        ? `₹${Number(rule.achieved_value).toLocaleString("en-IN")} / ₹${Number(rule.target).toLocaleString("en-IN")}`
                        : `${rule.achieved_quantity} / ${rule.target} units`
                      }
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${rule.target_met ? "bg-green-500" : rule.progress_percentage > 70 ? "bg-orange-400" : "bg-blue-400"}`}
                      style={{ width: `${Math.min(rule.progress_percentage, 100)}%` }} />
                  </div>
                  {rule.target_met && rule.incentive_earned > 0 && (
                    <div className="text-[11px] text-green-600 mt-1 font-medium">
                      Earned: ₹{rule.incentive_earned.toLocaleString("en-IN")} — {rule.incentive_breakdown}
                    </div>
                  )}
                </div>
              ))}

              {/* Bonuses */}
              {scheme.bonuses.map((bonus, i) => (
                <div key={i} className={`mt-2 p-2 rounded-lg text-xs ${bonus.achieved ? "bg-yellow-50 text-yellow-700" : "bg-gray-50 text-gray-400"}`}>
                  {bonus.achieved ? "★" : "☆"} {bonus.bonus_name}
                  {bonus.bonus_earned > 0 && <span className="float-right font-bold">+₹{bonus.bonus_earned.toLocaleString("en-IN")}</span>}
                </div>
              ))}

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Total Incentive</span>
                <span className={`text-lg font-bold ${scheme.total_incentive > 0 ? "text-green-600" : "text-gray-400"}`}>
                  ₹{scheme.total_incentive.toLocaleString("en-IN")}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function DealerSchemesPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
    <SchemesInner />
  </Suspense>;
}

"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface DealerData {
  dealer: { id: number; name: string; firm_name: string; type: string; region: string; city: string };
  schemes: {
    scheme_id: number; scheme_name: string; total_incentive: number; incentive_type: string;
    period: { start: string; end: string };
    rules: { rule_name: string; target_met: boolean; progress_percentage: number; incentive_earned: number; condition_type: string; target: number; achieved_value: number; achieved_quantity: number }[];
    bonuses: { bonus_name: string; achieved: boolean; bonus_earned: number }[];
  }[];
  summary: { total_schemes: number; schemes_fully_achieved: number; total_incentive_earned: number; total_invoices: number; total_purchase_value: number };
}

interface LeaderboardEntry {
  dealer_id: number; dealer_name: string; firm_name: string; region: string;
  total_incentive: number; schemes_achieved: number; total_schemes: number;
}

interface NextTargetInfo {
  scheme_name: string;
  rule_name: string;
  progress_percentage: number;
  remaining_value: number;
  remaining_label: string;
  condition_type: string;
  scheme_id: number;
}

// Animated counter hook
function useAnimatedCounter(end: number, duration = 1200, startOnMount = true) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(undefined);

  const animate = useCallback(() => {
    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * end));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };
    frameRef.current = requestAnimationFrame(step);
  }, [end, duration]);

  useEffect(() => {
    if (startOnMount && end > 0) animate();
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [animate, end, startOnMount]);

  return value;
}

// Animated stat display component
function AnimatedStat({ value, prefix = "", suffix = "", className = "" }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const animatedVal = useAnimatedCounter(value);
  return <span className={className}>{prefix}{animatedVal.toLocaleString("en-IN")}{suffix}</span>;
}

// Compute the closest unachieved rule across all schemes
function computeNextTarget(schemes: DealerData["schemes"]): NextTargetInfo | null {
  let best: NextTargetInfo | null = null;
  for (const scheme of schemes) {
    for (const rule of scheme.rules) {
      if (rule.target_met) continue;
      if (!best || rule.progress_percentage > best.progress_percentage) {
        const remaining = rule.condition_type === "value"
          ? rule.target - rule.achieved_value
          : rule.target - rule.achieved_quantity;
        best = {
          scheme_name: scheme.scheme_name,
          rule_name: rule.rule_name,
          progress_percentage: rule.progress_percentage,
          remaining_value: Math.max(0, remaining),
          remaining_label: rule.condition_type === "value"
            ? `₹${Math.max(0, remaining).toLocaleString("en-IN")} more`
            : `${Math.max(0, remaining)} more units`,
          condition_type: rule.condition_type,
          scheme_id: scheme.scheme_id,
        };
      }
    }
  }
  return best;
}

function ProgressRing({ percentage, size = 80, strokeWidth = 6, color = "#f47920" }: { percentage: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="progress-ring transition-all duration-1000" />
    </svg>
  );
}

function DealerDashboardInner() {
  const searchParams = useSearchParams();
  const dealerId = searchParams.get("id") || "1";
  const [data, setData] = useState<DealerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetch(`/api/dealers/${dealerId}/schemes`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => { setLoading(false); });
    fetch(`/api/dealers/leaderboard`).then(r => r.json()).then(d => { if (Array.isArray(d)) setLeaderboard(d); }).catch(() => {});
  }, [dealerId]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Calculating your schemes...</p>
      </div>
    </div>
  );

  if (!data) return <div className="p-6 text-center text-red-500">Failed to load data</div>;

  const { dealer, schemes, summary } = data;
  const achievementPct = summary.total_schemes > 0 ? (summary.schemes_fully_achieved / summary.total_schemes) * 100 : 0;
  const level = summary.schemes_fully_achieved >= 4 ? "Platinum" : summary.schemes_fully_achieved >= 3 ? "Gold" : summary.schemes_fully_achieved >= 2 ? "Silver" : summary.schemes_fully_achieved >= 1 ? "Bronze" : "Starter";
  const levelColors: Record<string, string> = { Platinum: "#8b5cf6", Gold: "#f59e0b", Silver: "#6b7280", Bronze: "#d97706", Starter: "#94a3b8" };

  return (
    <div>
      {/* Header */}
      <div className="bg-gw-gradient px-6 pt-8 pb-12 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-sm font-black text-[#1e3a5f]">GW</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white font-bold text-sm">{dealer.name}</div>
              <div className="text-blue-300 text-xs">{dealer.firm_name}</div>
            </div>
            <Link href="/dealer/login" className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-white/20 transition-colors whitespace-nowrap">
              Switch
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <ProgressRing percentage={achievementPct} size={90} strokeWidth={5} color={levelColors[level]} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-lg font-bold">{Math.round(achievementPct)}%</div>
                <div className="text-blue-300 text-[8px] uppercase">achieved</div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white text-xl font-bold">{level}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white level-badge-animated" style={{ background: `linear-gradient(135deg, ${levelColors[level]}, ${levelColors[level]}dd, ${levelColors[level]})` }}>LEVEL</span>
            </div>
            <div className="text-blue-200 text-xs mb-2 capitalize">{dealer.type.replaceAll("_", " ")} &bull; {dealer.region} &bull; {dealer.city}</div>
            <div className="flex gap-4">
              <div>
                <div className="text-white text-lg font-bold">₹{(summary.total_incentive_earned / 1000).toFixed(1)}K</div>
                <div className="text-blue-300 text-[10px] uppercase">Incentive Earned</div>
              </div>
              <div>
                <div className="text-white text-lg font-bold">{summary.schemes_fully_achieved}/{summary.total_schemes}</div>
                <div className="text-blue-300 text-[10px] uppercase">Schemes Done</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats — Animated */}
      <div className="px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-4">
          <div className="text-center counter-animate counter-animate-delay-1">
            <div className="text-xl font-bold text-gray-900">
              <AnimatedStat value={Math.round(summary.total_purchase_value / 1000)} prefix="₹" suffix="K" className="text-xl font-bold text-gray-900" />
            </div>
            <div className="text-[10px] text-gray-500 uppercase">Total Purchase</div>
          </div>
          <div className="text-center border-x border-gray-100 counter-animate counter-animate-delay-2">
            <div className="text-xl font-bold text-gray-900">
              <AnimatedStat value={summary.total_invoices} className="text-xl font-bold text-gray-900" />
            </div>
            <div className="text-[10px] text-gray-500 uppercase">Invoices</div>
          </div>
          <div className="text-center counter-animate counter-animate-delay-3">
            <div className="text-xl font-bold text-green-600">
              <AnimatedStat value={summary.total_incentive_earned} prefix="₹" className="text-xl font-bold text-green-600" />
            </div>
            <div className="text-[10px] text-gray-500 uppercase">Earned</div>
          </div>
        </div>
      </div>

      {/* Active Schemes */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Your Active Schemes</h2>
          <Link href={`/dealer/schemes?id=${dealerId}`} className="text-xs text-orange-600 font-medium">View All →</Link>
        </div>

        <div className="space-y-4">
          {schemes.map(scheme => {
            const allRulesMet = scheme.rules.every(r => r.target_met);
            const overallProgress = scheme.rules.length > 0 ? scheme.rules.reduce((s, r) => s + r.progress_percentage, 0) / scheme.rules.length : 0;
            return (
              <Link key={scheme.scheme_id} href={`/dealer/schemes/${scheme.scheme_id}?id=${dealerId}`}
                className={`block bg-white rounded-2xl p-4 shadow-sm border-2 transition-all ${allRulesMet ? "border-green-300 bg-green-50/30 confetti-celebrate" : "border-transparent hover:border-orange-200"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-sm">{scheme.scheme_name}</h3>
                      {allRulesMet && <span className="text-green-600 badge-pop">✓</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{scheme.period.start} → {scheme.period.end}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${scheme.total_incentive > 0 ? "text-green-600" : "text-gray-400"}`}>
                      ₹{scheme.total_incentive.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[10px] text-gray-400 capitalize">{scheme.incentive_type.replaceAll("_", " ")}</div>
                  </div>
                </div>

                {/* Progress bars for each rule */}
                <div className="space-y-2">
                  {scheme.rules.map((rule, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-gray-600 truncate flex-1">{rule.rule_name}</span>
                        <span className={`ml-2 font-semibold ${rule.target_met ? "text-green-600" : "text-gray-500"}`}>
                          {rule.target_met ? "✓ Done" : `${rule.progress_percentage.toFixed(0)}%`}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${rule.target_met ? "bg-green-500" : rule.progress_percentage > 70 ? "bg-orange-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(rule.progress_percentage, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bonuses */}
                {scheme.bonuses.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {scheme.bonuses.map((bonus, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs ${bonus.achieved ? "text-yellow-600" : "text-gray-400"}`}>
                        <span>{bonus.achieved ? "★" : "☆"}</span>
                        <span>{bonus.bonus_name}</span>
                        {bonus.bonus_earned > 0 && <span className="ml-auto font-bold">+₹{bonus.bonus_earned.toLocaleString("en-IN")}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Overall progress bar */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${allRulesMet ? "bg-green-500" : "bg-orange-500"}`}
                      style={{ width: `${Math.min(overallProgress, 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">{Math.round(overallProgress)}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Next Target Callout */}
      {(() => {
        const nextTarget = computeNextTarget(schemes);
        if (!nextTarget) return null;
        return (
          <div className="px-4 mt-6">
            <Link href={`/dealer/schemes/${nextTarget.scheme_id}?id=${dealerId}`}
              className="block bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 border-2 border-orange-200 target-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-orange-600 uppercase font-bold tracking-wide">Closest Target</div>
                  <div className="text-sm font-bold text-gray-900 truncate">{nextTarget.rule_name}</div>
                  <div className="text-xs text-gray-500 truncate">{nextTarget.scheme_name}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-orange-600">{nextTarget.progress_percentage.toFixed(0)}%</div>
                  <div className="text-[10px] text-gray-500">{nextTarget.remaining_label}</div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-1000"
                  style={{ width: `${Math.min(nextTarget.progress_percentage, 100)}%` }} />
              </div>
            </Link>
          </div>
        );
      })()}

      {/* Scheme Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Scheme Leaderboard</h2>
            <span className="text-[10px] text-gray-400 uppercase">Top Dealers</span>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {leaderboard.slice(0, 5).map((entry, i) => {
              const isCurrentDealer = entry.dealer_id === Number(dealerId);
              const rankIcon = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              return (
                <div key={entry.dealer_id}
                  className={`flex items-center gap-3 px-4 py-3 leaderboard-entry ${i < 4 ? "border-b border-gray-50" : ""} ${isCurrentDealer ? "bg-orange-50/60" : ""}`}
                  style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {rankIcon ? (
                      <span className="text-lg">{rankIcon}</span>
                    ) : (
                      <span className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isCurrentDealer ? "text-orange-700" : "text-gray-900"}`}>
                      {entry.dealer_name}
                      {isCurrentDealer && <span className="text-[10px] text-orange-500 ml-1">(You)</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{entry.firm_name} &bull; {entry.region}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-bold ${isCurrentDealer ? "text-orange-600" : "text-gray-900"}`}>
                      ₹{entry.total_incentive.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[10px] text-gray-400">{entry.schemes_achieved}/{entry.total_schemes} done</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievement Badges */}
      <div className="px-4 mt-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-3">Achievement Badges</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[
            { name: "First Sale", icon: "🎯", earned: true },
            { name: "₹1L Club", icon: "💰", earned: summary.total_purchase_value >= 100000 },
            { name: "₹5L Club", icon: "💎", earned: summary.total_purchase_value >= 500000 },
            { name: "Scheme Star", icon: "⭐", earned: summary.schemes_fully_achieved >= 1 },
            { name: "Multi Achiever", icon: "🏆", earned: summary.schemes_fully_achieved >= 2 },
            { name: "Combo King", icon: "👑", earned: schemes.some(s => s.bonuses.some(b => b.achieved)) },
          ].map((badge, i) => (
            <div key={i} className={`flex-shrink-0 w-20 text-center p-3 rounded-xl ${badge.earned ? "bg-white shadow-md" : "bg-gray-100 opacity-50"}`}>
              <div className={`text-2xl mb-1 ${badge.earned ? "badge-pop" : "grayscale"}`}>{badge.icon}</div>
              <div className="text-[9px] font-semibold text-gray-600">{badge.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DealerDashboard() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
    <DealerDashboardInner />
  </Suspense>;
}

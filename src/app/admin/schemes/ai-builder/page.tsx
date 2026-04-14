"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Rule {
  rule_name: string;
  sku_category_id: number | null;
  condition_type: "value" | "quantity";
  min_threshold: number;
  incentive_calc_type: "percentage" | "per_unit" | "fixed" | "slab";
  incentive_value: number;
  is_additional: boolean;
  apply_on: string;
  description: string;
  slabs?: { slab_from: number; slab_to: number | null; incentive_calc_type: string; incentive_value: number }[];
}

interface BonusRule {
  bonus_name: string;
  required_rule_indices: number[];
  bonus_calc_type: string;
  bonus_value: number;
  apply_on: string;
  description: string;
}

interface BuiltScheme {
  scheme: {
    name: string;
    description: string;
    scheme_code: string;
    start_date: string;
    end_date: string;
    applicable_regions: string[];
    applicable_dealer_types: string[];
    incentive_type: string;
    rules: Rule[];
    bonus_rules: BonusRule[];
  };
  personalization_notes: string;
  dealer_calibrations: { dealer_name: string; expected_to_qualify: boolean; likelihood_pct: number; reasoning: string }[];
  roi_projection: {
    total_expected_cost: number;
    total_expected_revenue_uplift: number;
    roi_pct: number;
    dealers_likely_qualifying: number;
    dealers_stretch_targets: number;
  };
  model: string;
  dealer_count: number;
}

const REGIONS = ["north", "south", "east", "west", "central"];
const DEALER_TYPES = ["distributor", "retailer", "project_dealer", "contractor", "wholesaler"];

export default function AIBuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [regions, setRegions] = useState<string[]>([]);
  const [dealerTypes, setDealerTypes] = useState<string[]>([]);
  const [businessGoals, setBusinessGoals] = useState("");
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [incentiveType, setIncentiveType] = useState("credit_note");
  const [budgetMin, setBudgetMin] = useState<number>(0);
  const [budgetMax, setBudgetMax] = useState<number>(0);
  const [focusCategories, setFocusCategories] = useState<string>("");

  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [applicableDealers, setApplicableDealers] = useState<{ id: number; name: string; firm_name: string; type: string; region: string; total_purchase: number }[]>([]);
  const [territoryNotes, setTerritoryNotes] = useState<{ region: string; comment: string; author_name: string }[]>([]);

  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState<BuiltScheme | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/sku").then(r => r.json()).then(d => setCategories(d.categories || [])).catch(() => setCategories([]));
  }, []);

  const loadStep2 = async () => {
    try {
      const [dealersRes, notesRes] = await Promise.all([
        fetch("/api/dealers").then(r => r.json()).catch(() => []),
        fetch("/api/territory/comments").then(r => r.json()).catch(() => []),
      ]);
      const dealersArr = Array.isArray(dealersRes) ? dealersRes : [];
      const notesArr = Array.isArray(notesRes) ? notesRes : [];
      const filtered = dealersArr.filter((d: { region: string; type: string }) =>
        regions.includes(d.region) && dealerTypes.includes(d.type));
      setApplicableDealers(filtered);
      setTerritoryNotes(notesArr.filter((n: { region: string }) => regions.includes(n.region)));
      setStep(2);
    } catch (e) {
      console.error("loadStep2 failed:", e);
      alert("Failed to load dealers: " + String(e));
    }
  };

  const build = async () => {
    setBuilding(true);
    try {
      const res = await fetch("/api/ai/build-scheme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regions,
          dealer_types: dealerTypes,
          business_goals: businessGoals,
          target_categories: focusCategories.split(",").map(c => c.trim()).filter(Boolean),
          scheme_duration: { start_date: startDate, end_date: endDate },
          incentive_type: incentiveType,
          budget_range: budgetMax > 0 ? { min: budgetMin, max: budgetMax } : null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert("AI build failed: " + data.error);
        setBuilding(false);
        return;
      }
      setBuilt(data);
      setStep(3);
    } catch (e) {
      alert("Build failed: " + String(e));
    }
    setBuilding(false);
  };

  const saveScheme = async () => {
    if (!built) return;
    setSaving(true);
    try {
      // Convert required_rule_indices → required_rule_ids based on insertion order
      const schemePayload = {
        ...built.scheme,
        status: "active",
        ai_prompt: businessGoals,
        ai_model: built.model,
        bonus_rules: built.scheme.bonus_rules.map((b) => ({
          ...b,
          // API maps ids post-insert via indices; fall back to using indices as ids placeholder
          required_rule_ids: b.required_rule_indices,
        })),
      };
      const res = await fetch("/api/schemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schemePayload),
      });
      const saved = await res.json();
      if (saved.error) {
        alert("Save failed: " + saved.error);
        setSaving(false);
        return;
      }
      router.push(`/admin/schemes/${saved.id}`);
    } catch (e) {
      alert("Save failed: " + String(e));
    }
    setSaving(false);
  };

  const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-bold text-gray-900">AI Scheme Builder</h1>
          <span className="px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full">AI</span>
        </div>
        <p className="text-gray-500">Generate a personalized incentive scheme using dealer history, territory notes, and your business goals.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              step === s ? "bg-blue-600 text-white" : step > s ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {step > s ? "✓" : s}
            </div>
            <span className={`text-sm ${step === s ? "font-bold text-gray-900" : "text-gray-500"}`}>
              {s === 1 ? "Territory & Goals" : s === 2 ? "Review Dealers" : "AI Scheme"}
            </span>
            {s < 3 && <div className="w-8 h-0.5 bg-gray-200"></div>}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">Target Regions</label>
            <div className="flex gap-2 flex-wrap">
              {REGIONS.map(r => (
                <button key={r} onClick={() => toggle(regions, setRegions, r)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${regions.includes(r) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">Dealer Types</label>
            <div className="flex gap-2 flex-wrap">
              {DEALER_TYPES.map(t => (
                <button key={t} onClick={() => toggle(dealerTypes, setDealerTypes, t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${dealerTypes.includes(t) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">Business Goals *</label>
            <textarea value={businessGoals} onChange={(e) => setBusinessGoals(e.target.value)} rows={4}
              placeholder="e.g. Push fan sales ahead of summer. Grow revenue from contractors in North by 25%. Recover dormant retailers..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">Incentive Type</label>
              <select value={incentiveType} onChange={(e) => setIncentiveType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm">
                <option value="credit_note">Credit Note</option>
                <option value="cash">Cash</option>
                <option value="gift">Gift</option>
                <option value="foreign_trip">Foreign Trip</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">Budget Min (₹)</label>
              <input type="number" value={budgetMin || ""} onChange={(e) => setBudgetMin(Number(e.target.value))}
                placeholder="Optional" className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">Budget Max (₹)</label>
              <input type="number" value={budgetMax || ""} onChange={(e) => setBudgetMax(Number(e.target.value))}
                placeholder="Optional" className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-gray-600 font-bold block mb-2">Focus Categories (comma-separated)</label>
            <input value={focusCategories} onChange={(e) => setFocusCategories(e.target.value)}
              placeholder={categories.slice(0, 3).map(c => c.name).join(", ")}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm" />
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button onClick={loadStep2}
              disabled={!regions.length || !dealerTypes.length || !businessGoals}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-700">
              Next: Review Dealers →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Applicable Dealers</h2>
            <span className="text-sm text-gray-500">{applicableDealers.length} dealers will be considered</span>
          </div>

          {territoryNotes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-600 mb-2">Territory Context (AI will use this)</h3>
              <div className="space-y-2">
                {territoryNotes.slice(0, 5).map((n, i) => (
                  <div key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
                    <span className="font-semibold capitalize">[{n.region}] {n.author_name}:</span> {n.comment}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Dealer</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-left font-semibold">Region</th>
                  <th className="px-4 py-2 text-right font-semibold">Total Purchase</th>
                </tr>
              </thead>
              <tbody>
                {applicableDealers.map(d => (
                  <tr key={d.id} className="border-t border-gray-100">
                    <td className="px-4 py-2"><div className="font-semibold">{d.name}</div><div className="text-xs text-gray-500">{d.firm_name}</div></td>
                    <td className="px-4 py-2 capitalize">{d.type?.replace("_", " ")}</td>
                    <td className="px-4 py-2 capitalize">{d.region}</td>
                    <td className="px-4 py-2 text-right font-semibold">₹{Number(d.total_purchase || 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-6 border-t border-gray-100 mt-6">
            <button onClick={() => setStep(1)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200">
              ← Back
            </button>
            <button onClick={build} disabled={building}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg">
              {building ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  AI is building scheme...
                </span>
              ) : "✨ Generate AI Scheme"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && built && (
        <div className="space-y-6">
          {/* ROI */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{built.scheme.name}</h2>
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full">Model: {built.model}</span>
            </div>
            <p className="text-sm text-white/90 mb-6">{built.scheme.description}</p>
            <div className="grid grid-cols-5 gap-4">
              <div><div className="text-xs uppercase tracking-wider opacity-75">Expected Cost</div><div className="text-2xl font-black">₹{(built.roi_projection.total_expected_cost / 100000).toFixed(1)}L</div></div>
              <div><div className="text-xs uppercase tracking-wider opacity-75">Revenue Uplift</div><div className="text-2xl font-black">₹{(built.roi_projection.total_expected_revenue_uplift / 100000).toFixed(1)}L</div></div>
              <div><div className="text-xs uppercase tracking-wider opacity-75">ROI</div><div className="text-2xl font-black">{built.roi_projection.roi_pct}%</div></div>
              <div><div className="text-xs uppercase tracking-wider opacity-75">Likely Qualifiers</div><div className="text-2xl font-black">{built.roi_projection.dealers_likely_qualifying}</div></div>
              <div><div className="text-xs uppercase tracking-wider opacity-75">Stretch Targets</div><div className="text-2xl font-black">{built.roi_projection.dealers_stretch_targets}</div></div>
            </div>
          </div>

          {/* Personalization reasoning */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-600 mb-2">AI Reasoning</h3>
            <p className="text-gray-700 italic">"{built.personalization_notes}"</p>
          </div>

          {/* Rules */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold mb-4">Scheme Rules ({built.scheme.rules.length})</h3>
            <div className="space-y-3">
              {built.scheme.rules.map((r, i) => (
                <div key={i} className="p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold">{r.rule_name}</div>
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded uppercase">{r.incentive_calc_type}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">{r.description}</div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Min: {r.condition_type === "value" ? "₹" : ""}{r.min_threshold.toLocaleString("en-IN")} {r.condition_type === "quantity" ? "units" : ""}</span>
                    <span>Incentive: {r.incentive_calc_type === "percentage" ? `${r.incentive_value}%` : `₹${r.incentive_value}`}</span>
                    {r.is_additional && <span className="text-orange-600 font-semibold">Additional</span>}
                  </div>
                </div>
              ))}
            </div>

            {built.scheme.bonus_rules?.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-600 mb-2">Bonus Rules</h4>
                <div className="space-y-2">
                  {built.scheme.bonus_rules.map((b, i) => (
                    <div key={i} className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <div className="font-semibold text-sm">{b.bonus_name}</div>
                      <div className="text-xs text-gray-600 mt-1">{b.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dealer Calibrations */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold mb-4">Dealer Qualification Forecast</h3>
            <div className="grid grid-cols-2 gap-3">
              {built.dealer_calibrations.map((d, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">{d.dealer_name}</div>
                    <span className={`text-xs font-bold ${d.likelihood_pct >= 70 ? "text-green-600" : d.likelihood_pct >= 40 ? "text-orange-600" : "text-red-600"}`}>
                      {d.likelihood_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                    <div className={`h-2 rounded-full ${d.likelihood_pct >= 70 ? "bg-green-500" : d.likelihood_pct >= 40 ? "bg-orange-500" : "bg-red-500"}`}
                      style={{ width: `${d.likelihood_pct}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-600">{d.reasoning}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => { setBuilt(null); setStep(1); }}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200">
              Start Over
            </button>
            <button onClick={saveScheme} disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg">
              {saving ? "Saving..." : "💾 Save & Activate Scheme"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TestCalc { dealer_name: string; dealer_type: string; region: string; rules: any[]; bonuses: any[]; total_incentive: number; verdict: string }

export default function AICreateScheme() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [generatedScheme, setGeneratedScheme] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const [inputMode, setInputMode] = useState<"prompt" | "pdf">("prompt");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [testCalculations, setTestCalculations] = useState<TestCalc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const examplePrompts = [
    "Create a Q2 2026 scheme for distributors in North and West regions. Buy ₹2 lakh of Modular Switches, get 1.5% incentive. Above ₹5 lakh get 3%. If they also buy 200 LED products, give ₹8 per LED unit. Both targets met = extra 1% on total. Credit note incentive. Scheme effective from April 1 but being created now - backdate it.",
    "For all retailers across India. Buy 100 ceiling fans get ₹200 per fan. Buy 200 fans get ₹400 per fan. Buy 50 BLDC fans additionally and get 5% on BLDC value. Voucher incentive. April to June 2026.",
    "Project dealers only. Smart Home category push. Buy 30 Smart WiFi Switches for 5% value incentive. Buy 50 Smart Plugs for ₹75 per plug. Buy 20 IR Remotes for flat ₹8000. All 3 targets = 12% bonus on total smart home purchase. Gift incentive. April to September 2026.",
    "Wire & Cable scheme for wholesalers in North zone only. Slab based: ₹3L wire purchase = 2%, ₹7L = 3.5%, ₹15L = 5%. Extra ₹150 per coil for 4.0sqmm wire if 60+ coils bought. Credit note. March to May 2026, backdated.",
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setGeneratedScheme(null);
    setTestCalculations([]);
    try {
      if (inputMode === "pdf") {
        // PDF/text mode
        const formData = new FormData();
        if (pdfFile) formData.append("file", pdfFile);
        if (pdfText) formData.append("text", pdfText);

        if (!pdfFile && !pdfText.trim()) { setError("Upload a PDF or paste scheme terms"); setGenerating(false); return; }

        const res = await fetch("/api/ai/parse-scheme-pdf", { method: "POST", body: formData });
        const data = await res.json();
        if (data.error) { setError(data.error); }
        else {
          setGeneratedScheme(data.scheme);
          setTestCalculations(data.test_calculations || []);
        }
      } else {
        // Prompt mode
        if (!prompt.trim()) { setGenerating(false); return; }
        const res = await fetch("/api/ai/create-scheme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (data.error) { setError(data.error); }
        else { setGeneratedScheme(data.scheme); }
      }
    } catch (e) { setError(String(e)); }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!generatedScheme) return;
    setSaving(true);
    try {
      const payload = { ...generatedScheme, ai_prompt: prompt, ai_model: "claude-sonnet-4-20250514" };
      const res = await fetch("/api/schemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.id) {
        // Trigger calculation
        await fetch(`/api/schemes/${data.id}/calculate`);
        router.push(`/admin/schemes/${data.id}`);
      } else { setError("Failed to save scheme"); }
    } catch (e) { setError(String(e)); }
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Scheme Creator</h1>
      <p className="text-gray-500 mb-8">Describe your scheme in natural language and AI will create the complete structure with rules, slabs, and bonuses</p>

      {/* Input Mode Toggle */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => setInputMode("prompt")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all ${inputMode === "prompt" ? "bg-purple-600 text-white shadow-lg" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Natural Language Prompt
        </button>
        <button onClick={() => setInputMode("pdf")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all ${inputMode === "pdf" ? "bg-purple-600 text-white shadow-lg" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          Upload PDF / Paste Terms
          <span className="text-[9px] bg-orange-500 px-2 py-0.5 rounded-full font-bold text-white">NEW</span>
        </button>
      </div>

      {/* Prompt Input */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={inputMode === "pdf" ? "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" : "M13 10V3L4 14h7v7l9-11h-7z"}/></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">{inputMode === "pdf" ? "Upload Scheme Terms Document" : "Describe Your Scheme"}</h2>
          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI Powered</span>
        </div>

        {inputMode === "prompt" ? (
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Example: Create a scheme for distributors in North region. If they purchase ₹1 lakh of Modular Switches from April to June, give 1% incentive. Above ₹2.5 lakh give 2%. If they also buy ₹50,000 of MCBs, give additional 2% on MCB value..."
            className="w-full h-40 p-4 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
        ) : (
          <div className="space-y-4">
            {/* PDF Upload */}
            <div onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${pdfFile ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-purple-400 hover:bg-purple-50/50"}`}>
              {pdfFile ? (
                <div>
                  <div className="w-14 h-14 mx-auto mb-2 bg-green-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <p className="font-medium text-green-700">{pdfFile.name}</p>
                  <p className="text-sm text-green-500 mt-1">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                  <p className="text-xs text-gray-400 mt-2">Click to change</p>
                </div>
              ) : (
                <div>
                  <div className="w-14 h-14 mx-auto mb-2 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                  </div>
                  <p className="font-medium text-gray-600">Upload Scheme PDF</p>
                  <p className="text-xs text-gray-400 mt-1">.pdf, .txt, .docx</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.docx" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 font-medium">OR paste scheme terms below</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Text Paste */}
            <textarea
              value={pdfText}
              onChange={e => setPdfText(e.target.value)}
              placeholder={"Paste scheme terms & conditions here...\n\nExample:\nScheme Name: Q2 Modular Switch Push\nPeriod: April 1, 2026 to June 30, 2026\nApplicable: All distributors in North & West region\n\nTerms:\n1. Purchase of ₹1,00,000 in Modular Switches category → 1% incentive on total value\n2. Purchase above ₹2,50,000 → 2.5% incentive on total value\n3. Additional: Buy 200+ MCB units → ₹15 per unit incentive\n4. Combo Bonus: If both Switch and MCB targets met → extra 0.5% on total purchase\n\nIncentive Type: Credit Note\nNote: Scheme is backdated, effective from April 1 but created May 10"}
              className="w-full h-48 p-4 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-gray-400">
            {inputMode === "pdf" ? "AI will parse the document, create scheme structure, and test against sample dealers" : "Include: target amounts, SKU categories, dealer types, regions, time period, incentive type"}
          </div>
          <button onClick={handleGenerate} disabled={generating || (inputMode === "prompt" ? !prompt.trim() : !pdfFile && !pdfText.trim())}
            className="px-8 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
            {generating ? (
              <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> {inputMode === "pdf" ? "Parsing & Testing..." : "AI Generating..."}</>
            ) : (
              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> {inputMode === "pdf" ? "Parse & Generate Scheme" : "Generate Scheme"}</>
            )}
          </button>
        </div>
      </div>

      {/* Example Prompts */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">Example Complex Scheme Prompts</h3>
        <div className="grid grid-cols-2 gap-3">
          {examplePrompts.map((ep, i) => (
            <button key={i} onClick={() => setPrompt(ep)}
              className="p-3 text-left text-xs text-gray-600 bg-gray-50 rounded-xl hover:bg-purple-50 hover:text-purple-700 transition-colors border border-transparent hover:border-purple-200">
              {ep.slice(0, 150)}...
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 text-sm">{error}</div>
      )}

      {/* Generated Result */}
      {generatedScheme && (
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 border-2 border-green-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">AI Generated Scheme</h2>
                <p className="text-xs text-gray-500">Review the structure below and save to activate</p>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? "Saving & Calculating..." : "Save & Activate Scheme"}
            </button>
          </div>

          {/* Scheme Overview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-400 uppercase mb-1">Name</div>
              <div className="font-semibold">{generatedScheme.name as string}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-400 uppercase mb-1">Period</div>
              <div className="font-semibold">{generatedScheme.start_date as string} → {generatedScheme.end_date as string}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-400 uppercase mb-1">Incentive</div>
              <div className="font-semibold capitalize">{(generatedScheme.incentive_type as string || "").replace("_", " ")}</div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl mb-4 text-sm text-blue-800">
            <strong>Description:</strong> {generatedScheme.description as string}
          </div>

          {generatedScheme.calculation_logic && (
            <div className="p-4 bg-purple-50 rounded-xl mb-4 text-sm text-purple-800">
              <strong>Calculation Logic:</strong> {generatedScheme.calculation_logic as string}
            </div>
          )}

          {/* Regions & Types */}
          <div className="flex gap-6 mb-6">
            <div>
              <div className="text-xs text-gray-400 uppercase mb-2">Regions</div>
              <div className="flex gap-1">{((generatedScheme.applicable_regions as string[]) || []).map(r => <span key={r} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs capitalize">{r}</span>)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase mb-2">Dealer Types</div>
              <div className="flex gap-1">{((generatedScheme.applicable_dealer_types as string[]) || []).map(t => <span key={t} className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs capitalize">{(t || "").replace("_", " ")}</span>)}</div>
            </div>
            {generatedScheme.is_backdated && (
              <div>
                <div className="text-xs text-gray-400 uppercase mb-2">Backdated</div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Yes - historical invoices included</span>
              </div>
            )}
          </div>

          {/* Rules Preview */}
          <h3 className="font-bold text-gray-900 mb-3">Rules ({((generatedScheme.rules as unknown[]) || []).length})</h3>
          <div className="space-y-3 mb-6">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(generatedScheme.rules || []).map((rule: any, i: number) => (
              <div key={i} className={`p-4 rounded-xl border ${rule.is_additional ? "border-orange-200 bg-orange-50/50" : "border-gray-200 bg-gray-50/50"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span className="font-semibold text-sm">{rule.rule_name}</span>
                  {rule.is_additional && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Stacking</span>}
                </div>
                <p className="text-xs text-gray-600 ml-8">{rule.description}</p>
                {rule.slabs && (
                  <div className="ml-8 mt-2 space-y-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {rule.slabs.map((slab: any, si: number) => (
                      <div key={si} className="text-xs text-gray-500 flex gap-2">
                        <span className="text-gray-400">Slab {si + 1}:</span>
                        ₹{Number(slab.slab_from).toLocaleString("en-IN")} {slab.slab_to ? `→ ₹${Number(slab.slab_to).toLocaleString("en-IN")}` : "+"} = {slab.incentive_calc_type === "percentage" ? `${slab.incentive_value}%` : `₹${slab.incentive_value}/unit`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bonus Rules Preview */}
          {generatedScheme.bonus_rules?.length > 0 && (
            <>
              <h3 className="font-bold text-gray-900 mb-3">Combo Bonuses</h3>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(generatedScheme.bonus_rules || []).map((bonus: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border-2 border-yellow-200 bg-yellow-50/50 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-600">★</span>
                    <span className="font-semibold text-sm">{bonus.bonus_name}</span>
                  </div>
                  <p className="text-xs text-gray-600 ml-6">{bonus.description}</p>
                </div>
              ))}
            </>
          )}

          {/* JSON Preview */}
          <details className="mt-4">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View Raw JSON</summary>
            <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-xl text-xs overflow-x-auto max-h-64">{JSON.stringify(generatedScheme, null, 2)}</pre>
          </details>
        </div>
      )}

      {/* Test Calculations Against Sample Dealers */}
      {testCalculations.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Test Calculations - Sample Dealers</h2>
              <p className="text-xs text-gray-500">AI tested this scheme against {testCalculations.length} real dealers to verify the logic</p>
            </div>
          </div>

          <div className="space-y-4">
            {testCalculations.map((calc, i) => (
              <div key={i} className={`rounded-xl border-2 overflow-hidden ${calc.total_incentive > 0 ? "border-green-200" : "border-gray-200"}`}>
                {/* Dealer Header */}
                <div className={`p-4 ${calc.total_incentive > 0 ? "bg-green-50" : "bg-gray-50"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${calc.total_incentive > 0 ? "bg-green-500" : "bg-gray-400"}`}>
                        {calc.dealer_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{calc.dealer_name}</div>
                        <div className="text-xs text-gray-500 capitalize">{(calc.dealer_type || '').replaceAll("_", " ")} &bull; {calc.region}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${calc.total_incentive > 0 ? "text-green-700" : "text-gray-400"}`}>
                        {calc.total_incentive > 0 ? `₹${calc.total_incentive.toLocaleString("en-IN")}` : "₹0"}
                      </div>
                      <div className="text-xs text-gray-400">Total Incentive</div>
                    </div>
                  </div>
                </div>

                {/* Rules Breakdown */}
                <div className="p-4">
                  <div className="text-xs text-gray-400 uppercase font-semibold mb-2">Rule-wise Calculation</div>
                  <div className="space-y-2">
                    {(calc.rules || []).map((rule: { rule_name: string; target: string; achieved: string; met: boolean; incentive: number; calculation: string }, ri: number) => (
                      <div key={ri} className="flex items-start gap-3 text-sm">
                        <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${rule.met ? "bg-green-500" : "bg-red-400"}`}>
                          {rule.met ? "✓" : "✗"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800">{rule.rule_name}</div>
                          <div className="text-xs text-gray-500">
                            Target: {rule.target} &bull; Achieved: {rule.achieved}
                          </div>
                          {rule.calculation && <div className="text-xs text-blue-600 mt-0.5">{rule.calculation}</div>}
                        </div>
                        <div className={`text-sm font-bold flex-shrink-0 ${rule.incentive > 0 ? "text-green-600" : "text-gray-300"}`}>
                          ₹{(rule.incentive || 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bonuses */}
                  {calc.bonuses && calc.bonuses.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-400 uppercase font-semibold mb-2">Bonuses</div>
                      {calc.bonuses.map((bonus: { name: string; triggered: boolean; amount: number }, bi: number) => (
                        <div key={bi} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-500">{bonus.triggered ? "★" : "☆"}</span>
                            <span className="text-gray-700">{bonus.name}</span>
                          </div>
                          <span className={`font-bold ${bonus.triggered ? "text-yellow-600" : "text-gray-300"}`}>
                            {bonus.triggered ? `+₹${(bonus.amount || 0).toLocaleString("en-IN")}` : "Not triggered"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Verdict */}
                  {calc.verdict && (
                    <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">{calc.verdict}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-yellow-50 rounded-xl text-xs text-yellow-700 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>These are AI-estimated calculations based on dealer purchase history. Actual results after saving will be computed by the calculation engine using exact invoice-level data and may differ slightly.</span>
          </div>
        </div>
      )}
    </div>
  );
}

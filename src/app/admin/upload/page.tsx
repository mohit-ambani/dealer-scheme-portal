"use client";
import { useState, useRef } from "react";

type UploadType = "invoices" | "dealers" | "skus";

interface UploadResult {
  success?: boolean;
  error?: string;
  mapping?: Record<string, string>;
  mapping_source?: string;
  unmapped_columns?: string[];
  errors?: string[];
  // invoices
  invoices_created?: number;
  items_created?: number;
  skipped_duplicates?: string[];
  // dealers
  dealers_created?: number;
  dealers_updated?: number;
  // skus
  skus_created?: number;
  skus_updated?: number;
  categories_created?: number;
  total_rows_processed?: number;
}

const tabs: { key: UploadType; label: string; icon: string; desc: string }[] = [
  {
    key: "invoices",
    label: "Invoices",
    icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
    desc: "Upload invoices in any Excel format. AI will auto-map columns like Invoice No, Party Name, Date, Product, Qty, Rate, Amount to our structure. JSON is also accepted.",
  },
  {
    key: "dealers",
    label: "Dealers",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    desc: "Upload dealer master in any format. Columns like Name, Code, Firm, Type, Region, City, State, Phone, Email, GST will be auto-mapped.",
  },
  {
    key: "skus",
    label: "SKU Master",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    desc: "Upload SKU/product master in any format. Columns like Product Name, Code, Category, Price, HSN, Unit will be auto-mapped. New categories are created automatically.",
  },
];

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<UploadType>("invoices");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [uploadMode, setUploadMode] = useState<"excel" | "json">("excel");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setResult(null);
    setSelectedFile(null);
    setJsonInput("");
  };

  const handleTabChange = (tab: UploadType) => {
    setActiveTab(tab);
    resetState();
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = async () => {
    setUploading(true);
    setResult(null);

    try {
      let res: Response;

      if (uploadMode === "json") {
        if (!jsonInput.trim()) {
          setResult({ error: "Please paste JSON data" });
          setUploading(false);
          return;
        }
        res = await fetch(`/api/upload/${activeTab}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonInput,
        });
      } else {
        if (!selectedFile) {
          setResult({ error: "Please select a file" });
          setUploading(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        res = await fetch(`/api/upload/${activeTab}`, {
          method: "POST",
          body: formData,
        });
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: String(err) });
    }
    setUploading(false);
  };

  const currentTab = tabs.find(t => t.key === activeTab)!;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Upload Data</h1>
          <p className="text-gray-500 mt-1">AI-powered auto-mapping for any Excel or JSON format</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-xl border border-purple-200">
          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm font-medium text-purple-700">AI Auto-Mapping</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === tab.key
                ? "bg-[#1e3a5f] text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800">{currentTab.desc}</p>
            <p className="text-xs text-blue-600 mt-1">Column headers don&apos;t need to match exactly - AI will figure out the mapping.</p>
          </div>
        </div>
      </div>

      {/* Upload Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setUploadMode("excel"); resetState(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            uploadMode === "excel" ? "bg-green-100 text-green-700 border-2 border-green-300" : "bg-gray-100 text-gray-500 border-2 border-transparent"
          }`}
        >
          Excel / CSV Upload
        </button>
        <button
          onClick={() => { setUploadMode("json"); resetState(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            uploadMode === "json" ? "bg-green-100 text-green-700 border-2 border-green-300" : "bg-gray-100 text-gray-500 border-2 border-transparent"
          }`}
        >
          JSON Paste
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Upload Area */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          {uploadMode === "excel" ? (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Upload Excel / CSV File</h3>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragOver ? "border-blue-400 bg-blue-50" : selectedFile ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
                }`}
              >
                {selectedFile ? (
                  <div>
                    <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="font-medium text-green-700">{selectedFile.name}</p>
                    <p className="text-sm text-green-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <p className="text-xs text-gray-400 mt-2">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="font-medium text-gray-700">Drop your file here</p>
                    <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                    <p className="text-xs text-gray-300 mt-3">.xlsx, .xls, .csv supported</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
              </div>
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Paste JSON Data</h3>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`Paste your JSON here...\n\nExample:\n[\n  {\n    "Invoice No": "INV-001",\n    "Party": "Rajesh Kumar",\n    "Date": "2026-04-01",\n    "Product": "6A Switch",\n    "Qty": 100,\n    "Rate": 45\n  }\n]`}
                className="w-full h-72 p-4 border border-gray-200 rounded-xl text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || (uploadMode === "excel" ? !selectedFile : !jsonInput.trim())}
            className="w-full mt-4 py-3 bg-[#1e3a5f] text-white rounded-xl font-semibold hover:bg-[#2a4d7a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {uploading ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI is mapping &amp; uploading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload &amp; Auto-Map with AI
              </>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Upload Results</h3>

          {!result && !uploading && (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Upload results will appear here</p>
            </div>
          )}

          {uploading && (
            <div className="text-center py-16">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 font-medium">Processing upload...</p>
              <p className="text-sm text-gray-400 mt-1">AI is analyzing your column headers</p>
            </div>
          )}

          {result && !uploading && (
            <div className="space-y-4">
              {/* Status */}
              {result.error && !result.success ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2 text-red-700 font-medium">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Error
                  </div>
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Upload Successful
                  </div>
                </div>
              )}

              {/* Stats */}
              {result.success && (
                <div className="grid grid-cols-2 gap-3">
                  {result.invoices_created !== undefined && (
                    <>
                      <StatCard label="Invoices Created" value={result.invoices_created} color="blue" />
                      <StatCard label="Line Items" value={result.items_created || 0} color="indigo" />
                    </>
                  )}
                  {result.dealers_created !== undefined && (
                    <>
                      <StatCard label="Dealers Created" value={result.dealers_created} color="blue" />
                      <StatCard label="Dealers Updated" value={result.dealers_updated || 0} color="orange" />
                    </>
                  )}
                  {result.skus_created !== undefined && (
                    <>
                      <StatCard label="SKUs Created" value={result.skus_created} color="blue" />
                      <StatCard label="SKUs Updated" value={result.skus_updated || 0} color="orange" />
                      <StatCard label="New Categories" value={result.categories_created || 0} color="purple" />
                    </>
                  )}
                  <StatCard label="Rows Processed" value={result.total_rows_processed || 0} color="gray" />
                </div>
              )}

              {/* AI Mapping */}
              {result.mapping && Object.keys(result.mapping).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">AI Column Mapping</h4>
                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                      {result.mapping_source === "ai" ? "GPT-4o" : "Heuristic"}
                    </span>
                  </div>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          <th className="text-left py-2 px-3 font-medium">Your Column</th>
                          <th className="text-center py-2 px-3 font-medium">-&gt;</th>
                          <th className="text-left py-2 px-3 font-medium">Mapped To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {Object.entries(result.mapping).map(([src, tgt]) => (
                          <tr key={src} className="hover:bg-gray-50">
                            <td className="py-1.5 px-3 text-gray-700 font-mono">{src}</td>
                            <td className="py-1.5 px-3 text-center text-gray-300">
                              <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </td>
                            <td className="py-1.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                tgt === "unmapped" ? "bg-gray-100 text-gray-400" : "bg-green-100 text-green-700"
                              }`}>
                                {tgt}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Skipped Duplicates */}
              {result.skipped_duplicates && result.skipped_duplicates.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="text-xs font-medium text-yellow-700 mb-1">Skipped Duplicates ({result.skipped_duplicates.length})</div>
                  <p className="text-xs text-yellow-600">{result.skipped_duplicates.join(", ")}</p>
                </div>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl max-h-48 overflow-y-auto">
                  <div className="text-xs font-medium text-red-700 mb-1">Row Errors ({result.errors.length})</div>
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sample Format Help */}
      <div className="mt-8 bg-white rounded-2xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Sample Formats (any format works - AI auto-maps!)</h3>
        <div className="grid grid-cols-3 gap-6">
          <SampleFormat
            title="Invoice Excel"
            columns={["Bill No", "Party Name", "Bill Date", "Item", "Qty", "Rate", "Amount"]}
            sample={["INV-101", "Rajesh Traders", "01/04/2026", "6A Switch", "500", "45", "22500"]}
          />
          <SampleFormat
            title="Dealer Excel"
            columns={["Dealer Name", "Code", "Firm", "Channel", "Zone", "City", "Mobile", "GSTIN"]}
            sample={["Amit Shah", "DLR-015", "Shah Electricals", "Retailer", "West", "Mumbai", "9876543210", "27AABCS1234A1Z5"]}
          />
          <SampleFormat
            title="SKU Excel"
            columns={["Product Name", "SKU Code", "Category", "MRP", "HSN", "UOM"]}
            sample={["Premium 6A Switch", "GW-SW-001", "Modular Switches", "85", "8536", "piece"]}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
    green: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <div className={`rounded-xl p-3 border ${colors[color] || colors.gray}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

function SampleFormat({ title, columns, sample }: { title: string; columns: string[]; sample: string[] }) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      <div className="border rounded-lg overflow-hidden text-xs">
        <div className="flex bg-gray-100">
          {columns.map(c => <div key={c} className="flex-1 px-2 py-1.5 font-medium text-gray-600 border-r last:border-r-0 truncate">{c}</div>)}
        </div>
        <div className="flex bg-white">
          {sample.map((s, i) => <div key={i} className="flex-1 px-2 py-1.5 text-gray-500 border-r last:border-r-0 truncate">{s}</div>)}
        </div>
      </div>
    </div>
  );
}

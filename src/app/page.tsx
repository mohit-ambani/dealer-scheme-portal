"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    // Auto-seed on first load
    fetch("/api/seed").then(r => r.json()).then(d => {
      if (d.status === "already_seeded" || d.status === "seeded") setSeeded(true);
    });
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    setSeeded(true);
    setSeeding(false);
  };

  return (
    <div className="min-h-screen bg-gw-gradient flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl font-black text-[#1e3a5f]">GW</span>
            </div>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">
            Greatwhite Global
          </h1>
          <p className="text-xl text-blue-200 font-light">
            AI-Powered Dealer Incentive Scheme Management
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-green-300 text-sm">{seeded ? "System Ready" : "Initializing..."}</span>
          </div>
        </div>

        {/* Portal Selection */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Admin Portal */}
          <button
            onClick={() => router.push("/admin")}
            className="card-hover bg-white rounded-3xl p-8 text-left group cursor-pointer border-2 border-transparent hover:border-[#f47920] transition-all"
          >
            <div className="w-14 h-14 bg-gw-orange-gradient rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Portal</h2>
            <p className="text-gray-500 mb-4">Create & manage dealer schemes using AI, view masters, track scheme performance</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold">AI Scheme Creator</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">SKU Master</span>
              <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold">Dealer Master</span>
            </div>
          </button>

          {/* Dealer Portal */}
          <button
            onClick={() => router.push("/dealer/login")}
            className="card-hover bg-white rounded-3xl p-8 text-left group cursor-pointer border-2 border-transparent hover:border-[#2a5298] transition-all"
          >
            <div className="w-14 h-14 bg-gw-gradient rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Dealer Portal</h2>
            <p className="text-gray-500 mb-4">View your schemes, track achievements, download incentives with gamified experience</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold">My Schemes</span>
              <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-semibold">Achievements</span>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">Incentives</span>
            </div>
          </button>
        </div>

        {/* Seed Button */}
        {!seeded && (
          <div className="text-center mt-8">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors disabled:opacity-50"
            >
              {seeding ? "Setting up demo data..." : "Initialize Demo Data"}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-blue-300 text-sm">
          <p>Powered by AI &bull; Claude for Scheme Intelligence &bull; Real-time Calculation Engine</p>
        </div>
      </div>
    </div>
  );
}

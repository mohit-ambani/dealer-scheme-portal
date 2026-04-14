"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import topoData from "@/lib/india-states-topo.json";

type RegionKey = "north" | "south" | "east" | "west" | "central";

interface RegionData {
  dealer_count: number;
  total_revenue: number;
  invoice_count: number;
  scheme_completion_pct: number;
  total_incentive: number;
  top_dealers: { id: number; name: string; firm_name: string; type: string; total_purchase: number }[];
  category_breakdown: { category: string; revenue: number }[];
}

interface TerritoryComment {
  id: number;
  region: string;
  state: string | null;
  comment: string;
  author_name: string;
  created_at: string;
}

type Metric = "revenue" | "completion" | "incentive" | "dealers";

const METRIC_LABEL: Record<Metric, string> = {
  revenue: "Revenue",
  completion: "Scheme Completion %",
  incentive: "Incentive Paid",
  dealers: "Dealer Count",
};

// --- State -> Region mapping (keys lowercased, punctuation-stripped) -----------
const STATE_REGION: Record<string, RegionKey> = {
  // North
  "jammu kashmir": "north",
  "himachal pradesh": "north",
  "punjab": "north",
  "haryana": "north",
  "uttarakhand": "north",
  "nct of delhi": "north",
  "delhi": "north",
  "uttar pradesh": "north",
  "rajasthan": "north",
  "chandigarh": "north",
  "ladakh": "north",
  // South
  "karnataka": "south",
  "kerala": "south",
  "tamil nadu": "south",
  "andhra pradesh": "south",
  "telangana": "south",
  "puducherry": "south",
  "lakshadweep": "south",
  "andaman nicobar island": "south",
  "andaman nicobar islands": "south",
  "andaman and nicobar": "south",
  // East
  "west bengal": "east",
  "bihar": "east",
  "jharkhand": "east",
  "odisha": "east",
  "orissa": "east",
  "assam": "east",
  "arunachal pradesh": "east",
  "arunanchal pradesh": "east",
  "nagaland": "east",
  "manipur": "east",
  "mizoram": "east",
  "tripura": "east",
  "meghalaya": "east",
  "sikkim": "east",
  // West
  "gujarat": "west",
  "maharashtra": "west",
  "goa": "west",
  "dadara nagar havelli": "west",
  "dadra and nagar haveli": "west",
  "daman diu": "west",
  "daman and diu": "west",
  // Central
  "madhya pradesh": "central",
  "chhattisgarh": "central",
};

function normalizeStateName(n: string): string {
  return n
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function regionFor(stateName: string | null | undefined): RegionKey | null {
  if (!stateName) return null;
  const norm = normalizeStateName(stateName);
  if (STATE_REGION[norm]) return STATE_REGION[norm];
  // try partial contains
  for (const key of Object.keys(STATE_REGION)) {
    if (norm.includes(key) || key.includes(norm)) return STATE_REGION[key];
  }
  return null;
}

// --- TopoJSON -> absolute coordinate rings --------------------------------------
type Topology = {
  type: "Topology";
  arcs: number[][][];
  transform: { scale: [number, number]; translate: [number, number] };
  objects: {
    india: {
      type: "GeometryCollection";
      geometries: Array<{
        type: "Polygon" | "MultiPolygon";
        id: string;
        properties: { name: string | null };
        arcs: number[][] | number[][][];
      }>;
    };
  };
};

const topology = topoData as unknown as Topology;

function decodeArc(arc: number[][], scale: [number, number], translate: [number, number]): [number, number][] {
  let x = 0;
  let y = 0;
  const out: [number, number][] = [];
  for (const [dx, dy] of arc) {
    x += dx;
    y += dy;
    out.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
  }
  return out;
}

const decodedArcs: [number, number][][] = topology.arcs.map(a =>
  decodeArc(a, topology.transform.scale, topology.transform.translate)
);

function ringFromArcIndexes(indexes: number[]): [number, number][] {
  const coords: [number, number][] = [];
  for (const idx of indexes) {
    const reverse = idx < 0;
    const arc = decodedArcs[reverse ? ~idx : idx];
    const seq = reverse ? [...arc].reverse() : arc;
    // Skip first point when continuing a ring to avoid duplicate join
    const start = coords.length === 0 ? 0 : 1;
    for (let i = start; i < seq.length; i++) coords.push(seq[i]);
  }
  return coords;
}

// Linear projection from lon/lat to SVG coords. India spans roughly
// lon 68..97.5 and lat 6.5..37.5. We fit into viewBox with aspect compensation.
const VIEW_W = 550;
const VIEW_H = 620;
const LON_MIN = 67.5;
const LON_MAX = 97.5;
const LAT_MIN = 6.5;
const LAT_MAX = 37.5;
// Latitude compression factor (cos of center lat) so shape isn't too stretched
const LAT_CENTER = (LAT_MIN + LAT_MAX) / 2;
const LON_SCALE = Math.cos((LAT_CENTER * Math.PI) / 180);

function project([lon, lat]: [number, number]): [number, number] {
  const nx = ((lon - LON_MIN) * LON_SCALE) / ((LON_MAX - LON_MIN) * LON_SCALE);
  const ny = 1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN);
  // Padding so nothing touches edges
  const px = 20 + nx * (VIEW_W - 40);
  const py = 20 + ny * (VIEW_H - 40);
  return [px, py];
}

function ringToPath(ring: [number, number][]): string {
  if (ring.length === 0) return "";
  const [x0, y0] = project(ring[0]);
  let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = project(ring[i]);
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d + " Z";
}

interface StateShape {
  id: string;
  name: string;
  region: RegionKey | null;
  d: string;
  centroid: [number, number];
}

function computeCentroid(rings: [number, number][][]): [number, number] {
  // area-weighted centroid of union of rings (in projected space)
  let totalArea = 0;
  let cx = 0;
  let cy = 0;
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const projected = ring.map(project);
    let area = 0;
    let rx = 0;
    let ry = 0;
    for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
      const [xi, yi] = projected[i];
      const [xj, yj] = projected[j];
      const cross = xj * yi - xi * yj;
      area += cross;
      rx += (xi + xj) * cross;
      ry += (yi + yj) * cross;
    }
    area *= 0.5;
    if (area !== 0) {
      totalArea += area;
      cx += rx / 6;
      cy += ry / 6;
    }
  }
  if (totalArea === 0) return [0, 0];
  return [cx / totalArea, cy / totalArea];
}

const STATE_SHAPES: StateShape[] = topology.objects.india.geometries
  .filter(g => g.id !== "-99" && g.properties?.name)
  .map(g => {
    const name = g.properties.name as string;
    const region = regionFor(name);
    let polygons: [number, number][][][];
    if (g.type === "Polygon") {
      polygons = [(g.arcs as number[][]).map(ringFromArcIndexes)];
    } else {
      polygons = (g.arcs as number[][][]).map(poly => poly.map(ringFromArcIndexes));
    }
    const d = polygons
      .map(poly => poly.map(ringToPath).join(" "))
      .join(" ");
    const allOuterRings = polygons.map(p => p[0]).filter(Boolean);
    const centroid = computeCentroid(allOuterRings);
    return { id: g.id, name, region, d, centroid };
  });

// --- Heat color ------------------------------------------------------------------
function getHeatColor(value: number, max: number): string {
  if (max === 0) return "#e5e7eb";
  const pct = value / max;
  if (pct >= 0.8) return "#dc2626";
  if (pct >= 0.6) return "#ea580c";
  if (pct >= 0.4) return "#f59e0b";
  if (pct >= 0.2) return "#eab308";
  if (pct > 0) return "#84cc16";
  return "#e5e7eb";
}

// --- Component -------------------------------------------------------------------
export default function TerritoryPage() {
  const [regions, setRegions] = useState<Record<string, RegionData>>({});
  const [metric, setMetric] = useState<Metric>("revenue");
  const [selected, setSelected] = useState<string | null>(null);
  const [comments, setComments] = useState<TerritoryComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [hoverRegion, setHoverRegion] = useState<RegionKey | null>(null);

  useEffect(() => {
    fetch("/api/territory/stats").then(r => r.json()).then(d => { setRegions(d); setLoading(false); });
    fetch("/api/territory/comments").then(r => r.json()).then(setComments);
  }, []);

  const getMetricValue = (r: RegionData | undefined) => {
    if (!r) return 0;
    if (metric === "revenue") return r.total_revenue;
    if (metric === "completion") return r.scheme_completion_pct;
    if (metric === "incentive") return r.total_incentive;
    return r.dealer_count;
  };

  const regionKeys: RegionKey[] = ["north", "south", "east", "west", "central"];
  const maxValue = Math.max(...regionKeys.map(k => getMetricValue(regions[k])));

  // Pick a representative label position for each region (average of state centroids)
  const regionLabelPos = useMemo(() => {
    const acc: Record<RegionKey, { x: number; y: number; n: number }> = {
      north: { x: 0, y: 0, n: 0 },
      south: { x: 0, y: 0, n: 0 },
      east: { x: 0, y: 0, n: 0 },
      west: { x: 0, y: 0, n: 0 },
      central: { x: 0, y: 0, n: 0 },
    };
    for (const s of STATE_SHAPES) {
      if (!s.region) continue;
      acc[s.region].x += s.centroid[0];
      acc[s.region].y += s.centroid[1];
      acc[s.region].n += 1;
    }
    const out = {} as Record<RegionKey, { x: number; y: number }>;
    for (const k of regionKeys) {
      const a = acc[k];
      out[k] = a.n ? { x: a.x / a.n, y: a.y / a.n } : { x: 0, y: 0 };
    }
    return out;
  }, []);

  const saveComment = async () => {
    if (!selected || !newComment.trim()) return;
    const res = await fetch("/api/territory/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: selected, comment: newComment, author_name: "Admin" }),
    });
    const saved = await res.json();
    setComments([saved, ...comments]);
    setNewComment("");
  };

  const regionComments = selected ? comments.filter(c => c.region === selected) : [];
  const selectedData = selected ? regions[selected] : null;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Territory Heat Map</h1>
        <p className="text-gray-500">Visualize performance across India&apos;s regions. Click any state to drill into its region.</p>
      </div>

      {/* Metric selector */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(METRIC_LABEL) as Metric[]).map(m => (
          <button key={m} onClick={() => setMetric(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${metric === m ? "bg-blue-600 text-white shadow-lg" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* SVG India Map */}
        <div className="col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto">
            {/* States */}
            {STATE_SHAPES.map(s => {
              const region = s.region;
              const data = region ? regions[region] : undefined;
              const value = getMetricValue(data);
              const fill = region ? getHeatColor(value, maxValue) : "#f3f4f6";
              const isSelectedRegion = region !== null && selected === region;
              const isHoverRegion = region !== null && hoverRegion === region;
              return (
                <path
                  key={s.id}
                  d={s.d}
                  fill={fill}
                  stroke={isSelectedRegion ? "#1e3a5f" : "#ffffff"}
                  strokeWidth={isSelectedRegion ? 1.5 : 0.6}
                  className={region ? "cursor-pointer transition-all" : ""}
                  style={{
                    opacity: isHoverRegion && !isSelectedRegion ? 0.85 : 1,
                    filter: isSelectedRegion ? "brightness(1.05)" : undefined,
                  }}
                  onClick={() => region && setSelected(region)}
                  onMouseEnter={() => setHoverRegion(region)}
                  onMouseLeave={() => setHoverRegion(null)}
                >
                  <title>{s.name}{region ? ` • ${region}` : ""}</title>
                </path>
              );
            })}

            {/* Region labels overlay */}
            {regionKeys.map(key => {
              const pos = regionLabelPos[key];
              if (!pos || (pos.x === 0 && pos.y === 0)) return null;
              const data = regions[key];
              const value = getMetricValue(data);
              const label =
                metric === "revenue" || metric === "incentive"
                  ? `₹${(value / 100000).toFixed(1)}L`
                  : metric === "completion"
                    ? `${value}%`
                    : `${value}`;
              return (
                <g key={key} pointerEvents="none">
                  <rect
                    x={pos.x - 38}
                    y={pos.y - 18}
                    width={76}
                    height={34}
                    rx={6}
                    fill="rgba(15, 23, 42, 0.72)"
                  />
                  <text
                    x={pos.x}
                    y={pos.y - 4}
                    textAnchor="middle"
                    className="fill-white font-bold uppercase tracking-wide"
                    style={{ fontSize: 10 }}
                  >
                    {key}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 10}
                    textAnchor="middle"
                    className="fill-white"
                    style={{ fontSize: 10 }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-4 text-xs text-gray-600">
            <span>Low</span>
            <div className="flex">
              {["#84cc16", "#eab308", "#f59e0b", "#ea580c", "#dc2626"].map(c => (
                <div key={c} style={{ background: c }} className="w-8 h-3"></div>
              ))}
            </div>
            <span>High</span>
            <span className="ml-auto text-gray-400">States colored by region</span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="space-y-3">
          {regionKeys.map(key => {
            const data = regions[key];
            const value = getMetricValue(data);
            return (
              <button key={key} onClick={() => setSelected(key)}
                className={`w-full text-left rounded-2xl p-4 transition-all ${selected === key ? "bg-blue-600 text-white shadow-lg" : "bg-white hover:shadow-md border border-gray-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold uppercase tracking-wide text-sm">{key}</span>
                  <span className="text-xs opacity-75">{data?.dealer_count || 0} dealers</span>
                </div>
                <div className="text-2xl font-black">
                  {metric === "revenue" || metric === "incentive"
                    ? `₹${(value / 100000).toFixed(1)}L`
                    : metric === "completion"
                      ? `${value}%`
                      : value}
                </div>
                <div className="text-xs opacity-75 mt-1">{METRIC_LABEL[metric]}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Drill-down */}
      {selected && selectedData && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold capitalize">{selected} Region</h2>
              <p className="text-sm text-gray-500">{selectedData.dealer_count} dealers • {selectedData.invoice_count} invoices</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="text-xs text-blue-600 uppercase tracking-wider">Revenue</div>
              <div className="text-2xl font-black text-blue-900">₹{(selectedData.total_revenue / 100000).toFixed(1)}L</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <div className="text-xs text-green-600 uppercase tracking-wider">Scheme Completion</div>
              <div className="text-2xl font-black text-green-900">{selectedData.scheme_completion_pct}%</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
              <div className="text-xs text-orange-600 uppercase tracking-wider">Incentive Paid</div>
              <div className="text-2xl font-black text-orange-900">₹{(selectedData.total_incentive / 1000).toFixed(1)}K</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
              <div className="text-xs text-purple-600 uppercase tracking-wider">Avg per Dealer</div>
              <div className="text-2xl font-black text-purple-900">
                ₹{selectedData.dealer_count ? (selectedData.total_revenue / selectedData.dealer_count / 100000).toFixed(1) : 0}L
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Top Dealers */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Top Dealers</h3>
              <div className="space-y-2">
                {selectedData.top_dealers.map((d, i) => (
                  <Link key={d.id} href={`/admin/dealers/${d.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 bg-white rounded-full flex items-center justify-center font-bold text-sm text-gray-600">{i + 1}</span>
                      <div>
                        <div className="font-semibold text-sm">{d.name}</div>
                        <div className="text-xs text-gray-500">{d.firm_name} • {d.type}</div>
                      </div>
                    </div>
                    <span className="font-bold text-sm">₹{(d.total_purchase / 100000).toFixed(1)}L</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Category chart */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Category Revenue</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={selectedData.category_breakdown.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Territory Comments */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Territory Notes (feed AI scheme builder)</h3>
            <div className="flex gap-2 mb-4">
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                placeholder={`Add observation about ${selected} region...`}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={saveComment}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                Post
              </button>
            </div>
            <div className="space-y-2">
              {regionComments.map(c => (
                <div key={c.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span className="font-semibold">{c.author_name}</span>
                    <span>{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-gray-800">{c.comment}</div>
                </div>
              ))}
              {regionComments.length === 0 && <div className="text-sm text-gray-400 italic">No notes yet for this region</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

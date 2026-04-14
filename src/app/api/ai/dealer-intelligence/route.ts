import { NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { getDealerFull, getDealerMonthlyTrends, getDealerCategoryBreakdown, getDealerSchemeProgress, getDealerNotes } from '@/lib/dealer-analytics';
import { callAI, extractJSON } from '@/lib/ai-helpers';

export async function POST(req: Request) {
  const { dealer_id } = await req.json();
  if (!dealer_id) return NextResponse.json({ error: 'dealer_id required' }, { status: 400 });

  // Check cache
  const cached = await getOne(
    'SELECT * FROM dealer_intelligence_cache WHERE dealer_id = $1 AND expires_at > NOW()',
    [dealer_id]
  );
  if (cached) return NextResponse.json({ ...cached.profile_data, cached: true, model: cached.model_used });

  // Gather data
  const [dealer, trends, categories, schemes, notes] = await Promise.all([
    getDealerFull(dealer_id),
    getDealerMonthlyTrends(dealer_id, 12),
    getDealerCategoryBreakdown(dealer_id),
    getDealerSchemeProgress(dealer_id),
    getDealerNotes(dealer_id),
  ]);

  if (!dealer) return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });

  const totalPurchase = trends.reduce((s: number, t: { revenue: number }) => s + Number(t.revenue), 0);
  const topCats = categories.filter((c: { total_value: number }) => Number(c.total_value) > 0).slice(0, 5);
  const noteSummary = notes.slice(0, 10).map((n: { note_type: string; content: string }) => `[${n.note_type}] ${n.content}`).join('\n');

  const systemPrompt = `You are an expert B2B sales intelligence analyst for Greatwhite Global (electrical products). Analyze the dealer data below and generate a comprehensive intelligence profile.

Return ONLY valid JSON with this structure:
{
  "purchase_trends": {
    "growth_rate_pct": <number, positive=growing>,
    "trend_direction": "growing" | "stable" | "declining",
    "seasonal_patterns": ["<pattern description>"],
    "avg_monthly_revenue": <number>
  },
  "scheme_predictions": [
    { "scheme_name": "<name>", "likelihood_pct": <0-100>, "reasoning": "<why>", "key_gap": "<what's missing>" }
  ],
  "churn_risk": {
    "score": <0-100, 0=no risk>,
    "level": "low" | "medium" | "high" | "critical",
    "signals": ["<signal>"],
    "recommendation": "<what to do>"
  },
  "dealer_dna": {
    "top_categories": ["<category>"],
    "weak_categories": ["<category>"],
    "purchasing_pattern": "bulk_buyer" | "steady_buyer" | "sporadic_buyer" | "seasonal_buyer",
    "behavioral_tags": ["<tag>"],
    "personality_type": "<one-line description>"
  },
  "ai_summary": "<2-3 sentence natural language profile>",
  "recommended_actions": ["<actionable suggestion for sales team>"]
}`;

  const userMessage = `DEALER: ${dealer.name} (${dealer.firm_name})
Type: ${dealer.type} | Region: ${dealer.region} | City: ${dealer.city}, ${dealer.state}
Total Purchase: ₹${totalPurchase.toLocaleString('en-IN')}

MONTHLY REVENUE TREND (last 12 months):
${trends.map((t: { month: string; revenue: number; invoice_count: number }) => `${t.month}: ₹${Number(t.revenue).toLocaleString('en-IN')} (${t.invoice_count} invoices)`).join('\n') || 'No data'}

CATEGORY BREAKDOWN:
${topCats.map((c: { category: string; total_value: number; total_qty: number }) => `${c.category}: ₹${Number(c.total_value).toLocaleString('en-IN')} (${c.total_qty} units)`).join('\n') || 'No purchases'}

ACTIVE SCHEME PROGRESS:
${schemes.map((s: { scheme_name: string; rules: { rule_name: string; progress: number; achieved: boolean }[] }) => {
  const rules = Array.isArray(s.rules) ? s.rules : [];
  return `${s.scheme_name}: ${rules.map((r: { rule_name: string; progress: number; achieved: boolean }) => `${r.rule_name} ${r.achieved ? '✓' : Math.round(r.progress) + '%'}`).join(', ')}`;
}).join('\n') || 'No active schemes'}

SALESPERSON NOTES:
${noteSummary || 'No notes available'}`;

  try {
    const { text, model } = await callAI(systemPrompt, userMessage, { temperature: 0.2, maxTokens: 2048 });
    const profile = extractJSON(text);
    if (!profile) return NextResponse.json({ error: 'AI returned invalid response' }, { status: 500 });

    // Cache
    await query(
      `INSERT INTO dealer_intelligence_cache (dealer_id, profile_data, model_used, generated_at, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '24 hours')
       ON CONFLICT (dealer_id) DO UPDATE SET profile_data=$2, model_used=$3, generated_at=NOW(), expires_at=NOW() + INTERVAL '24 hours'`,
      [dealer_id, JSON.stringify(profile), model]
    );

    return NextResponse.json({ ...profile, cached: false, model });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAll } from '@/lib/db';
import { callAI, extractJSON } from '@/lib/ai-helpers';

export async function POST(req: Request) {
  const body = await req.json();
  const { regions, dealer_types, business_goals, target_categories, scheme_duration, incentive_type, budget_range } = body;

  if (!regions?.length || !business_goals) {
    return NextResponse.json({ error: 'regions and business_goals required' }, { status: 400 });
  }

  try {
    // Fetch applicable dealers with purchase summaries
    const dealers = await getAll(`
      SELECT d.id, d.name, d.firm_name, d.type, d.region, d.city, d.state,
             COALESCE(SUM(i.total_amount), 0)::numeric as total_purchase,
             COUNT(DISTINCT i.id)::int as invoice_count
      FROM dealers d
      LEFT JOIN invoices i ON i.dealer_id = d.id AND i.status = 'confirmed'
      WHERE d.is_active = true
        AND d.region = ANY($1::text[])
        AND d.type = ANY($2::text[])
      GROUP BY d.id, d.name, d.firm_name, d.type, d.region, d.city, d.state
      ORDER BY total_purchase DESC`,
      [regions, dealer_types]);

    // Category breakdown per dealer (top dealers only to save tokens)
    const topDealerIds = dealers.slice(0, 30).map((d: { id: number }) => d.id);
    const dealerCategories = topDealerIds.length > 0 ? await getAll(`
      SELECT i.dealer_id, sc.name as category, sc.id as category_id,
             COALESCE(SUM(ii.total_price), 0)::numeric as value,
             COALESCE(SUM(ii.quantity), 0)::int as qty
      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
      JOIN skus s ON s.id = ii.sku_id
      JOIN sku_categories sc ON sc.id = s.category_id
      WHERE i.dealer_id = ANY($1::int[]) AND i.status = 'confirmed'
      GROUP BY i.dealer_id, sc.name, sc.id`,
      [topDealerIds]) : [];

    // Salesperson notes for these dealers
    const notes = topDealerIds.length > 0 ? await getAll(`
      SELECT dn.dealer_id, d.name as dealer_name, dn.content, dn.note_type
      FROM dealer_notes dn
      JOIN dealers d ON d.id = dn.dealer_id
      WHERE dn.dealer_id = ANY($1::int[])
      ORDER BY dn.created_at DESC`,
      [topDealerIds]) : [];

    // Territory comments
    const territoryComments = await getAll(
      'SELECT * FROM territory_comments WHERE region = ANY($1::text[]) ORDER BY created_at DESC LIMIT 20',
      [regions]);

    // SKU categories
    const skuCategories = await getAll('SELECT id, name, code FROM sku_categories ORDER BY name');

    // Build dealer summaries
    const dealerSummaries = dealers.slice(0, 30).map((d: Record<string, unknown>) => {
      const cats = dealerCategories
        .filter((c: { dealer_id: number }) => c.dealer_id === d.id)
        .map((c: { category: string; value: number; qty: number }) => `${c.category}: ₹${Number(c.value).toLocaleString('en-IN')}`)
        .join(', ');
      const dNotes = notes
        .filter((n: { dealer_id: number }) => n.dealer_id === d.id)
        .slice(0, 3)
        .map((n: { note_type: string; content: string }) => `[${n.note_type}] ${n.content}`)
        .join('; ');
      return `${d.name} (${d.type}, ${d.city}): ₹${Number(d.total_purchase).toLocaleString('en-IN')} total | ${cats || 'No purchases'} ${dNotes ? `| Notes: ${dNotes}` : ''}`;
    }).join('\n');

    const systemPrompt = `You are an expert B2B incentive scheme designer for Greatwhite Global (electrical products company). Design an optimized incentive scheme based on the admin's business goals, territory data, and individual dealer purchase histories.

Available SKU Categories: ${skuCategories.map((c: { id: number; name: string }) => `${c.id}=${c.name}`).join(', ')}

Return ONLY valid JSON:
{
  "scheme": {
    "name": "<creative scheme name>",
    "description": "<2-3 sentences>",
    "scheme_code": "<short code>",
    "start_date": "${scheme_duration?.start_date || '2026-05-01'}",
    "end_date": "${scheme_duration?.end_date || '2026-07-31'}",
    "applicable_regions": ${JSON.stringify(regions)},
    "applicable_dealer_types": ${JSON.stringify(dealer_types)},
    "incentive_type": "${incentive_type || 'credit_note'}",
    "rules": [
      {
        "rule_name": "<name>",
        "sku_category_id": <number or null>,
        "condition_type": "value" | "quantity",
        "min_threshold": <number calibrated to dealer data>,
        "incentive_calc_type": "percentage" | "per_unit" | "fixed" | "slab",
        "incentive_value": <number>,
        "is_additional": false,
        "apply_on": "total" | "all" | "above_threshold",
        "description": "<what dealer needs to do>",
        "slabs": [{"slab_from": <n>, "slab_to": <n|null>, "incentive_calc_type": "percentage"|"per_unit", "incentive_value": <n>}]
      }
    ],
    "bonus_rules": [
      {
        "bonus_name": "<name>",
        "required_rule_indices": [0, 1],
        "bonus_calc_type": "percentage" | "fixed" | "per_unit",
        "bonus_value": <number>,
        "apply_on": "total_purchase" | "total_incentive",
        "description": "<condition>"
      }
    ]
  },
  "personalization_notes": "<explain why thresholds were set this way based on dealer data>",
  "dealer_calibrations": [
    { "dealer_name": "<name>", "expected_to_qualify": true|false, "likelihood_pct": <0-100>, "reasoning": "<why>" }
  ],
  "roi_projection": {
    "total_expected_cost": <number>,
    "total_expected_revenue_uplift": <number>,
    "roi_pct": <number>,
    "dealers_likely_qualifying": <count>,
    "dealers_stretch_targets": <count>
  }
}`;

    const userMessage = `BUSINESS GOALS: ${business_goals}
${budget_range ? `BUDGET RANGE: ₹${budget_range.min?.toLocaleString('en-IN')} - ₹${budget_range.max?.toLocaleString('en-IN')}` : ''}
${target_categories?.length ? `FOCUS CATEGORIES: ${target_categories.join(', ')}` : ''}

TERRITORY CONTEXT (${regions.join(', ')}):
${territoryComments.map((c: { region: string; comment: string; author_name: string }) => `[${c.region}] ${c.author_name}: ${c.comment}`).join('\n') || 'No territory comments yet'}

DEALERS (${dealers.length} total, showing top ${Math.min(dealers.length, 30)}):
${dealerSummaries}`;

    const { text, model } = await callAI(systemPrompt, userMessage, { temperature: 0.3, maxTokens: 4096 });
    const result = extractJSON(text);
    if (!result) return NextResponse.json({ error: 'AI returned invalid response', raw: text.slice(0, 500) }, { status: 500 });

    return NextResponse.json({ ...result, model, dealer_count: dealers.length });
  } catch (e) {
    console.error('AI build-scheme error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

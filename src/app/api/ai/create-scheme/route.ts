import { NextRequest, NextResponse } from 'next/server';
import { getAll } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const categories = await getAll('SELECT id, name, code FROM sku_categories ORDER BY id');
    const skus = await getAll('SELECT id, name, code, category_id, unit_price FROM skus ORDER BY id');
    const regions = ['north', 'south', 'east', 'west', 'central'];
    const dealerTypes = ['distributor', 'retailer', 'sub_dealer', 'project_dealer', 'wholesaler'];

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    const systemPrompt = `You are a Dealer Scheme Designer for Greatwhite Global (electrical products company).
Your job is to convert natural language scheme descriptions into structured JSON scheme objects.

Available SKU Categories:
${JSON.stringify(categories, null, 2)}

Available SKUs:
${JSON.stringify(skus, null, 2)}

Available Regions: ${JSON.stringify(regions)}
Available Dealer Types: ${JSON.stringify(dealerTypes)}
Incentive Types: gift, voucher, credit_note

IMPORTANT RULES:
1. A scheme has rules (conditions to meet) and optional bonus_rules (triggered when multiple rules are achieved)
2. condition_type is either "value" (rupee amount) or "quantity" (number of units)
3. incentive_calc_type can be: "percentage", "per_unit", "fixed", or "slab"
4. For slab-based rules, include a "slabs" array with slab_from, slab_to (null for unlimited), incentive_calc_type, incentive_value
5. apply_on can be: "all" (on entire quantity/value), "above_threshold" (only on amount above min), "total" (on total value)
6. is_additional=true means this rule's incentive stacks on top of other rules
7. If the scheme effective date is before today, set is_backdated=true
8. Generate a unique scheme_code
9. The calculation_logic field should explain in plain English how the scheme works

Return ONLY valid JSON with this structure:
{
  "name": "scheme name",
  "description": "brief description",
  "scheme_code": "SCH-XXX-2026",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "status": "active",
  "applicable_regions": ["north",...],
  "applicable_dealer_types": ["distributor",...],
  "incentive_type": "credit_note|voucher|gift",
  "is_backdated": false,
  "calculation_logic": "plain english explanation",
  "notes": "any additional notes",
  "rules": [
    {
      "rule_name": "rule name",
      "sku_category_id": number or null,
      "sku_id": number or null,
      "condition_type": "value|quantity",
      "min_threshold": number,
      "max_threshold": number or null,
      "incentive_calc_type": "percentage|per_unit|fixed|slab",
      "incentive_value": number (0 for slab type),
      "is_additional": false,
      "apply_on": "all|above_threshold|total",
      "description": "plain english rule description",
      "slabs": [{"slab_from": 0, "slab_to": 100000, "incentive_calc_type": "percentage", "incentive_value": 1}]
    }
  ],
  "bonus_rules": [
    {
      "bonus_name": "bonus name",
      "required_rule_indices": [0, 1],
      "bonus_calc_type": "percentage|per_unit|fixed",
      "bonus_value": number,
      "apply_on": "total_purchase|total_incentive",
      "description": "plain english bonus description"
    }
  ]
}`;

    let text = '';
    let modelUsed = '';

    // Try Anthropic first, fallback to OpenAI
    if (anthropicKey && anthropicKey !== 'your-anthropic-api-key-here') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (response.ok) {
        const aiResult = await response.json();
        text = aiResult.content[0]?.text || '';
        modelUsed = 'claude-sonnet-4-20250514';
      }
    }

    // Fallback to OpenAI
    if (!text && openaiKey && openaiKey !== 'your-openai-api-key-here') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json({ error: `OpenAI API error: ${err}` }, { status: 500 });
      }

      const aiResult = await response.json();
      text = aiResult.choices?.[0]?.message?.content || '';
      modelUsed = 'gpt-4o';
    }

    if (!text) {
      return NextResponse.json({ error: 'No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local' }, { status: 500 });
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response', raw: text }, { status: 500 });
    }

    const schemeData = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      scheme: schemeData,
      ai_response: text,
      model: modelUsed,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

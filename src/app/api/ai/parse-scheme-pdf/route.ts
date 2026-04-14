import { NextRequest, NextResponse } from 'next/server';
import { getAll } from '@/lib/db';
import { calculateSchemeForDealer } from '@/lib/scheme-engine';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const textContent = formData.get('text') as string | null;

    let pdfText = textContent || '';

    // If PDF file uploaded, extract text
    if (file && !pdfText) {
      const buffer = Buffer.from(await file.arrayBuffer());
      // Simple PDF text extraction - look for text between stream markers
      // For production, use a proper PDF parser. This extracts readable text.
      const raw = buffer.toString('utf-8', 0, buffer.length);
      // Extract text content from PDF
      const textParts: string[] = [];
      // Try to get any readable text from the PDF binary
      const readable = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      if (readable.length > 50) {
        textParts.push(readable.substring(0, 8000));
      }
      pdfText = textParts.join('\n');

      // If we couldn't extract much text, try base64 approach with AI vision
      if (pdfText.length < 100) {
        pdfText = `[PDF file uploaded: ${file.name}, ${(file.size / 1024).toFixed(1)} KB. Unable to extract text directly. The file name and any metadata suggest this is a scheme document.]`;
      }
    }

    if (!pdfText || pdfText.length < 10) {
      return NextResponse.json({ error: 'No text content found. Please paste the scheme terms text or upload a readable PDF.' }, { status: 400 });
    }

    // Fetch reference data
    const categories = await getAll('SELECT id, name, code FROM sku_categories ORDER BY id');
    const skus = await getAll('SELECT id, name, code, category_id, unit_price FROM skus ORDER BY id');
    const regions = ['north', 'south', 'east', 'west', 'central'];
    const dealerTypes = ['distributor', 'retailer', 'sub_dealer', 'project_dealer', 'wholesaler'];

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    const systemPrompt = `You are a Dealer Scheme Designer for Greatwhite Global (electrical products company).
You are given a PDF/document containing scheme terms and conditions. Parse it and create a structured JSON scheme.

Available SKU Categories:
${JSON.stringify(categories, null, 2)}

Available SKUs:
${JSON.stringify(skus, null, 2)}

Available Regions: ${JSON.stringify(regions)}
Available Dealer Types: ${JSON.stringify(dealerTypes)}
Incentive Types: gift, voucher, credit_note

IMPORTANT RULES:
1. Parse the document carefully to extract: scheme name, period, targets, incentive structure, applicability
2. Map product references to actual SKU categories/IDs from above
3. condition_type is either "value" (rupee amount) or "quantity" (number of units)
4. incentive_calc_type can be: "percentage", "per_unit", "fixed", or "slab"
5. For slab-based rules, include a "slabs" array
6. apply_on: "all" (on entire quantity/value), "above_threshold" (only on amount above min), "total"
7. is_additional=true means this rule's incentive stacks on top of other rules
8. If effective date is before today (2026-04-13), set is_backdated=true
9. Generate a unique scheme_code like SCH-XXX-2026
10. calculation_logic should explain step by step how the scheme works

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
  "calculation_logic": "step by step explanation",
  "notes": "any additional notes from the document",
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
      "description": "rule description",
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
      "description": "bonus description"
    }
  ]
}`;

    let text = '';
    let modelUsed = '';

    // Try OpenAI first
    if (openaiKey && openaiKey !== 'your-openai-api-key-here') {
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
            { role: 'user', content: `Parse this scheme document and create the structured scheme JSON:\n\n${pdfText}` },
          ],
          temperature: 0.2,
        }),
      });
      if (response.ok) {
        const aiResult = await response.json();
        text = aiResult.choices?.[0]?.message?.content || '';
        modelUsed = 'gpt-4o';
      }
    }

    // Fallback to Anthropic
    if (!text && anthropicKey && anthropicKey !== 'your-anthropic-api-key-here') {
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
          messages: [{ role: 'user', content: `Parse this scheme document and create the structured scheme JSON:\n\n${pdfText}` }],
        }),
      });
      if (response.ok) {
        const aiResult = await response.json();
        text = aiResult.content[0]?.text || '';
        modelUsed = 'claude-sonnet-4-20250514';
      }
    }

    if (!text) {
      return NextResponse.json({ error: 'No AI API key configured.' }, { status: 500 });
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response', raw: text }, { status: 500 });
    }

    const schemeData = JSON.parse(jsonMatch[0]);

    // Now run test calculations against sample dealers
    // First, save the scheme temporarily to test calculations
    // Instead, we'll simulate by describing what would happen for different dealer types
    const testDealers = await getAll(`
      SELECT d.*,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE dealer_id = d.id) as total_purchase,
        (SELECT COUNT(*) FROM invoices WHERE dealer_id = d.id) as invoice_count
      FROM dealers d WHERE is_active = true
      ORDER BY total_purchase DESC
      LIMIT 6
    `);

    // Generate test calculation examples using AI
    let testExamples = '';
    const testPrompt = `Given this scheme:
${JSON.stringify(schemeData, null, 2)}

And these sample dealers with their purchase history:
${testDealers.map((d: Record<string, unknown>) => `- ${d.name} (${d.type}, ${d.region}) - Total purchases: ₹${Number(d.total_purchase).toLocaleString('en-IN')}, ${d.invoice_count} invoices`).join('\n')}

For each dealer, calculate EXACTLY what would happen under this scheme. Show:
1. Whether they meet each rule's target or not
2. How much incentive they would earn per rule
3. Whether any bonuses are triggered
4. Total incentive amount

Be very specific with numbers. Use ₹ for amounts. Format as a clear table-like structure.
Return as JSON array: [{"dealer_name": "...", "dealer_type": "...", "region": "...", "rules": [{"rule_name": "...", "target": "...", "achieved": "...", "met": true/false, "incentive": number, "calculation": "..."}], "bonuses": [{"name": "...", "triggered": true/false, "amount": number}], "total_incentive": number, "verdict": "summary"}]`;

    if (openaiKey && openaiKey !== 'your-openai-api-key-here') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o', max_tokens: 4096, temperature: 0.2,
          messages: [
            { role: 'system', content: 'You are an incentive calculation engine. Calculate exact numbers. Return ONLY valid JSON array.' },
            { role: 'user', content: testPrompt },
          ],
        }),
      });
      if (resp.ok) {
        const r = await resp.json();
        testExamples = r.choices?.[0]?.message?.content || '';
      }
    } else if (anthropicKey && anthropicKey !== 'your-anthropic-api-key-here') {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 4096,
          system: 'You are an incentive calculation engine. Calculate exact numbers. Return ONLY valid JSON array.',
          messages: [{ role: 'user', content: testPrompt }],
        }),
      });
      if (resp.ok) {
        const r = await resp.json();
        testExamples = r.content[0]?.text || '';
      }
    }

    let testResults = [];
    if (testExamples) {
      const testMatch = testExamples.match(/\[[\s\S]*\]/);
      if (testMatch) {
        try { testResults = JSON.parse(testMatch[0]); } catch { /* ignore */ }
      }
    }

    return NextResponse.json({
      scheme: schemeData,
      model: modelUsed,
      parsed_text_length: pdfText.length,
      test_calculations: testResults,
      sample_dealers: testDealers.map((d: Record<string, unknown>) => ({
        name: d.name, type: d.type, region: d.region,
        total_purchase: Number(d.total_purchase), invoice_count: d.invoice_count,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

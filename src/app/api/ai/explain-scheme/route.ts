import { NextRequest, NextResponse } from 'next/server';
import { calculateSchemeForDealer, SchemeCalculationResult } from '@/lib/scheme-engine';
import { getAll, getOne } from '@/lib/db';

function formatMockExplanation(result: SchemeCalculationResult): {
  english_explanation: string;
  hindi_explanation: string;
  calculation_summary: Record<string, unknown>;
} {
  const rulesSection = result.rules
    .map((r, i) => {
      const status = r.target_met ? 'ACHIEVED' : `${r.progress_percentage.toFixed(1)}% complete`;
      const invoiceList = r.matching_invoices
        .map((inv) => `  - ${inv.invoice_number} (${inv.invoice_date}): ${inv.sku_name} x${inv.quantity} = Rs.${inv.value.toLocaleString('en-IN')}`)
        .join('\n');
      return `Rule ${i + 1}: ${r.rule_name}
  Status: ${status}
  Target: ${r.condition_type === 'value' ? 'Rs.' + r.target.toLocaleString('en-IN') : r.target + ' units'}
  Achieved: Value Rs.${r.achieved_value.toLocaleString('en-IN')}, Quantity ${r.achieved_quantity} units
  Incentive: Rs.${r.incentive_earned.toLocaleString('en-IN')}
  Calculation: ${r.incentive_breakdown}
  Contributing Invoices:
${invoiceList || '  (none)'}`;
    })
    .join('\n\n');

  const bonusSection = result.bonuses.length > 0
    ? result.bonuses
        .map((b) => `Bonus: ${b.bonus_name} - ${b.achieved ? 'EARNED' : 'NOT YET'} - Rs.${b.bonus_earned.toLocaleString('en-IN')}\n  ${b.breakdown}`)
        .join('\n')
    : 'No bonus rules for this scheme.';

  const english_explanation = `SCHEME: ${result.scheme_name}
Dealer: ${result.dealer_name}
Period: ${result.period.start} to ${result.period.end}
${result.is_backdated ? '(Backdated scheme - includes past invoices)\n' : ''}
--- RULES ---
${rulesSection}

--- BONUSES ---
${bonusSection}

--- TOTAL ---
Total Incentive Earned: Rs.${result.total_incentive.toLocaleString('en-IN')} (${result.incentive_type})

--- TIPS TO EARN MORE ---
${result.rules
  .filter((r) => !r.target_met)
  .map((r) => {
    const remaining = r.condition_type === 'value'
      ? `Rs.${(r.target - r.achieved_value).toLocaleString('en-IN')} more in purchases`
      : `${r.target - r.achieved_quantity} more units`;
    return `- ${r.rule_name}: Purchase ${remaining} to unlock this incentive.`;
  })
  .join('\n') || '- All targets met! Great job.'}
${result.bonuses
  .filter((b) => !b.achieved)
  .map((b) => `- ${b.bonus_name}: Achieve all required rules (${b.rules_required.length - b.rules_met.length} remaining) to earn the bonus.`)
  .join('\n') || ''}`;

  const hindi_explanation = `YOJANA: ${result.scheme_name}
Dealer: ${result.dealer_name}
Avadhi: ${result.period.start} se ${result.period.end}
${result.is_backdated ? '(Pichhli tarikh ki yojana - purane invoice shamil hain)\n' : ''}
--- NIYAM ---
${result.rules
  .map((r, i) => {
    const status = r.target_met ? 'PRAPT' : `${r.progress_percentage.toFixed(1)}% poora`;
    return `Niyam ${i + 1}: ${r.rule_name}
  Sthiti: ${status}
  Lakshya: ${r.condition_type === 'value' ? 'Rs.' + r.target.toLocaleString('en-IN') : r.target + ' unit'}
  Prapt: Rs.${r.achieved_value.toLocaleString('en-IN')}, ${r.achieved_quantity} unit
  Protsahan: Rs.${r.incentive_earned.toLocaleString('en-IN')}
  Ganana: ${r.incentive_breakdown}`;
  })
  .join('\n\n')}

--- BONUS ---
${result.bonuses.length > 0
  ? result.bonuses
      .map((b) => `${b.bonus_name}: ${b.achieved ? 'MILA' : 'ABHI NAHI'} - Rs.${b.bonus_earned.toLocaleString('en-IN')}`)
      .join('\n')
  : 'Is yojana mein koi bonus niyam nahi hai.'}

--- KULL ---
Kull Protsahan: Rs.${result.total_incentive.toLocaleString('en-IN')} (${result.incentive_type})

--- ADHIK KAMANE KE TIPS ---
${result.rules
  .filter((r) => !r.target_met)
  .map((r) => {
    const remaining = r.condition_type === 'value'
      ? `Rs.${(r.target - r.achieved_value).toLocaleString('en-IN')} aur kharidari`
      : `${r.target - r.achieved_quantity} aur unit`;
    return `- ${r.rule_name}: ${remaining} karein aur yeh protsahan paayein.`;
  })
  .join('\n') || '- Sabhi lakshya poore! Bahut badhiya.'}`;

  const calculation_summary = {
    scheme_name: result.scheme_name,
    dealer_name: result.dealer_name,
    period: result.period,
    total_incentive: result.total_incentive,
    incentive_type: result.incentive_type,
    rules_summary: result.rules.map((r) => ({
      rule_name: r.rule_name,
      target_met: r.target_met,
      progress: r.progress_percentage,
      incentive_earned: r.incentive_earned,
    })),
    bonuses_summary: result.bonuses.map((b) => ({
      bonus_name: b.bonus_name,
      achieved: b.achieved,
      bonus_earned: b.bonus_earned,
    })),
    total_invoices: result.rules.reduce((sum, r) => sum + r.matching_invoices.length, 0),
  };

  return { english_explanation, hindi_explanation, calculation_summary };
}

export async function POST(req: NextRequest) {
  try {
    const { scheme_id, dealer_id } = await req.json();

    if (!scheme_id || !dealer_id) {
      return NextResponse.json(
        { error: 'scheme_id and dealer_id are required' },
        { status: 400 }
      );
    }

    // Calculate scheme for dealer
    let result: SchemeCalculationResult;
    try {
      result = await calculateSchemeForDealer(scheme_id, dealer_id);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 404 });
    }

    // Fetch scheme details for extra context
    const scheme = await getOne('SELECT * FROM schemes WHERE id = $1', [scheme_id]);
    const rules = await getAll(
      'SELECT * FROM scheme_rules WHERE scheme_id = $1 ORDER BY rule_order',
      [scheme_id]
    );
    const slabs = await getAll(
      `SELECT ss.* FROM scheme_slabs ss
       JOIN scheme_rules sr ON ss.rule_id = sr.id
       WHERE sr.scheme_id = $1 ORDER BY ss.slab_from`,
      [scheme_id]
    );
    const bonusRules = await getAll(
      'SELECT * FROM scheme_bonus_rules WHERE scheme_id = $1',
      [scheme_id]
    );

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // Build context
    const schemeContext = JSON.stringify(
      {
        scheme: {
          name: scheme.name,
          description: scheme.description,
          start_date: scheme.start_date,
          end_date: scheme.end_date,
          incentive_type: scheme.incentive_type,
          is_backdated: scheme.is_backdated,
          calculation_logic: scheme.calculation_logic,
        },
        rules: rules.map((r: Record<string, unknown>) => ({
          rule_name: r.rule_name,
          condition_type: r.condition_type,
          min_threshold: r.min_threshold,
          incentive_calc_type: r.incentive_calc_type,
          incentive_value: r.incentive_value,
          apply_on: r.apply_on,
          description: r.description,
        })),
        slabs,
        bonus_rules: bonusRules,
        calculation_result: result,
      },
      null,
      2
    );

    const systemPrompt = `You are an AI assistant for Greatwhite Global's Dealer Scheme Management system. You help dealers understand their scheme calculations clearly.

You will be given the full scheme details, rules, slabs, bonus rules, and the complete calculation result for a specific dealer.

Your task is to generate TWO explanations - one in English and one in Hindi (using Roman script/Hinglish so it's readable without Devanagari).

Each explanation should cover:
1. What the scheme is and its purpose
2. The scheme period and eligibility
3. What the dealer has achieved so far (progress on each rule)
4. Which invoices contributed to the achievement (mention key invoices)
5. How the incentive was calculated step by step
6. What the dealer can do to earn more (specific actionable advice)

Keep the tone friendly, encouraging, and professional. Use Rs. symbol for amounts. Format numbers in Indian notation (lakhs/crores).

Return your response as JSON with this exact structure:
{
  "english_explanation": "...",
  "hindi_explanation": "..."
}

Return ONLY valid JSON, no markdown code blocks.`;

    const userMessage = `Here is the complete scheme data and calculation result for the dealer:\n\n${schemeContext}\n\nPlease generate the explanation in both English and Hindi.`;

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
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
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
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (response.ok) {
        const aiResult = await response.json();
        text = aiResult.content[0]?.text || '';
        modelUsed = 'claude-sonnet-4-20250514';
      }
    }

    // If no AI available, return mock
    if (!text) {
      const mock = formatMockExplanation(result);
      return NextResponse.json({
        english_explanation: mock.english_explanation,
        hindi_explanation: mock.hindi_explanation,
        calculation_summary: mock.calculation_summary,
        source: 'mock',
      });
    }

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const mock = formatMockExplanation(result);
      return NextResponse.json({
        english_explanation: mock.english_explanation,
        hindi_explanation: mock.hindi_explanation,
        calculation_summary: mock.calculation_summary,
        source: 'mock',
        ai_parse_error: 'Could not parse AI response',
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build calculation summary
    const calculation_summary = {
      scheme_name: result.scheme_name,
      dealer_name: result.dealer_name,
      period: result.period,
      total_incentive: result.total_incentive,
      incentive_type: result.incentive_type,
      rules_summary: result.rules.map((r) => ({
        rule_name: r.rule_name,
        target_met: r.target_met,
        progress: r.progress_percentage,
        incentive_earned: r.incentive_earned,
      })),
      bonuses_summary: result.bonuses.map((b) => ({
        bonus_name: b.bonus_name,
        achieved: b.achieved,
        bonus_earned: b.bonus_earned,
      })),
      total_invoices: result.rules.reduce(
        (sum, r) => sum + r.matching_invoices.length,
        0
      ),
    };

    return NextResponse.json({
      english_explanation: parsed.english_explanation,
      hindi_explanation: parsed.hindi_explanation,
      calculation_summary,
      source: 'ai',
      model: modelUsed,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

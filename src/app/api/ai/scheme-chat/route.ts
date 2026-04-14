import { NextRequest, NextResponse } from 'next/server';
import { calculateSchemeForDealer, SchemeCalculationResult } from '@/lib/scheme-engine';
import { getAll, getOne } from '@/lib/db';

function generateMockResponse(
  message: string,
  result: SchemeCalculationResult
): string {
  const lowerMsg = message.toLowerCase();

  // Detect intent and give a helpful answer from the calculation data
  if (lowerMsg.includes('next slab') || lowerMsg.includes('more do i need') || lowerMsg.includes('kitna aur')) {
    const unmetRules = result.rules.filter((r) => !r.target_met);
    if (unmetRules.length === 0) {
      // Check if any slab-based rules have a higher slab
      const slabRules = result.rules.filter((r) => r.active_slab);
      if (slabRules.length > 0) {
        return slabRules
          .map((r) => {
            if (r.active_slab && r.active_slab.to) {
              const remaining =
                r.condition_type === 'value'
                  ? `Rs.${(r.active_slab.to - r.achieved_value).toLocaleString('en-IN')} more in purchases`
                  : `${r.active_slab.to - r.achieved_quantity} more units`;
              return `For "${r.rule_name}": You need ${remaining} to reach the next slab (above ${r.condition_type === 'value' ? 'Rs.' + r.active_slab.to.toLocaleString('en-IN') : r.active_slab.to + ' units'}).`;
            }
            return `For "${r.rule_name}": You are already in the highest slab!`;
          })
          .join('\n');
      }
      return 'You have already achieved all targets in this scheme. Great job!';
    }
    return unmetRules
      .map((r) => {
        const remaining =
          r.condition_type === 'value'
            ? `Rs.${(r.target - r.achieved_value).toLocaleString('en-IN')} more in purchases`
            : `${r.target - r.achieved_quantity} more units`;
        return `For "${r.rule_name}": You need ${remaining} to reach the target of ${r.condition_type === 'value' ? 'Rs.' + r.target.toLocaleString('en-IN') : r.target + ' units'}. You are at ${r.progress_percentage.toFixed(1)}%.`;
      })
      .join('\n');
  }

  if (lowerMsg.includes('incentive') || lowerMsg.includes('earned') || lowerMsg.includes('kitna mila') || lowerMsg.includes('how much')) {
    return `Your total incentive earned so far: Rs.${result.total_incentive.toLocaleString('en-IN')} (${result.incentive_type}).\n\nBreakdown:\n${result.rules
      .map((r) => `- ${r.rule_name}: Rs.${r.incentive_earned.toLocaleString('en-IN')} (${r.incentive_breakdown})`)
      .join('\n')}${result.bonuses.length > 0 ? '\n\nBonuses:\n' + result.bonuses.map((b) => `- ${b.bonus_name}: Rs.${b.bonus_earned.toLocaleString('en-IN')} (${b.breakdown})`).join('\n') : ''}`;
  }

  if (lowerMsg.includes('invoice') || lowerMsg.includes('bill')) {
    const allInvoices = result.rules.flatMap((r) => r.matching_invoices);
    const uniqueInvoices = Array.from(new Map(allInvoices.map((inv) => [inv.invoice_number, inv])).values());
    if (uniqueInvoices.length === 0) {
      return 'No invoices have been matched to this scheme yet. Make purchases in the eligible categories to start earning incentives.';
    }
    return `${uniqueInvoices.length} invoices are contributing to this scheme:\n${uniqueInvoices
      .map((inv) => `- ${inv.invoice_number} (${inv.invoice_date}): ${inv.sku_name} x${inv.quantity} = Rs.${inv.value.toLocaleString('en-IN')}`)
      .join('\n')}\n\nTotal value: Rs.${uniqueInvoices.reduce((s, i) => s + i.value, 0).toLocaleString('en-IN')}`;
  }

  if (lowerMsg.includes('progress') || lowerMsg.includes('status') || lowerMsg.includes('kahan')) {
    return `Scheme: ${result.scheme_name}\nPeriod: ${result.period.start} to ${result.period.end}\n\n${result.rules
      .map(
        (r) =>
          `${r.rule_name}: ${r.target_met ? 'TARGET MET' : r.progress_percentage.toFixed(1) + '% complete'} (${r.condition_type === 'value' ? 'Rs.' + r.achieved_value.toLocaleString('en-IN') + ' / Rs.' + r.target.toLocaleString('en-IN') : r.achieved_quantity + ' / ' + r.target + ' units'})`
      )
      .join('\n')}\n\nTotal Incentive: Rs.${result.total_incentive.toLocaleString('en-IN')}`;
  }

  if (lowerMsg.includes('bonus') || lowerMsg.includes('extra')) {
    if (result.bonuses.length === 0) {
      return 'This scheme does not have any bonus rules.';
    }
    return `Bonus rules:\n${result.bonuses
      .map((b) => `- ${b.bonus_name}: ${b.achieved ? 'ACHIEVED - Rs.' + b.bonus_earned.toLocaleString('en-IN') : 'NOT YET - ' + b.breakdown}`)
      .join('\n')}`;
  }

  // Default: give a general overview
  return `Scheme: ${result.scheme_name}
Period: ${result.period.start} to ${result.period.end}
Incentive Type: ${result.incentive_type}
Total Incentive Earned: Rs.${result.total_incentive.toLocaleString('en-IN')}

Rules:
${result.rules
  .map(
    (r) =>
      `- ${r.rule_name}: ${r.target_met ? 'Achieved' : r.progress_percentage.toFixed(1) + '% done'} | Incentive: Rs.${r.incentive_earned.toLocaleString('en-IN')}`
  )
  .join('\n')}
${result.bonuses.length > 0 ? '\nBonuses:\n' + result.bonuses.map((b) => `- ${b.bonus_name}: ${b.achieved ? 'Earned Rs.' + b.bonus_earned.toLocaleString('en-IN') : 'Not yet'}`).join('\n') : ''}

Ask me about: your progress, invoices, incentives earned, next slab, or bonuses.`;
}

export async function POST(req: NextRequest) {
  try {
    const { message, scheme_id, dealer_id } = await req.json();

    if (!message || !scheme_id || !dealer_id) {
      return NextResponse.json(
        { error: 'message, scheme_id, and dealer_id are required' },
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

    const systemPrompt = `You are a friendly AI assistant for Greatwhite Global's Dealer Scheme Management system. You help dealers understand their schemes and incentives.

You have access to the full scheme details, rules, slabs, bonus rules, and the complete calculation result for this specific dealer.

Here is the complete data:
${schemeContext}

INSTRUCTIONS:
- Answer the dealer's question accurately based on the data provided
- Be friendly, encouraging, and professional
- Use Rs. for currency amounts and format numbers in Indian notation
- If the dealer asks in Hindi/Hinglish, respond in Hinglish (Roman script Hindi)
- Give specific numbers and actionable advice
- Keep responses concise but complete
- If the question is about how to earn more, give specific actionable steps with exact amounts needed
- Reference specific invoice numbers when relevant
- Explain calculations step by step when asked`;

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
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
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
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
        }),
      });

      if (response.ok) {
        const aiResult = await response.json();
        text = aiResult.content[0]?.text || '';
        modelUsed = 'claude-sonnet-4-20250514';
      }
    }

    // If no AI available, return mock response
    if (!text) {
      const mockResp = generateMockResponse(message, result);
      return NextResponse.json({ response: mockResp, source: 'mock' });
    }

    return NextResponse.json({
      response: text,
      source: 'ai',
      model: modelUsed,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

import { query, getAll, getOne } from './db';

function formatDate(d: unknown): string {
  if (!d) return '';
  const date = new Date(d as string);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

interface InvoiceItem {
  id: number;
  invoice_id: number;
  invoice_number: string;
  invoice_date: string;
  sku_id: number;
  sku_name: string;
  sku_code: string;
  category_id: number;
  category_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SchemeRule {
  id: number;
  scheme_id: number;
  rule_order: number;
  rule_name: string;
  sku_category_id: number | null;
  sku_id: number | null;
  condition_type: 'value' | 'quantity';
  min_threshold: number;
  max_threshold: number | null;
  incentive_calc_type: 'percentage' | 'per_unit' | 'fixed' | 'slab';
  incentive_value: number;
  is_additional: boolean;
  apply_on: 'all' | 'above_threshold' | 'total';
  description: string;
}

interface Slab {
  slab_from: number;
  slab_to: number | null;
  incentive_calc_type: string;
  incentive_value: number;
}

interface BonusRule {
  id: number;
  scheme_id: number;
  bonus_name: string;
  required_rule_ids: number[];
  bonus_calc_type: string;
  bonus_value: number;
  apply_on: string;
  description: string;
  min_threshold?: number;
}

export interface RuleCalculation {
  rule_id: number;
  rule_name: string;
  condition_type: string;
  incentive_calc_type?: string;
  target: number;
  achieved_value: number;
  achieved_quantity: number;
  progress_percentage: number;
  target_met: boolean;
  incentive_earned: number;
  incentive_breakdown: string;
  matching_invoices: {
    invoice_number: string;
    invoice_date: string;
    sku_name: string;
    quantity: number;
    value: number;
  }[];
  active_slab?: { from: number; to: number | null; rate: number; type: string } | null;
  all_slabs?: { from: number; to: number | null; rate: number; type: string; status: 'achieved' | 'current' | 'locked' }[];
}

export interface BonusCalculation {
  bonus_rule_id: number;
  bonus_name: string;
  achieved: boolean;
  rules_required: number[];
  rules_met: number[];
  bonus_earned: number;
  breakdown: string;
}

export interface SchemeCalculationResult {
  scheme_id: number;
  scheme_name: string;
  dealer_id: number;
  dealer_name: string;
  period: { start: string; end: string };
  is_backdated: boolean;
  rules: RuleCalculation[];
  bonuses: BonusCalculation[];
  total_incentive: number;
  incentive_type: string;
  calculated_at: string;
}

/**
 * Core engine: calculates a dealer's progress and incentive for a given scheme.
 * Handles value-based, quantity-based, slab, per-unit, fixed, and combo bonus schemes.
 * Supports backdated schemes by considering all invoices from effective start_date.
 */
export async function calculateSchemeForDealer(
  schemeId: number,
  dealerId: number
): Promise<SchemeCalculationResult> {
  // Get scheme
  const scheme = await getOne('SELECT * FROM schemes WHERE id = $1', [schemeId]);
  if (!scheme) throw new Error(`Scheme ${schemeId} not found`);

  // Get dealer
  const dealer = await getOne('SELECT * FROM dealers WHERE id = $1', [dealerId]);
  if (!dealer) throw new Error(`Dealer ${dealerId} not found`);

  // Check applicability
  const regions = scheme.applicable_regions || [];
  const dealerTypes = scheme.applicable_dealer_types || [];
  if (regions.length > 0 && !regions.includes(dealer.region)) {
    throw new Error(`Dealer region ${dealer.region} not applicable for this scheme`);
  }
  if (dealerTypes.length > 0 && !dealerTypes.includes(dealer.type)) {
    throw new Error(`Dealer type ${dealer.type} not applicable for this scheme`);
  }

  // Get scheme rules
  const rules: SchemeRule[] = await getAll(
    'SELECT * FROM scheme_rules WHERE scheme_id = $1 ORDER BY rule_order',
    [schemeId]
  );

  // Get bonus rules
  const bonusRulesRaw = await getAll(
    'SELECT * FROM scheme_bonus_rules WHERE scheme_id = $1',
    [schemeId]
  );
  const bonusRules: BonusRule[] = bonusRulesRaw.map((b: Record<string, unknown>) => ({
    ...b,
    required_rule_ids: b.required_rule_ids as number[],
  })) as BonusRule[];

  // Get all invoice items for this dealer in the scheme period
  const invoiceItems: InvoiceItem[] = await getAll(
    `SELECT ii.id, ii.invoice_id, i.invoice_number, i.invoice_date,
            ii.sku_id, s.name as sku_name, s.code as sku_code,
            s.category_id, sc.name as category_name,
            ii.quantity, ii.unit_price, ii.total_price
     FROM invoice_items ii
     JOIN invoices i ON ii.invoice_id = i.id
     JOIN skus s ON ii.sku_id = s.id
     JOIN sku_categories sc ON s.category_id = sc.id
     WHERE i.dealer_id = $1
       AND i.invoice_date >= $2
       AND i.invoice_date <= $3
       AND i.status = 'confirmed'
     ORDER BY i.invoice_date`,
    [dealerId, scheme.start_date, scheme.end_date]
  );

  // Calculate each rule
  const ruleResults: RuleCalculation[] = [];
  let totalIncentive = 0;

  for (const rule of rules) {
    const result = await calculateRule(rule, invoiceItems, schemeId);
    ruleResults.push(result);
    totalIncentive += result.incentive_earned;

    // Save progress
    await query(
      `INSERT INTO dealer_scheme_progress (dealer_id, scheme_id, rule_id, current_value, current_quantity, target_achieved, incentive_earned, progress_percentage, last_calculated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (dealer_id, scheme_id, rule_id)
       DO UPDATE SET current_value=$4, current_quantity=$5, target_achieved=$6, incentive_earned=$7, progress_percentage=$8, last_calculated=NOW()`,
      [dealerId, schemeId, rule.id, result.achieved_value, result.achieved_quantity,
       result.target_met, result.incentive_earned, result.progress_percentage]
    );

    // Save invoice mappings in batch
    await query(
      'DELETE FROM scheme_invoice_mapping WHERE dealer_id=$1 AND scheme_id=$2 AND rule_id=$3',
      [dealerId, schemeId, rule.id]
    );
    const mappingItems = result.matching_invoices
      .map(inv => invoiceItems.find(ii => ii.invoice_number === inv.invoice_number && ii.sku_name === inv.sku_name))
      .filter((item): item is InvoiceItem => item !== undefined);
    if (mappingItems.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      mappingItems.forEach((item, idx) => {
        const inv = result.matching_invoices.find(
          i => i.invoice_number === item.invoice_number && i.sku_name === item.sku_name
        )!;
        const offset = idx * 7;
        placeholders.push(`($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7})`);
        values.push(dealerId, schemeId, rule.id, item.invoice_id, item.id, inv.value, inv.quantity);
      });
      await query(
        `INSERT INTO scheme_invoice_mapping (dealer_id, scheme_id, rule_id, invoice_id, invoice_item_id, contributing_value, contributing_quantity)
         VALUES ${placeholders.join(',')}`,
        values
      );
    }
  }

  // Calculate bonuses
  const bonusResults: BonusCalculation[] = [];
  for (const bonus of bonusRules) {
    const requiredIds = bonus.required_rule_ids;
    const metRules = ruleResults.filter(r => requiredIds.includes(r.rule_id) && r.target_met);
    const allRulesMet = metRules.length === requiredIds.length;

    // Check bonus-level min_threshold if set
    const bonusThreshold = Number(bonus.min_threshold || 0);
    let bonusThresholdMet = true;
    if (bonusThreshold > 0) {
      const relevantResults = ruleResults.filter(r => requiredIds.includes(r.rule_id));
      const relevantRuleDefs = rules.filter(r => requiredIds.includes(r.id));
      const condType = relevantRuleDefs.length > 0 ? relevantRuleDefs[0].condition_type : 'quantity';
      if (condType === 'quantity') {
        const totalQty = relevantResults.reduce((s, r) => s + r.achieved_quantity, 0);
        bonusThresholdMet = totalQty >= bonusThreshold;
      } else {
        const totalVal = relevantResults.reduce((s, r) => s + r.achieved_value, 0);
        bonusThresholdMet = totalVal >= bonusThreshold;
      }
    }

    const achieved = allRulesMet && bonusThresholdMet;

    let bonusEarned = 0;
    let breakdown = '';
    if (achieved) {
      const bv = Number(bonus.bonus_value);
      if (bonus.apply_on === 'total_purchase') {
        const totalPurchase = invoiceItems.reduce((sum, ii) => sum + Number(ii.total_price), 0);
        if (bonus.bonus_calc_type === 'percentage') {
          bonusEarned = totalPurchase * (bv / 100);
          breakdown = `${bv}% of total purchase ₹${totalPurchase.toLocaleString('en-IN')} = ₹${bonusEarned.toLocaleString('en-IN')}`;
        } else if (bonus.bonus_calc_type === 'per_unit') {
          const totalQty = invoiceItems.reduce((sum, ii) => sum + ii.quantity, 0);
          bonusEarned = totalQty * bv;
          breakdown = `₹${bv.toLocaleString('en-IN')}/unit × ${totalQty} units = ₹${bonusEarned.toLocaleString('en-IN')}`;
        } else {
          bonusEarned = bv;
          breakdown = `Flat bonus ₹${bv.toLocaleString('en-IN')}`;
        }
      } else if (bonus.apply_on === 'total_incentive') {
        bonusEarned = totalIncentive * (bv / 100);
        breakdown = `${bv}% of total incentive ₹${totalIncentive.toLocaleString('en-IN')}`;
      }
      totalIncentive += bonusEarned;
    } else {
      if (allRulesMet && !bonusThresholdMet) {
        breakdown = `Rules met but bonus threshold not reached (need ${bonusThreshold.toLocaleString('en-IN')})`;
      } else {
        breakdown = `Need ${requiredIds.length} rules, achieved ${metRules.length}`;
      }
    }

    bonusResults.push({
      bonus_rule_id: bonus.id,
      bonus_name: bonus.bonus_name,
      achieved,
      rules_required: requiredIds,
      rules_met: metRules.map(r => r.rule_id),
      bonus_earned: bonusEarned,
      breakdown,
    });

    // Save bonus progress
    await query(
      `INSERT INTO dealer_bonus_progress (dealer_id, scheme_id, bonus_rule_id, achieved, bonus_earned, last_calculated)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (dealer_id, scheme_id, bonus_rule_id)
       DO UPDATE SET achieved=$4, bonus_earned=$5, last_calculated=NOW()`,
      [dealerId, schemeId, bonus.id, achieved, bonusEarned]
    );
  }

  return {
    scheme_id: schemeId,
    scheme_name: scheme.name,
    dealer_id: dealerId,
    dealer_name: dealer.name,
    period: { start: formatDate(scheme.start_date), end: formatDate(scheme.end_date) },
    is_backdated: scheme.is_backdated,
    rules: ruleResults,
    bonuses: bonusResults,
    total_incentive: totalIncentive,
    incentive_type: scheme.incentive_type,
    calculated_at: new Date().toISOString(),
  };
}

async function calculateRule(
  rule: SchemeRule,
  invoiceItems: InvoiceItem[],
  _schemeId: number
): Promise<RuleCalculation> {
  // Filter invoice items matching this rule's criteria
  let matchingItems = invoiceItems;

  if (rule.sku_id) {
    matchingItems = matchingItems.filter(ii => ii.sku_id === rule.sku_id);
  } else if (rule.sku_category_id) {
    matchingItems = matchingItems.filter(ii => ii.category_id === rule.sku_category_id);
  }

  const totalValue = matchingItems.reduce((sum, ii) => sum + Number(ii.total_price), 0);
  const totalQuantity = matchingItems.reduce((sum, ii) => sum + ii.quantity, 0);

  const conditionValue = rule.condition_type === 'value' ? totalValue : totalQuantity;
  const threshold = Number(rule.min_threshold);
  const targetMet = conditionValue >= threshold;
  const progressPct = threshold > 0 ? Math.min((conditionValue / threshold) * 100, 100) : 0;

  let incentiveEarned = 0;
  let breakdown = '';
  let activeSlab = null;

  // For slab-type rules, always load all slabs so UI can show the full ladder
  let allSlabsForUi: { from: number; to: number | null; rate: number; type: string; status: 'achieved' | 'current' | 'locked' }[] | undefined;
  if (rule.incentive_calc_type === 'slab') {
    const slabsForUi: Slab[] = await getAll(
      'SELECT * FROM scheme_slabs WHERE rule_id = $1 ORDER BY slab_from',
      [rule.id]
    );
    allSlabsForUi = slabsForUi.map(s => {
      const from = Number(s.slab_from);
      const to = s.slab_to ? Number(s.slab_to) : null;
      const upper = to ?? Infinity;
      let status: 'achieved' | 'current' | 'locked';
      if (conditionValue >= upper) status = 'achieved';
      else if (conditionValue >= from) status = 'current';
      else status = 'locked';
      return { from, to, rate: Number(s.incentive_value), type: s.incentive_calc_type, status };
    });
  }

  if (targetMet) {
    switch (rule.incentive_calc_type) {
      case 'percentage': {
        const pct = Number(rule.incentive_value);
        if (rule.apply_on === 'total') {
          incentiveEarned = totalValue * (pct / 100);
          breakdown = `${pct}% of ₹${totalValue.toLocaleString('en-IN')} = ₹${incentiveEarned.toLocaleString('en-IN')}`;
        } else if (rule.apply_on === 'above_threshold') {
          const aboveValue = totalValue - threshold;
          incentiveEarned = aboveValue * (pct / 100);
          breakdown = `${pct}% of ₹${aboveValue.toLocaleString('en-IN')} (above threshold) = ₹${incentiveEarned.toLocaleString('en-IN')}`;
        } else {
          incentiveEarned = totalValue * (pct / 100);
          breakdown = `${pct}% of ₹${totalValue.toLocaleString('en-IN')} = ₹${incentiveEarned.toLocaleString('en-IN')}`;
        }
        break;
      }
      case 'per_unit': {
        const perUnit = Number(rule.incentive_value);
        if (rule.apply_on === 'all') {
          incentiveEarned = totalQuantity * perUnit;
          breakdown = `₹${perUnit.toLocaleString('en-IN')}/unit × ${totalQuantity} units = ₹${incentiveEarned.toLocaleString('en-IN')}`;
        } else if (rule.apply_on === 'above_threshold') {
          const aboveQty = totalQuantity - threshold;
          incentiveEarned = aboveQty * perUnit;
          breakdown = `₹${perUnit.toLocaleString('en-IN')}/unit × ${aboveQty} units (above ${threshold}) = ₹${incentiveEarned.toLocaleString('en-IN')}`;
        } else {
          incentiveEarned = totalQuantity * perUnit;
          breakdown = `₹${perUnit.toLocaleString('en-IN')}/unit × ${totalQuantity} units = ₹${incentiveEarned.toLocaleString('en-IN')}`;
        }
        break;
      }
      case 'fixed': {
        incentiveEarned = Number(rule.incentive_value);
        breakdown = `Flat incentive ₹${incentiveEarned.toLocaleString('en-IN')}`;
        break;
      }
      case 'slab': {
        // Reuse slabs already fetched for UI above
        const slabs: Slab[] = allSlabsForUi
          ? allSlabsForUi.map(s => ({ slab_from: s.from, slab_to: s.to, incentive_calc_type: s.type, incentive_value: s.rate }))
          : await getAll('SELECT * FROM scheme_slabs WHERE rule_id = $1 ORDER BY slab_from', [rule.id]);
        // Helper: compute incentive for a given slab configuration
        const applySlab = (slab: Slab, isTop = false) => {
          const from = Number(slab.slab_from);
          activeSlab = { from, to: slab.slab_to ? Number(slab.slab_to) : null, rate: Number(slab.incentive_value), type: slab.incentive_calc_type };
          const prefix = isTop ? `Top Slab: ₹${from.toLocaleString('en-IN')}+` : `Slab: ₹${from.toLocaleString('en-IN')}${slab.slab_to ? ' - ₹' + Number(slab.slab_to).toLocaleString('en-IN') : '+'}`;
          if (slab.incentive_calc_type === 'percentage') {
            incentiveEarned = totalValue * (Number(slab.incentive_value) / 100);
            breakdown = `${prefix} → ${Number(slab.incentive_value)}% of ₹${totalValue.toLocaleString('en-IN')} = ₹${incentiveEarned.toLocaleString('en-IN')}`;
          } else if (slab.incentive_calc_type === 'per_unit') {
            incentiveEarned = totalQuantity * Number(slab.incentive_value);
            breakdown = `${prefix} → ₹${Number(slab.incentive_value).toLocaleString('en-IN')}/unit × ${totalQuantity} = ₹${incentiveEarned.toLocaleString('en-IN')}`;
          } else if (slab.incentive_calc_type === 'fixed') {
            incentiveEarned = Number(slab.incentive_value);
            breakdown = `${prefix} → Flat ₹${incentiveEarned.toLocaleString('en-IN')}`;
          }
        };

        for (const slab of slabs) {
          const from = Number(slab.slab_from);
          const to = slab.slab_to ? Number(slab.slab_to) : Infinity;
          if (conditionValue >= from && conditionValue < to) {
            applySlab(slab);
            break;
          }
        }
        if (!activeSlab && slabs.length > 0) {
          // Above highest slab
          const lastSlab = slabs[slabs.length - 1];
          if (conditionValue >= Number(lastSlab.slab_from)) {
            applySlab(lastSlab, true);
          }
        }
        break;
      }
    }
  } else {
    const remaining = threshold - conditionValue;
    if (rule.condition_type === 'value') {
      breakdown = `Need ₹${remaining.toLocaleString('en-IN')} more to reach target of ₹${threshold.toLocaleString('en-IN')}`;
    } else {
      breakdown = `Need ${remaining} more units to reach target of ${threshold} units`;
    }
  }

  return {
    rule_id: rule.id,
    rule_name: rule.rule_name,
    condition_type: rule.condition_type,
    incentive_calc_type: rule.incentive_calc_type,
    target: threshold,
    achieved_value: totalValue,
    achieved_quantity: totalQuantity,
    progress_percentage: Math.round(progressPct * 100) / 100,
    target_met: targetMet,
    incentive_earned: Math.round(incentiveEarned * 100) / 100,
    incentive_breakdown: breakdown,
    matching_invoices: matchingItems.map(ii => ({
      invoice_number: ii.invoice_number,
      invoice_date: formatDate(ii.invoice_date),
      sku_name: ii.sku_name,
      quantity: ii.quantity,
      value: Number(ii.total_price),
    })),
    active_slab: activeSlab,
    all_slabs: allSlabsForUi,
  };
}

/**
 * Calculate ALL schemes for a given dealer
 */
export async function calculateAllSchemesForDealer(dealerId: number) {
  const dealer = await getOne('SELECT * FROM dealers WHERE id = $1', [dealerId]);
  if (!dealer) throw new Error('Dealer not found');

  const schemes = await getAll(
    `SELECT * FROM schemes WHERE status = 'active'
     AND applicable_regions::jsonb ? $1
     AND applicable_dealer_types::jsonb ? $2`,
    [dealer.region, dealer.type]
  );

  const results: SchemeCalculationResult[] = [];
  for (const scheme of schemes) {
    try {
      const result = await calculateSchemeForDealer(scheme.id, dealerId);
      results.push(result);
    } catch (e) {
      console.error(`Error calculating scheme ${scheme.id} for dealer ${dealerId}:`, e);
    }
  }
  return results;
}

/**
 * Run daily recalculation for ALL active schemes and applicable dealers.
 * This handles backdated schemes - even if scheme was created today with past start_date,
 * all invoices from start_date are considered.
 */
export async function runDailyRecalculation() {
  const activeSchemes = await getAll(
    "SELECT * FROM schemes WHERE status = 'active' AND end_date >= CURRENT_DATE"
  );

  const results = [];
  for (const scheme of activeSchemes) {
    const regions = scheme.applicable_regions || [];
    const types = scheme.applicable_dealer_types || [];

    // Find all applicable dealers
    const dealers = await getAll(
      `SELECT * FROM dealers WHERE is_active = true
       AND region = ANY($1::text[])
       AND type = ANY($2::text[])`,
      [regions, types]
    );

    for (const dealer of dealers) {
      try {
        const logResult = await query(
          `INSERT INTO calculation_logs (scheme_id, dealer_id, calculation_type, started_at, status)
           VALUES ($1, $2, $3, NOW(), 'running') RETURNING id`,
          [scheme.id, dealer.id, scheme.is_backdated ? 'backdated' : 'full']
        );
        const logId = logResult.rows[0].id;

        const calcResult = await calculateSchemeForDealer(scheme.id, dealer.id);

        await query(
          `UPDATE calculation_logs SET completed_at=NOW(), status='completed',
           invoices_processed=$1, total_incentive_calculated=$2 WHERE id=$3`,
          [
            calcResult.rules.reduce((sum, r) => sum + r.matching_invoices.length, 0),
            calcResult.total_incentive,
            logId,
          ]
        );

        results.push(calcResult);
      } catch (e) {
        console.error(`Recalculation error for scheme ${scheme.id}, dealer ${dealer.id}:`, e);
      }
    }
  }

  return results;
}

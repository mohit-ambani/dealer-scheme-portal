/**
 * What-If Simulation Engine
 * Calculates scheme incentives from simulated purchase data without touching the database.
 */

import { getAll, getOne } from './db';

export interface SimulatedPurchase {
  category_id: number;
  category_name?: string;
  sku_id?: number;
  sku_name?: string;
  value: number;
  quantity: number;
}

export interface DealerSimulation {
  dealer_id: number;
  dealer_name: string;
  dealer_type: string;
  region: string;
  purchases: SimulatedPurchase[];
}

export interface SimRuleResult {
  rule_id: number;
  rule_name: string;
  condition_type: string;
  target: number;
  achieved_value: number;
  achieved_quantity: number;
  progress_percentage: number;
  target_met: boolean;
  incentive_earned: number;
  incentive_breakdown: string;
  active_slab?: { from: number; to: number | null; rate: number; type: string } | null;
}

export interface SimBonusResult {
  bonus_name: string;
  achieved: boolean;
  bonus_earned: number;
  breakdown: string;
}

export interface DealerSimResult {
  dealer_id: number;
  dealer_name: string;
  dealer_type: string;
  region: string;
  total_revenue: number;
  total_incentive: number;
  rules: SimRuleResult[];
  bonuses: SimBonusResult[];
  cost_percentage: number; // incentive as % of revenue
}

export interface WhatIfResult {
  scheme_id: number;
  scheme_name: string;
  incentive_type: string;
  dealer_results: DealerSimResult[];
  summary: {
    total_dealers: number;
    dealers_earning: number;
    min_revenue: number;
    max_revenue: number;
    avg_revenue: number;
    total_revenue: number;
    min_cost: number;
    max_cost: number;
    avg_cost: number;
    total_cost: number;
    avg_cost_percentage: number;
  };
}

export async function simulateScheme(
  schemeId: number,
  dealerSimulations: DealerSimulation[]
): Promise<WhatIfResult> {
  const scheme = await getOne('SELECT * FROM schemes WHERE id = $1', [schemeId]);
  if (!scheme) throw new Error('Scheme not found');

  const rules = await getAll(
    'SELECT * FROM scheme_rules WHERE scheme_id = $1 ORDER BY rule_order',
    [schemeId]
  );

  const bonusRules = await getAll(
    'SELECT * FROM scheme_bonus_rules WHERE scheme_id = $1',
    [schemeId]
  );

  // Load slabs for slab-based rules
  const slabsByRule = new Map<number, { slab_from: number; slab_to: number | null; incentive_calc_type: string; incentive_value: number }[]>();
  for (const rule of rules) {
    if (rule.incentive_calc_type === 'slab') {
      const slabs = await getAll(
        'SELECT * FROM scheme_slabs WHERE rule_id = $1 ORDER BY slab_from',
        [rule.id]
      );
      slabsByRule.set(rule.id, slabs);
    }
  }

  // Load all SKUs to map sku_id -> category_id
  const skus = await getAll('SELECT id, category_id FROM skus');
  const skuCategoryMap = new Map<number, number>();
  for (const s of skus) skuCategoryMap.set(s.id, s.category_id);

  const dealerResults: DealerSimResult[] = [];

  for (const sim of dealerSimulations) {
    const ruleResults: SimRuleResult[] = [];
    const ruleAchieved = new Map<number, boolean>();

    for (const rule of rules) {
      // Find matching purchase data for this rule
      let matchValue = 0;
      let matchQty = 0;

      if (rule.sku_id) {
        // First try exact SKU match (if purchases have sku_id)
        const skuMatch = sim.purchases.find(p => p.sku_id === rule.sku_id);
        if (skuMatch) {
          matchValue = skuMatch.value;
          matchQty = skuMatch.quantity;
        }
        // No category fallback — SKU rules only match exact SKU purchases.
        // If no SKU-level input provided, this rule won't fire (prevents over-counting).
      } else if (rule.sku_category_id) {
        const p = sim.purchases.find(p => p.category_id === rule.sku_category_id);
        if (p) { matchValue = p.value; matchQty = p.quantity; }
      } else {
        // All categories
        matchValue = sim.purchases.reduce((s, p) => s + p.value, 0);
        matchQty = sim.purchases.reduce((s, p) => s + p.quantity, 0);
      }

      const conditionValue = rule.condition_type === 'value' ? matchValue : matchQty;
      const target = Number(rule.min_threshold);
      const targetMet = conditionValue >= target;
      const progress = target > 0 ? Math.min((conditionValue / target) * 100, 100) : 0;

      let incentiveEarned = 0;
      let breakdown = '';
      let activeSlab: SimRuleResult['active_slab'] = null;

      if (rule.incentive_calc_type === 'slab') {
        const slabs = slabsByRule.get(rule.id) || [];
        let currentSlab = null;
        for (const slab of slabs) {
          const from = Number(slab.slab_from);
          const to = slab.slab_to ? Number(slab.slab_to) : Infinity;
          if (conditionValue >= from && conditionValue <= to) {
            currentSlab = slab;
          } else if (conditionValue > to) {
            currentSlab = slab; // keep going to find highest applicable
          }
        }
        // Find the highest slab where conditionValue >= slab_from
        for (let i = slabs.length - 1; i >= 0; i--) {
          if (conditionValue >= Number(slabs[i].slab_from)) {
            currentSlab = slabs[i];
            break;
          }
        }

        if (currentSlab) {
          const slabRate = Number(currentSlab.incentive_value);
          activeSlab = {
            from: Number(currentSlab.slab_from),
            to: currentSlab.slab_to ? Number(currentSlab.slab_to) : null,
            rate: slabRate,
            type: currentSlab.incentive_calc_type,
          };

          if (currentSlab.incentive_calc_type === 'percentage') {
            const base = rule.apply_on === 'above_threshold' ? Math.max(0, matchValue - target) : matchValue;
            incentiveEarned = (base * slabRate) / 100;
            breakdown = `Slab ${Number(currentSlab.slab_from).toLocaleString('en-IN')}-${currentSlab.slab_to ? Number(currentSlab.slab_to).toLocaleString('en-IN') : '∞'}: ${slabRate}% on ₹${base.toLocaleString('en-IN')} = ₹${incentiveEarned.toLocaleString('en-IN')}`;
          } else {
            // per_unit
            const units = rule.apply_on === 'above_threshold' ? Math.max(0, matchQty - target) : matchQty;
            incentiveEarned = units * slabRate;
            breakdown = `Slab ${Number(currentSlab.slab_from).toLocaleString('en-IN')}-${currentSlab.slab_to ? Number(currentSlab.slab_to).toLocaleString('en-IN') : '∞'}: ₹${slabRate}/unit × ${units} = ₹${incentiveEarned.toLocaleString('en-IN')}`;
          }
        } else {
          breakdown = 'Below minimum slab threshold';
        }
      } else if (targetMet) {
        const calcType = rule.incentive_calc_type;
        const val = Number(rule.incentive_value);

        if (calcType === 'percentage') {
          const base = rule.apply_on === 'above_threshold' ? Math.max(0, matchValue - target) : matchValue;
          incentiveEarned = (base * val) / 100;
          breakdown = `${val}% on ₹${base.toLocaleString('en-IN')} = ₹${incentiveEarned.toLocaleString('en-IN')}`;
        } else if (calcType === 'per_unit') {
          const units = rule.apply_on === 'above_threshold' ? Math.max(0, matchQty - target) : matchQty;
          incentiveEarned = units * val;
          breakdown = `₹${val}/unit × ${units} units = ₹${incentiveEarned.toLocaleString('en-IN')}`;
        } else if (calcType === 'fixed') {
          incentiveEarned = val;
          breakdown = `Fixed incentive: ₹${val.toLocaleString('en-IN')}`;
        }
      } else {
        breakdown = `Target not met (${progress.toFixed(0)}% complete)`;
      }

      ruleAchieved.set(rule.id, targetMet);
      ruleResults.push({
        rule_id: rule.id,
        rule_name: rule.rule_name,
        condition_type: rule.condition_type,
        target,
        achieved_value: matchValue,
        achieved_quantity: matchQty,
        progress_percentage: progress,
        target_met: targetMet,
        incentive_earned: Math.round(incentiveEarned * 100) / 100,
        incentive_breakdown: breakdown,
        active_slab: activeSlab,
      });
    }

    // Calculate bonuses
    const bonusResults: SimBonusResult[] = [];
    for (const bonus of bonusRules) {
      const requiredIds: number[] = bonus.required_rule_ids || [];
      const allMet = requiredIds.every((id: number) => ruleAchieved.get(id) === true);

      // Check bonus-level min_threshold if set
      const bonusThreshold = Number(bonus.min_threshold || 0);
      let bonusThresholdMet = true;
      if (bonusThreshold > 0) {
        // Determine condition type from the required rules (quantity or value)
        const relevantRuleResults = ruleResults.filter(r => requiredIds.includes(r.rule_id));
        const relevantRules = rules.filter(r => requiredIds.includes(r.id));
        const condType = relevantRules.length > 0 ? relevantRules[0].condition_type : 'quantity';
        if (condType === 'quantity') {
          const totalAchievedQty = relevantRuleResults.reduce((s, r) => s + r.achieved_quantity, 0);
          bonusThresholdMet = totalAchievedQty >= bonusThreshold;
        } else {
          const totalAchievedVal = relevantRuleResults.reduce((s, r) => s + r.achieved_value, 0);
          bonusThresholdMet = totalAchievedVal >= bonusThreshold;
        }
      }

      let bonusEarned = 0;
      let bBreakdown = '';

      if (allMet && bonusThresholdMet && requiredIds.length > 0) {
        const bVal = Number(bonus.bonus_value);
        if (bonus.bonus_calc_type === 'percentage') {
          const base = bonus.apply_on === 'total_incentive'
            ? ruleResults.reduce((s, r) => s + r.incentive_earned, 0)
            : sim.purchases.reduce((s, p) => s + p.value, 0);
          bonusEarned = (base * bVal) / 100;
          bBreakdown = `${bVal}% on ₹${base.toLocaleString('en-IN')} = ₹${bonusEarned.toLocaleString('en-IN')}`;
        } else if (bonus.bonus_calc_type === 'fixed') {
          bonusEarned = bVal;
          bBreakdown = `Fixed bonus: ₹${bVal.toLocaleString('en-IN')}`;
        } else if (bonus.bonus_calc_type === 'per_unit') {
          const totalQty = sim.purchases.reduce((s, p) => s + p.quantity, 0);
          bonusEarned = totalQty * bVal;
          bBreakdown = `₹${bVal}/unit × ${totalQty} = ₹${bonusEarned.toLocaleString('en-IN')}`;
        }
      } else {
        const metCount = requiredIds.filter((id: number) => ruleAchieved.get(id)).length;
        if (allMet && !bonusThresholdMet) {
          bBreakdown = `Rules met but bonus threshold not reached (need ${bonusThreshold.toLocaleString('en-IN')})`;
        } else {
          bBreakdown = `Requires ${requiredIds.length} rules met (${metCount} met)`;
        }
      }

      bonusResults.push({
        bonus_name: bonus.bonus_name,
        achieved: allMet && bonusThresholdMet && requiredIds.length > 0,
        bonus_earned: Math.round(bonusEarned * 100) / 100,
        breakdown: bBreakdown,
      });
    }

    const totalIncentive = ruleResults.reduce((s, r) => s + r.incentive_earned, 0)
      + bonusResults.reduce((s, b) => s + b.bonus_earned, 0);
    const totalRevenue = sim.purchases.reduce((s, p) => s + p.value, 0);

    dealerResults.push({
      dealer_id: sim.dealer_id,
      dealer_name: sim.dealer_name,
      dealer_type: sim.dealer_type,
      region: sim.region,
      total_revenue: totalRevenue,
      total_incentive: Math.round(totalIncentive * 100) / 100,
      rules: ruleResults,
      bonuses: bonusResults,
      cost_percentage: totalRevenue > 0 ? Math.round((totalIncentive / totalRevenue) * 10000) / 100 : 0,
    });
  }

  // Summary
  const revenues = dealerResults.map(d => d.total_revenue).filter(r => r > 0);
  const costs = dealerResults.map(d => d.total_incentive);
  const earning = dealerResults.filter(d => d.total_incentive > 0);

  const summary = {
    total_dealers: dealerResults.length,
    dealers_earning: earning.length,
    min_revenue: revenues.length > 0 ? Math.min(...revenues) : 0,
    max_revenue: revenues.length > 0 ? Math.max(...revenues) : 0,
    avg_revenue: revenues.length > 0 ? Math.round(revenues.reduce((a, b) => a + b, 0) / revenues.length) : 0,
    total_revenue: revenues.reduce((a, b) => a + b, 0),
    min_cost: costs.length > 0 ? Math.min(...costs) : 0,
    max_cost: costs.length > 0 ? Math.max(...costs) : 0,
    avg_cost: costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : 0,
    total_cost: Math.round(costs.reduce((a, b) => a + b, 0) * 100) / 100,
    avg_cost_percentage: revenues.length > 0
      ? Math.round((costs.reduce((a, b) => a + b, 0) / revenues.reduce((a, b) => a + b, 0)) * 10000) / 100
      : 0,
  };

  return {
    scheme_id: schemeId,
    scheme_name: scheme.name,
    incentive_type: scheme.incentive_type,
    dealer_results: dealerResults,
    summary,
  };
}

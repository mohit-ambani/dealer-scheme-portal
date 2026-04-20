import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dealerId = Number(id);
    const dealer = await getOne('SELECT * FROM dealers WHERE id = $1', [dealerId]);
    if (!dealer) return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });

    // Check if we should force recalculate (only when explicitly requested)
    const forceCalc = req.nextUrl.searchParams.get('recalculate') === 'true';

    if (forceCalc) {
      // Full recalculation — only when triggered explicitly
      const { calculateAllSchemesForDealer } = await import('@/lib/scheme-engine');
      const results = await calculateAllSchemesForDealer(dealerId);
      const totalIncentive = results.reduce((sum, r) => sum + r.total_incentive, 0);
      const schemesAchieved = results.filter(r => r.rules.every(rule => rule.target_met)).length;
      const invoiceStats = await getOne(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total
         FROM invoices WHERE dealer_id = $1 AND status = 'confirmed'`, [dealerId]
      );
      return NextResponse.json({
        dealer, schemes: results,
        summary: {
          total_schemes: results.length,
          schemes_fully_achieved: schemesAchieved,
          total_incentive_earned: totalIncentive,
          total_invoices: Number(invoiceStats?.count || 0),
          total_purchase_value: Number(invoiceStats?.total || 0),
        }
      });
    }

    // Fast path: read from pre-calculated progress tables
    const applicableSchemes = await getAll(
      `SELECT * FROM schemes WHERE status = 'active'
       AND applicable_regions::jsonb ? $1
       AND applicable_dealer_types::jsonb ? $2`,
      [dealer.region, dealer.type]
    );

    if (applicableSchemes.length === 0) {
      const invoiceStats = await getOne(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total
         FROM invoices WHERE dealer_id = $1 AND status = 'confirmed'`, [dealerId]
      );
      return NextResponse.json({
        dealer, schemes: [],
        summary: {
          total_schemes: 0, schemes_fully_achieved: 0, total_incentive_earned: 0,
          total_invoices: Number(invoiceStats?.count || 0),
          total_purchase_value: Number(invoiceStats?.total || 0),
        }
      });
    }

    const schemeIds = applicableSchemes.map(s => s.id);

    // Batch-fetch all progress, rules, bonuses, and slabs in parallel
    const [progressRows, allRules, allBonusProgress, allSlabs, invoiceStats] = await Promise.all([
      getAll(
        `SELECT dsp.*, sr.rule_name, sr.condition_type, sr.min_threshold, sr.incentive_calc_type,
                sr.incentive_value, sr.rule_order
         FROM dealer_scheme_progress dsp
         JOIN scheme_rules sr ON dsp.rule_id = sr.id
         WHERE dsp.dealer_id = $1 AND dsp.scheme_id = ANY($2::int[])
         ORDER BY sr.rule_order`,
        [dealerId, schemeIds]
      ),
      getAll(
        `SELECT * FROM scheme_rules WHERE scheme_id = ANY($1::int[]) ORDER BY rule_order`,
        [schemeIds]
      ),
      getAll(
        `SELECT dbp.*, sbr.bonus_name
         FROM dealer_bonus_progress dbp
         JOIN scheme_bonus_rules sbr ON dbp.bonus_rule_id = sbr.id
         WHERE dbp.dealer_id = $1 AND dbp.scheme_id = ANY($2::int[])`,
        [dealerId, schemeIds]
      ),
      getAll(
        `SELECT ss.* FROM scheme_slabs ss
         JOIN scheme_rules sr ON ss.rule_id = sr.id
         WHERE sr.scheme_id = ANY($1::int[])
         ORDER BY ss.slab_from`,
        [schemeIds]
      ),
      getOne(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total
         FROM invoices WHERE dealer_id = $1 AND status = 'confirmed'`,
        [dealerId]
      ),
    ]);

    // Check if we have any cached progress at all — if not, do a one-time calculation
    if (progressRows.length === 0 && allRules.length > 0) {
      const { calculateAllSchemesForDealer } = await import('@/lib/scheme-engine');
      const results = await calculateAllSchemesForDealer(dealerId);
      const totalIncentive = results.reduce((sum, r) => sum + r.total_incentive, 0);
      const schemesAchieved = results.filter(r => r.rules.every(rule => rule.target_met)).length;
      return NextResponse.json({
        dealer, schemes: results,
        summary: {
          total_schemes: results.length,
          schemes_fully_achieved: schemesAchieved,
          total_incentive_earned: totalIncentive,
          total_invoices: Number(invoiceStats?.count || 0),
          total_purchase_value: Number(invoiceStats?.total || 0),
        }
      });
    }

    // Build slabs lookup by rule_id
    const slabsByRule = new Map<number, { from: number; to: number | null; rate: number; type: string }[]>();
    for (const slab of allSlabs) {
      const ruleId = slab.rule_id;
      if (!slabsByRule.has(ruleId)) slabsByRule.set(ruleId, []);
      slabsByRule.get(ruleId)!.push({
        from: Number(slab.slab_from),
        to: slab.slab_to ? Number(slab.slab_to) : null,
        rate: Number(slab.incentive_value),
        type: slab.incentive_calc_type,
      });
    }

    // Build scheme results from cached progress
    const schemes = applicableSchemes.map(scheme => {
      const schemeRules = allRules.filter(r => r.scheme_id === scheme.id);
      const schemeProgress = progressRows.filter(p => p.scheme_id === scheme.id);
      const schemeBonuses = allBonusProgress.filter(b => b.scheme_id === scheme.id);

      const rules = schemeRules.map(rule => {
        const progress = schemeProgress.find(p => p.rule_id === rule.id);
        const ruleSl = slabsByRule.get(rule.id);

        const achievedValue = Number(progress?.current_value || 0);
        const achievedQuantity = Number(progress?.current_quantity || 0);
        const conditionValue = rule.condition_type === 'value' ? achievedValue : achievedQuantity;

        let allSlabsUi;
        if (rule.incentive_calc_type === 'slab' && ruleSl) {
          allSlabsUi = ruleSl.map(s => {
            const upper = s.to ?? Infinity;
            let status: 'achieved' | 'current' | 'locked';
            if (conditionValue >= upper) status = 'achieved';
            else if (conditionValue >= s.from) status = 'current';
            else status = 'locked';
            return { ...s, status };
          });
        }

        return {
          rule_id: rule.id,
          rule_name: rule.rule_name,
          condition_type: rule.condition_type,
          incentive_calc_type: rule.incentive_calc_type,
          target: Number(rule.min_threshold),
          achieved_value: achievedValue,
          achieved_quantity: achievedQuantity,
          progress_percentage: Number(progress?.progress_percentage || 0),
          target_met: progress?.target_achieved || false,
          incentive_earned: Number(progress?.incentive_earned || 0),
          matching_invoices: [],
          active_slab: null,
          all_slabs: allSlabsUi,
        };
      });

      const bonuses = schemeBonuses.map(b => ({
        bonus_rule_id: b.bonus_rule_id,
        bonus_name: b.bonus_name,
        achieved: b.achieved || false,
        bonus_earned: Number(b.bonus_earned || 0),
      }));

      const totalIncentive = rules.reduce((s, r) => s + r.incentive_earned, 0)
        + bonuses.reduce((s, b) => s + b.bonus_earned, 0);

      return {
        scheme_id: scheme.id,
        scheme_name: scheme.name,
        total_incentive: totalIncentive,
        incentive_type: scheme.incentive_type,
        period: {
          start: scheme.start_date ? new Date(scheme.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '',
          end: scheme.end_date ? new Date(scheme.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '',
        },
        rules,
        bonuses,
      };
    });

    const totalIncentive = schemes.reduce((s, sc) => s + sc.total_incentive, 0);
    const schemesAchieved = schemes.filter(sc => sc.rules.length > 0 && sc.rules.every(r => r.target_met)).length;

    return NextResponse.json({
      dealer,
      schemes,
      summary: {
        total_schemes: schemes.length,
        schemes_fully_achieved: schemesAchieved,
        total_incentive_earned: totalIncentive,
        total_invoices: Number(invoiceStats?.count || 0),
        total_purchase_value: Number(invoiceStats?.total || 0),
      }
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

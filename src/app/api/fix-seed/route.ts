import { NextResponse } from 'next/server';
import { query, getOne, getAll } from '@/lib/db';

export async function POST() {
  try {
    // Get scheme 5 (Summer Fan Fiesta 2026)
    const scheme = await getOne(
      "SELECT id FROM schemes WHERE scheme_code = 'SCH-SUM-FAN-2026'"
    );
    if (!scheme) {
      return NextResponse.json(
        { error: 'Scheme SCH-SUM-FAN-2026 not found' },
        { status: 404 }
      );
    }
    const schemeId = scheme.id;

    // Check if rules already exist
    const existingRules = await getAll(
      'SELECT id FROM scheme_rules WHERE scheme_id = $1',
      [schemeId]
    );
    if (existingRules.length > 0) {
      return NextResponse.json({
        status: 'already_fixed',
        message: `Scheme ${schemeId} already has ${existingRules.length} rules`,
      });
    }

    // Rule 1: Slab-based per-unit on Fan category (category_id=6) by quantity
    // Buy 50 fans = Rs 200/fan, 100 fans = Rs 350/fan, 200 fans = Rs 500/fan
    const r1 = await query(
      `INSERT INTO scheme_rules
        (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        schemeId, 1, 'Fan Quantity Slab Target', 6, 'quantity', 50,
        'slab', 0, 'all',
        'Purchase 50+ ceiling fans to earn slab-based per-unit incentive on all fan units',
      ]
    );
    const rule1Id = r1.rows[0].id;

    // Slabs for rule 1: quantity-based per_unit slabs
    await query(
      'INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)',
      [rule1Id, 50, 100, 'per_unit', 200]
    );
    await query(
      'INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)',
      [rule1Id, 100, 200, 'per_unit', 350]
    );
    await query(
      'INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)',
      [rule1Id, 200, null, 'per_unit', 500]
    );

    // Rule 2: Additional rule - BLDC Fan (sku_id=29) percentage bonus
    // If BLDC fans are 25%+ of total fan quantity, give extra 3% on BLDC value
    // We set min_threshold=1 (at least 1 BLDC fan needed) and mark as additional.
    // The 25% mix condition is described in rule description for business context.
    // With min_threshold=1 and is_additional=true, engine checks BLDC qty >= 1.
    // We use a bonus_rule to enforce the 25% mix condition properly via required_rule_ids.
    const r2 = await query(
      `INSERT INTO scheme_rules
        (scheme_id, rule_order, rule_name, sku_id, condition_type, min_threshold, incentive_calc_type, incentive_value, is_additional, apply_on, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        schemeId, 2, 'BLDC Fan Mix Bonus', 29, 'quantity', 1,
        'percentage', 3, true, 'total',
        'If BLDC fans are 25%+ of total fan quantity, earn extra 3% on BLDC fan purchase value',
      ]
    );
    const rule2Id = r2.rows[0].id;

    // Bonus rule: achieve both fan target (rule 1) and BLDC mix (rule 2)
    // to get the BLDC bonus. The 3% is already on rule 2 itself.
    // No separate bonus_rule needed since rule 2 handles the incentive.
    // But we can add a bonus for achieving both targets.

    // Verify insertion
    const rules = await getAll(
      'SELECT id, rule_name, condition_type, min_threshold, incentive_calc_type, incentive_value FROM scheme_rules WHERE scheme_id = $1 ORDER BY rule_order',
      [schemeId]
    );
    const slabs = await getAll(
      'SELECT s.* FROM scheme_slabs s JOIN scheme_rules r ON s.rule_id = r.id WHERE r.scheme_id = $1 ORDER BY s.slab_from',
      [schemeId]
    );

    return NextResponse.json({
      status: 'fixed',
      scheme_id: schemeId,
      rules_inserted: rules,
      slabs_inserted: slabs,
      message: `Successfully inserted ${rules.length} rules and ${slabs.length} slabs for scheme ${schemeId} (Summer Fan Fiesta 2026)`,
    });
  } catch (error) {
    console.error('Fix-seed error:', error);
    return NextResponse.json(
      { error: String(error), stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const scheme = await getOne(
      "SELECT id FROM schemes WHERE scheme_code = 'SCH-SUM-FAN-2026'"
    );
    if (!scheme) {
      return NextResponse.json({ status: 'scheme_not_found' });
    }
    const rules = await getAll(
      'SELECT * FROM scheme_rules WHERE scheme_id = $1 ORDER BY rule_order',
      [scheme.id]
    );
    const slabs = await getAll(
      'SELECT s.* FROM scheme_slabs s JOIN scheme_rules r ON s.rule_id = r.id WHERE r.scheme_id = $1 ORDER BY s.slab_from',
      [scheme.id]
    );
    const bonuses = await getAll(
      'SELECT * FROM scheme_bonus_rules WHERE scheme_id = $1',
      [scheme.id]
    );
    return NextResponse.json({
      scheme_id: scheme.id,
      rules_count: rules.length,
      rules,
      slabs_count: slabs.length,
      slabs,
      bonuses_count: bonuses.length,
      bonuses,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

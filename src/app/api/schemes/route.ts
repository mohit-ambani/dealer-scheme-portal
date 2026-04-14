import { NextRequest, NextResponse } from 'next/server';
import { getAll, query } from '@/lib/db';

export async function GET() {
  try {
    const schemes = await getAll(`
      SELECT s.*,
        (SELECT COUNT(*) FROM scheme_rules WHERE scheme_id = s.id) as rule_count,
        (SELECT COUNT(*) FROM scheme_bonus_rules WHERE scheme_id = s.id) as bonus_count
      FROM schemes s
      ORDER BY s.created_at DESC
    `);
    return NextResponse.json(schemes);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await query(
      `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, is_backdated, created_date, ai_prompt, ai_model, calculation_logic, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,$11,$12,$13,$14) RETURNING *`,
      [
        body.name, body.description, body.scheme_code,
        body.start_date, body.end_date, body.status || 'active',
        JSON.stringify(body.applicable_regions || []),
        JSON.stringify(body.applicable_dealer_types || []),
        body.incentive_type || 'credit_note',
        body.is_backdated || false,
        body.ai_prompt, body.ai_model, body.calculation_logic, body.notes,
      ]
    );
    const scheme = result.rows[0];

    // Insert rules
    if (body.rules && Array.isArray(body.rules)) {
      for (let i = 0; i < body.rules.length; i++) {
        const rule = body.rules[i];
        const ruleResult = await query(
          `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, sku_id, condition_type, min_threshold, max_threshold, incentive_calc_type, incentive_value, is_additional, apply_on, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [
            scheme.id, i + 1, rule.rule_name,
            rule.sku_category_id || null, rule.sku_id || null,
            rule.condition_type, rule.min_threshold, rule.max_threshold || null,
            rule.incentive_calc_type, rule.incentive_value || 0,
            rule.is_additional || false, rule.apply_on || 'total',
            rule.description,
          ]
        );

        // Insert slabs if any
        if (rule.slabs && Array.isArray(rule.slabs)) {
          for (const slab of rule.slabs) {
            await query(
              `INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value)
               VALUES ($1,$2,$3,$4,$5)`,
              [ruleResult.rows[0].id, slab.slab_from, slab.slab_to || null, slab.incentive_calc_type, slab.incentive_value]
            );
          }
        }
      }
    }

    // Insert bonus rules
    if (body.bonus_rules && Array.isArray(body.bonus_rules)) {
      for (const bonus of body.bonus_rules) {
        await query(
          `INSERT INTO scheme_bonus_rules (scheme_id, bonus_name, required_rule_ids, bonus_calc_type, bonus_value, apply_on, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            scheme.id, bonus.bonus_name,
            JSON.stringify(bonus.required_rule_ids || []),
            bonus.bonus_calc_type, bonus.bonus_value,
            bonus.apply_on || 'total_purchase', bonus.description,
          ]
        );
      }
    }

    return NextResponse.json(scheme, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scheme = await getOne('SELECT * FROM schemes WHERE id = $1', [id]);
    if (!scheme) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rules = await getAll(
      'SELECT * FROM scheme_rules WHERE scheme_id = $1 ORDER BY rule_order',
      [id]
    );

    // Get slabs for each rule
    for (const rule of rules) {
      if (rule.incentive_calc_type === 'slab') {
        rule.slabs = await getAll(
          'SELECT * FROM scheme_slabs WHERE rule_id = $1 ORDER BY slab_from',
          [rule.id]
        );
      }
    }

    const bonusRules = await getAll(
      'SELECT * FROM scheme_bonus_rules WHERE scheme_id = $1',
      [id]
    );

    return NextResponse.json({ ...scheme, rules, bonus_rules: bonusRules });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

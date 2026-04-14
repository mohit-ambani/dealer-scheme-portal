import { NextRequest, NextResponse } from 'next/server';
import { calculateAllSchemesForDealer } from '@/lib/scheme-engine';
import { getOne, getAll } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dealer = await getOne('SELECT * FROM dealers WHERE id = $1', [id]);
    if (!dealer) return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });

    const results = await calculateAllSchemesForDealer(Number(id));

    // Also get summary stats
    const totalIncentive = results.reduce((sum, r) => sum + r.total_incentive, 0);
    const schemesAchieved = results.filter(r =>
      r.rules.every(rule => rule.target_met)
    ).length;

    const invoiceStats = await getOne(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total
       FROM invoices WHERE dealer_id = $1 AND status = 'confirmed'`,
      [id]
    );

    return NextResponse.json({
      dealer,
      schemes: results,
      summary: {
        total_schemes: results.length,
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

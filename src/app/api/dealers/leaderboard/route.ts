import { NextResponse } from 'next/server';
import { getAll } from '@/lib/db';
import { calculateAllSchemesForDealer } from '@/lib/scheme-engine';

export async function GET() {
  try {
    const dealers = await getAll(`SELECT id, name, firm_name, region, city FROM dealers WHERE is_active = true ORDER BY id`);

    const leaderboard = await Promise.all(
      dealers.map(async (dealer) => {
        try {
          const results = await calculateAllSchemesForDealer(dealer.id);
          const totalIncentive = results.reduce((sum: number, r: { total_incentive: number }) => sum + r.total_incentive, 0);
          const schemesAchieved = results.filter((r: { rules: { target_met: boolean }[] }) =>
            r.rules.every((rule: { target_met: boolean }) => rule.target_met)
          ).length;
          return {
            dealer_id: dealer.id,
            dealer_name: dealer.name,
            firm_name: dealer.firm_name,
            region: dealer.region,
            city: dealer.city,
            total_incentive: totalIncentive,
            schemes_achieved: schemesAchieved,
            total_schemes: results.length,
          };
        } catch {
          return {
            dealer_id: dealer.id,
            dealer_name: dealer.name,
            firm_name: dealer.firm_name,
            region: dealer.region,
            city: dealer.city,
            total_incentive: 0,
            schemes_achieved: 0,
            total_schemes: 0,
          };
        }
      })
    );

    // Sort by total incentive descending, take top 10
    leaderboard.sort((a, b) => b.total_incentive - a.total_incentive);

    return NextResponse.json(leaderboard.slice(0, 10));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

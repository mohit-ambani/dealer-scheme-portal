import { NextResponse } from 'next/server';
import { runDailyRecalculation } from '@/lib/scheme-engine';

export async function POST() {
  try {
    const results = await runDailyRecalculation();
    return NextResponse.json({
      status: 'completed',
      schemes_processed: results.length,
      total_incentive: results.reduce((s, r) => s + r.total_incentive, 0),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

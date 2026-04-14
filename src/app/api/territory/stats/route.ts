import { NextResponse } from 'next/server';
import { getRegionStats } from '@/lib/dealer-analytics';

export async function GET() {
  try {
    const regions = await getRegionStats();
    return NextResponse.json(regions);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

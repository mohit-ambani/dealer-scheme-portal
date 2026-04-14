import { NextRequest, NextResponse } from 'next/server';
import { simulateScheme, DealerSimulation } from '@/lib/whatif-engine';

export async function POST(req: NextRequest) {
  try {
    const { scheme_id, dealer_simulations } = await req.json();
    if (!scheme_id) return NextResponse.json({ error: 'scheme_id required' }, { status: 400 });
    if (!dealer_simulations || !Array.isArray(dealer_simulations)) {
      return NextResponse.json({ error: 'dealer_simulations array required' }, { status: 400 });
    }

    const result = await simulateScheme(scheme_id, dealer_simulations as DealerSimulation[]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

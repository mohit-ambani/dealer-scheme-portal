import { NextRequest, NextResponse } from 'next/server';
import { calculateSchemeForDealer } from '@/lib/scheme-engine';
import { getAll } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dealerId = req.nextUrl.searchParams.get('dealer_id');

    if (dealerId) {
      const result = await calculateSchemeForDealer(Number(id), Number(dealerId));
      return NextResponse.json(result);
    }

    // Calculate for all applicable dealers
    const scheme = await getAll('SELECT * FROM schemes WHERE id = $1', [id]);
    if (!scheme.length) return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });

    const s = scheme[0];
    const regions = s.applicable_regions || [];
    const types = s.applicable_dealer_types || [];

    const dealers = await getAll(
      `SELECT * FROM dealers WHERE is_active = true
       AND region = ANY($1::text[])
       AND type = ANY($2::text[])`,
      [regions, types]
    );

    const results = [];
    for (const dealer of dealers) {
      try {
        const result = await calculateSchemeForDealer(Number(id), dealer.id);
        results.push(result);
      } catch (e) {
        results.push({ dealer_id: dealer.id, dealer_name: dealer.name, error: String(e) });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

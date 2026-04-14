import { NextResponse } from 'next/server';
import { getAll } from '@/lib/db';

export async function GET() {
  try {
    const dealers = await getAll(`
      SELECT d.*,
        (SELECT COUNT(*) FROM invoices WHERE dealer_id = d.id) as invoice_count,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE dealer_id = d.id) as total_purchase
      FROM dealers d
      ORDER BY d.name
    `);
    return NextResponse.json(dealers);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAll } from '@/lib/db';

export async function GET() {
  try {
    const invoices = await getAll(`
      SELECT i.*, d.name as dealer_name, d.code as dealer_code,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
      FROM invoices i
      JOIN dealers d ON i.dealer_id = d.id
      ORDER BY i.invoice_date DESC
    `);
    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

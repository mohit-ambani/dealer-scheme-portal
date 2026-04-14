import { NextResponse } from 'next/server';
import { getAll } from '@/lib/db';

export async function GET() {
  try {
    const categories = await getAll('SELECT * FROM sku_categories ORDER BY name');
    const skus = await getAll(`
      SELECT s.*, sc.name as category_name, sc.code as category_code
      FROM skus s
      JOIN sku_categories sc ON s.category_id = sc.id
      ORDER BY sc.name, s.name
    `);
    return NextResponse.json({ categories, skus });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

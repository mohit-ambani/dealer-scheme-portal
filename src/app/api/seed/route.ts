import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import { getAll } from '@/lib/db';

export async function GET() {
  try {
    const result = await getAll('SELECT COUNT(*)::int as count FROM sku_categories');
    if (result[0]?.count > 0) {
      return NextResponse.json({ status: 'already_seeded' });
    }
    return NextResponse.json({ status: 'not_seeded' });
  } catch {
    // Tables don't exist yet
    return NextResponse.json({ status: 'not_seeded' });
  }
}

export async function POST() {
  try {
    await seedDatabase();
    return NextResponse.json({ status: 'seeded' });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 });
  }
}

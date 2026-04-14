import { NextResponse } from 'next/server';
import { seedExtendedData } from '@/lib/seed-extended';

export async function GET() {
  try {
    const result = await seedExtendedData();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Extended seed error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

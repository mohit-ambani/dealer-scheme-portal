import { NextResponse } from 'next/server';
import { seedMassiveData } from '@/lib/seed-massive';

export async function POST() {
  try {
    const result = await seedMassiveData();
    return NextResponse.json(result);
  } catch (e) {
    console.error('Massive seed failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}

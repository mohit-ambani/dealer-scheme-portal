import { NextResponse } from 'next/server';
import { query, getAll } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = url.searchParams.get('region');
  const rows = region
    ? await getAll('SELECT * FROM territory_comments WHERE region = $1 ORDER BY created_at DESC LIMIT 30', [region])
    : await getAll('SELECT * FROM territory_comments ORDER BY created_at DESC LIMIT 50');
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { region, state, comment, author_name = 'Admin' } = await req.json();
  if (!region || !comment) return NextResponse.json({ error: 'region and comment required' }, { status: 400 });
  const res = await query(
    'INSERT INTO territory_comments (region, state, comment, author_name) VALUES ($1,$2,$3,$4) RETURNING *',
    [region, state || null, comment, author_name]
  );
  return NextResponse.json(res.rows[0]);
}

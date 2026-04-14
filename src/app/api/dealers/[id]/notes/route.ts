import { NextResponse } from 'next/server';
import { query, getAll } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = await getAll('SELECT * FROM dealer_notes WHERE dealer_id = $1 ORDER BY created_at DESC', [Number(id)]);
  return NextResponse.json(notes);
}

const VALID_NOTE_TYPES = ['general', 'territory', 'performance', 'visit', 'complaint', 'opportunity'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { content, note_type = 'general', author_role = 'admin', author_name = 'Admin', tags = [] } = body;
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });
  if (!VALID_NOTE_TYPES.includes(note_type)) {
    return NextResponse.json(
      { error: `Invalid note_type "${note_type}". Must be one of: ${VALID_NOTE_TYPES.join(', ')}` },
      { status: 400 }
    );
  }
  try {
    const res = await query(
      'INSERT INTO dealer_notes (dealer_id, content, note_type, author_role, author_name, tags) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [Number(id), content, note_type, author_role, author_name, JSON.stringify(tags)]
    );
    return NextResponse.json(res.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

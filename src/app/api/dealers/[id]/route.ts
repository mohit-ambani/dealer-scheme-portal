import { NextResponse } from 'next/server';
import { getDealerFull, getDealerMonthlyTrends, getDealerCategoryBreakdown, getDealerSchemeProgress, getDealerInvoices, getDealerNotes } from '@/lib/dealer-analytics';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealerId = Number(id);
  try {
    const [dealer, trends, categories, schemes, invoices, notes] = await Promise.all([
      getDealerFull(dealerId),
      getDealerMonthlyTrends(dealerId),
      getDealerCategoryBreakdown(dealerId),
      getDealerSchemeProgress(dealerId),
      getDealerInvoices(dealerId),
      getDealerNotes(dealerId),
    ]);
    if (!dealer) return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    return NextResponse.json({ dealer, trends, categories, schemes, invoices, notes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

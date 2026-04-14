import { NextRequest, NextResponse } from 'next/server';
import { getAll } from '@/lib/db';
import * as XLSX from 'xlsx';
import { mapInvoiceColumns } from '@/lib/ai-mapper';

/**
 * Upload historical data (last year invoices) and return aggregated purchase data
 * per dealer per category - ready for what-if simulation.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rawRows: Record<string, unknown>[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json();
      rawRows = Array.isArray(body) ? body : body.data || body.invoices || [body];
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 400 });
    }

    // AI auto-map columns
    const headers = Object.keys(rawRows[0]);
    const mappingResult = await mapInvoiceColumns(headers, rawRows);
    const mapping = mappingResult.mapping;

    // Apply mapping
    const mappedRows = rawRows.map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [src, tgt] of Object.entries(mapping)) {
        if (tgt && tgt !== 'unmapped') mapped[tgt] = row[src];
      }
      return mapped;
    });

    // Load dealers and SKUs for matching
    const dealers = await getAll('SELECT id, name, code, type, region FROM dealers');
    const skus = await getAll('SELECT id, name, code, category_id FROM skus');
    const categories = await getAll('SELECT id, name FROM sku_categories ORDER BY name');

    const dealerByName = new Map<string, Record<string, unknown>>();
    const dealerByCode = new Map<string, Record<string, unknown>>();
    for (const d of dealers) {
      dealerByName.set(String(d.name).toLowerCase().trim(), d);
      dealerByCode.set(String(d.code).toLowerCase().trim(), d);
    }
    const skuByName = new Map<string, { id: number; category_id: number }>();
    const skuByCode = new Map<string, { id: number; category_id: number }>();
    for (const s of skus) {
      skuByName.set(String(s.name).toLowerCase().trim(), { id: s.id, category_id: s.category_id });
      skuByCode.set(String(s.code).toLowerCase().trim(), { id: s.id, category_id: s.category_id });
    }

    // Aggregate: dealer -> category -> { value, quantity }
    const agg = new Map<number, { dealer: Record<string, unknown>; cats: Map<number, { value: number; quantity: number }> }>();
    let matched = 0;
    let unmatched = 0;

    for (const row of mappedRows) {
      // Find dealer
      let dealer: Record<string, unknown> | null = null;
      if (row.dealer_code) dealer = dealerByCode.get(String(row.dealer_code).toLowerCase().trim()) || null;
      if (!dealer && row.dealer_name) {
        dealer = dealerByName.get(String(row.dealer_name).toLowerCase().trim()) || null;
        if (!dealer) {
          const search = String(row.dealer_name).toLowerCase().trim();
          for (const [name, d] of dealerByName) {
            if (name.includes(search) || search.includes(name)) { dealer = d; break; }
          }
        }
      }
      if (!dealer) { unmatched++; continue; }

      // Find SKU category
      let catId: number | null = null;
      if (row.sku_code) {
        const s = skuByCode.get(String(row.sku_code).toLowerCase().trim());
        if (s) catId = s.category_id;
      }
      if (!catId && row.sku_name) {
        const s = skuByName.get(String(row.sku_name).toLowerCase().trim());
        if (s) catId = s.category_id;
        if (!catId) {
          const search = String(row.sku_name).toLowerCase().trim();
          for (const [name, info] of skuByName) {
            if (name.includes(search) || search.includes(name)) { catId = info.category_id; break; }
          }
        }
      }
      if (!catId) { unmatched++; continue; }

      matched++;
      const dealerId = dealer.id as number;
      if (!agg.has(dealerId)) {
        agg.set(dealerId, { dealer, cats: new Map() });
      }
      const entry = agg.get(dealerId)!;
      if (!entry.cats.has(catId)) entry.cats.set(catId, { value: 0, quantity: 0 });
      const cat = entry.cats.get(catId)!;
      cat.value += Number(row.total_price || 0) || (Number(row.quantity || 0) * Number(row.unit_price || 0));
      cat.quantity += Number(row.quantity || 0);
    }

    // Format result as dealer_simulations ready for the what-if engine
    const dealerSimulations = Array.from(agg.entries()).map(([, entry]) => ({
      dealer_id: entry.dealer.id as number,
      dealer_name: entry.dealer.name as string,
      dealer_type: entry.dealer.type as string,
      region: entry.dealer.region as string,
      purchases: Array.from(entry.cats.entries()).map(([catId, data]) => ({
        category_id: catId,
        category_name: categories.find((c: Record<string, unknown>) => c.id === catId)?.name || '',
        value: Math.round(data.value),
        quantity: data.quantity,
      })),
    }));

    return NextResponse.json({
      success: true,
      dealer_simulations: dealerSimulations,
      stats: {
        total_rows: rawRows.length,
        matched_rows: matched,
        unmatched_rows: unmatched,
        dealers_found: dealerSimulations.length,
      },
      mapping,
      mapping_source: mappingResult.model,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

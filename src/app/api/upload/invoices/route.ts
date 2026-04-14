import { NextRequest, NextResponse } from 'next/server';
import { query, getOne, getAll } from '@/lib/db';
import { mapInvoiceColumns } from '@/lib/ai-mapper';
import * as XLSX from 'xlsx';

interface ParsedRow {
  invoice_number?: string;
  dealer_name?: string;
  dealer_code?: string;
  invoice_date?: string;
  sku_name?: string;
  sku_code?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  payment_terms?: string;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  // Handle Excel serial dates
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  // Try various date formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];
  for (const fmt of formats) {
    const match = str.match(fmt);
    if (match) {
      if (fmt === formats[0]) return `${match[1]}-${match[2]}-${match[3]}`;
      // Assume DD/MM/YYYY for Indian context
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = match[3];
      if (day > 12) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (month > 12) return `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  // Try parsing with Date constructor
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rawRows: Record<string, unknown>[] = [];

    if (contentType.includes('application/json')) {
      // JSON upload
      const body = await req.json();
      rawRows = Array.isArray(body) ? body : body.invoices || body.data || [body];
    } else {
      // Excel/form upload
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'No data found in upload' }, { status: 400 });
    }

    // Get column headers
    const headers = Object.keys(rawRows[0]);

    // AI auto-map columns
    const mappingResult = await mapInvoiceColumns(headers, rawRows);
    const mapping = mappingResult.mapping;

    // Apply mapping to transform rows
    const mappedRows: ParsedRow[] = rawRows.map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [srcCol, targetField] of Object.entries(mapping)) {
        if (targetField && targetField !== 'unmapped') {
          mapped[targetField] = row[srcCol];
        }
      }
      return mapped as ParsedRow;
    });

    // Lookup existing dealers and SKUs
    const dealers = await getAll('SELECT id, name, code FROM dealers');
    const skus = await getAll('SELECT id, name, code, unit_price FROM skus');

    const dealerByName = new Map<string, number>();
    const dealerByCode = new Map<string, number>();
    for (const d of dealers) {
      dealerByName.set(String(d.name).toLowerCase().trim(), d.id);
      dealerByCode.set(String(d.code).toLowerCase().trim(), d.id);
    }

    const skuByName = new Map<string, { id: number; unit_price: number }>();
    const skuByCode = new Map<string, { id: number; unit_price: number }>();
    for (const s of skus) {
      skuByName.set(String(s.name).toLowerCase().trim(), { id: s.id, unit_price: Number(s.unit_price) });
      skuByCode.set(String(s.code).toLowerCase().trim(), { id: s.id, unit_price: Number(s.unit_price) });
    }

    // Group rows by invoice_number (since Excel is usually flat: 1 row per line item)
    const invoiceGroups = new Map<string, { dealerId: number; date: string; terms: string; items: { skuId: number; qty: number; unitPrice: number; totalPrice: number }[] }>();

    const errors: string[] = [];
    let rowNum = 0;

    for (const row of mappedRows) {
      rowNum++;
      const invNum = String(row.invoice_number || '').trim();
      if (!invNum) { errors.push(`Row ${rowNum}: Missing invoice number`); continue; }

      // Resolve dealer
      let dealerId: number | null = null;
      if (row.dealer_code) dealerId = dealerByCode.get(String(row.dealer_code).toLowerCase().trim()) || null;
      if (!dealerId && row.dealer_name) dealerId = dealerByName.get(String(row.dealer_name).toLowerCase().trim()) || null;
      // Fuzzy match: partial name
      if (!dealerId && row.dealer_name) {
        const searchName = String(row.dealer_name).toLowerCase().trim();
        for (const [name, id] of dealerByName) {
          if (name.includes(searchName) || searchName.includes(name)) { dealerId = id; break; }
        }
      }
      if (!dealerId) { errors.push(`Row ${rowNum}: Dealer not found: "${row.dealer_name || row.dealer_code}"`); continue; }

      const date = parseDate(row.invoice_date);
      if (!date) { errors.push(`Row ${rowNum}: Invalid date: "${row.invoice_date}"`); continue; }

      // Resolve SKU
      let skuMatch: { id: number; unit_price: number } | null = null;
      if (row.sku_code) skuMatch = skuByCode.get(String(row.sku_code).toLowerCase().trim()) || null;
      if (!skuMatch && row.sku_name) skuMatch = skuByName.get(String(row.sku_name).toLowerCase().trim()) || null;
      // Fuzzy match: partial name
      if (!skuMatch && row.sku_name) {
        const searchSku = String(row.sku_name).toLowerCase().trim();
        for (const [name, info] of skuByName) {
          if (name.includes(searchSku) || searchSku.includes(name)) { skuMatch = info; break; }
        }
      }
      if (!skuMatch) { errors.push(`Row ${rowNum}: SKU not found: "${row.sku_name || row.sku_code}"`); continue; }

      const qty = Number(row.quantity) || 0;
      const unitPrice = Number(row.unit_price) || skuMatch.unit_price;
      const totalPrice = Number(row.total_price) || qty * unitPrice;

      if (qty <= 0) { errors.push(`Row ${rowNum}: Invalid quantity: ${qty}`); continue; }

      if (!invoiceGroups.has(invNum)) {
        invoiceGroups.set(invNum, {
          dealerId,
          date,
          terms: String(row.payment_terms || 'net30'),
          items: [],
        });
      }
      invoiceGroups.get(invNum)!.items.push({ skuId: skuMatch.id, qty, unitPrice, totalPrice });
    }

    // Insert invoices
    let invoicesCreated = 0;
    let itemsCreated = 0;
    const skippedDuplicates: string[] = [];

    for (const [invNum, group] of invoiceGroups) {
      // Check for duplicate
      const existing = await getOne('SELECT id FROM invoices WHERE invoice_number = $1', [invNum]);
      if (existing) { skippedDuplicates.push(invNum); continue; }

      const totalAmount = group.items.reduce((s, i) => s + i.totalPrice, 0);

      const invResult = await query(
        `INSERT INTO invoices (invoice_number, dealer_id, invoice_date, total_amount, payment_terms, status)
         VALUES ($1, $2, $3, $4, $5, 'confirmed') RETURNING id`,
        [invNum, group.dealerId, group.date, totalAmount, group.terms]
      );
      const invoiceId = invResult.rows[0].id;
      invoicesCreated++;

      for (const item of group.items) {
        await query(
          `INSERT INTO invoice_items (invoice_id, sku_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [invoiceId, item.skuId, item.qty, item.unitPrice, item.totalPrice]
        );
        itemsCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      invoices_created: invoicesCreated,
      items_created: itemsCreated,
      skipped_duplicates: skippedDuplicates,
      errors,
      mapping: mapping,
      mapping_source: mappingResult.model,
      unmapped_columns: mappingResult.unmapped_columns,
      total_rows_processed: rawRows.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

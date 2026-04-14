import { NextRequest, NextResponse } from 'next/server';
import { query, getOne } from '@/lib/db';
import { mapDealerColumns } from '@/lib/ai-mapper';
import * as XLSX from 'xlsx';

interface ParsedDealer {
  name?: string;
  code?: string;
  firm_name?: string;
  type?: string;
  region?: string;
  state?: string;
  city?: string;
  phone?: string;
  email?: string;
  gst_number?: string;
  pin_code?: string;
}

const validTypes = ['distributor', 'retailer', 'sub_dealer', 'project_dealer', 'wholesaler'];
const validRegions = ['north', 'south', 'east', 'west', 'central'];

function normalizeType(val: string): string {
  const lower = val.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (validTypes.includes(lower)) return lower;
  // Fuzzy match
  if (lower.includes('distrib')) return 'distributor';
  if (lower.includes('retail')) return 'retailer';
  if (lower.includes('sub')) return 'sub_dealer';
  if (lower.includes('project')) return 'project_dealer';
  if (lower.includes('whole')) return 'wholesaler';
  return 'retailer'; // default
}

function normalizeRegion(val: string): string {
  const lower = val.toLowerCase().trim();
  if (validRegions.includes(lower)) return lower;
  // Map states to regions
  const stateRegionMap: Record<string, string> = {
    'delhi': 'north', 'haryana': 'north', 'punjab': 'north', 'up': 'north', 'uttar pradesh': 'north',
    'rajasthan': 'north', 'himachal': 'north', 'j&k': 'north', 'uttarakhand': 'north',
    'tamil nadu': 'south', 'karnataka': 'south', 'kerala': 'south', 'andhra': 'south',
    'telangana': 'south', 'pondicherry': 'south',
    'west bengal': 'east', 'bihar': 'east', 'odisha': 'east', 'jharkhand': 'east', 'assam': 'east',
    'maharashtra': 'west', 'gujarat': 'west', 'goa': 'west',
    'madhya pradesh': 'central', 'chhattisgarh': 'central',
  };
  for (const [state, region] of Object.entries(stateRegionMap)) {
    if (lower.includes(state)) return region;
  }
  return 'north'; // default
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rawRows: Record<string, unknown>[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json();
      rawRows = Array.isArray(body) ? body : body.dealers || body.data || [body];
    } else {
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

    const headers = Object.keys(rawRows[0]);
    const mappingResult = await mapDealerColumns(headers, rawRows);
    const mapping = mappingResult.mapping;

    const mappedRows: ParsedDealer[] = rawRows.map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [srcCol, targetField] of Object.entries(mapping)) {
        if (targetField && targetField !== 'unmapped') {
          mapped[targetField] = row[srcCol];
        }
      }
      return mapped as ParsedDealer;
    });

    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    let rowNum = 0;

    for (const row of mappedRows) {
      rowNum++;
      const name = String(row.name || '').trim();
      if (!name) { errors.push(`Row ${rowNum}: Missing dealer name`); continue; }

      const code = String(row.code || `DLR-${String(rowNum).padStart(3, '0')}`).trim().toUpperCase();
      const type = normalizeType(String(row.type || 'retailer'));
      const region = normalizeRegion(String(row.region || row.state || 'north'));

      // Check for duplicate by code
      const existing = await getOne('SELECT id FROM dealers WHERE code = $1', [code]);

      if (existing) {
        // Update existing dealer
        await query(
          `UPDATE dealers SET name=$1, firm_name=$2, type=$3, region=$4, state=$5, city=$6,
           phone=$7, email=$8, gst_number=$9, pin_code=$10 WHERE id=$11`,
          [
            name,
            String(row.firm_name || name),
            type,
            region,
            String(row.state || ''),
            String(row.city || ''),
            String(row.phone || ''),
            String(row.email || ''),
            String(row.gst_number || ''),
            String(row.pin_code || ''),
            existing.id,
          ]
        );
        updated++;
      } else {
        await query(
          `INSERT INTO dealers (name, code, firm_name, type, region, state, city, phone, email, gst_number, pin_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            name,
            code,
            String(row.firm_name || name),
            type,
            region,
            String(row.state || ''),
            String(row.city || ''),
            String(row.phone || ''),
            String(row.email || ''),
            String(row.gst_number || ''),
            String(row.pin_code || ''),
          ]
        );
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      dealers_created: created,
      dealers_updated: updated,
      errors,
      mapping,
      mapping_source: mappingResult.model,
      unmapped_columns: mappingResult.unmapped_columns,
      total_rows_processed: rawRows.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

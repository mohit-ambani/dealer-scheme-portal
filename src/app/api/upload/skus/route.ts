import { NextRequest, NextResponse } from 'next/server';
import { query, getOne, getAll } from '@/lib/db';
import { mapSKUColumns } from '@/lib/ai-mapper';
import * as XLSX from 'xlsx';

interface ParsedSKU {
  name?: string;
  code?: string;
  category_name?: string;
  category_code?: string;
  unit_price?: number;
  unit?: string;
  hsn_code?: string;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rawRows: Record<string, unknown>[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json();
      rawRows = Array.isArray(body) ? body : body.skus || body.data || [body];
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
    const mappingResult = await mapSKUColumns(headers, rawRows);
    const mapping = mappingResult.mapping;

    const mappedRows: ParsedSKU[] = rawRows.map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [srcCol, targetField] of Object.entries(mapping)) {
        if (targetField && targetField !== 'unmapped') {
          mapped[targetField] = row[srcCol];
        }
      }
      return mapped as ParsedSKU;
    });

    // Load existing categories
    const categories = await getAll('SELECT id, name, code FROM sku_categories');
    const catByName = new Map<string, number>();
    const catByCode = new Map<string, number>();
    for (const c of categories) {
      catByName.set(String(c.name).toLowerCase().trim(), c.id);
      catByCode.set(String(c.code).toLowerCase().trim(), c.id);
    }

    let skusCreated = 0;
    let skusUpdated = 0;
    let categoriesCreated = 0;
    const errors: string[] = [];
    let rowNum = 0;

    for (const row of mappedRows) {
      rowNum++;
      const name = String(row.name || '').trim();
      if (!name) { errors.push(`Row ${rowNum}: Missing SKU name`); continue; }

      const code = String(row.code || `SKU-${String(rowNum).padStart(4, '0')}`).trim().toUpperCase();

      // Resolve or create category
      let categoryId: number = 0;
      if (row.category_code) categoryId = catByCode.get(String(row.category_code).toLowerCase().trim()) || 0;
      if (!categoryId && row.category_name) {
        const catName = String(row.category_name).trim();
        categoryId = catByName.get(catName.toLowerCase()) || 0;
        // Fuzzy match
        if (!categoryId) {
          for (const [existingName, id] of catByName) {
            if (existingName.includes(catName.toLowerCase()) || catName.toLowerCase().includes(existingName)) {
              categoryId = id;
              break;
            }
          }
        }
        // Create new category if not found
        if (!categoryId) {
          const catCode = catName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '') + '-' + String(categoriesCreated + 1);
          const catResult = await query(
            'INSERT INTO sku_categories (name, code) VALUES ($1, $2) RETURNING id',
            [catName, catCode]
          );
          categoryId = catResult.rows[0].id;
          catByName.set(catName.toLowerCase(), categoryId);
          catByCode.set(catCode.toLowerCase(), categoryId);
          categoriesCreated++;
        }
      }
      if (!categoryId) {
        // Default to first category or create "Uncategorized"
        let uncatId = catByName.get('uncategorized') || 0;
        if (!uncatId) {
          const result = await query("INSERT INTO sku_categories (name, code) VALUES ('Uncategorized', 'UNCAT') RETURNING id", []);
          uncatId = result.rows[0].id as number;
          catByName.set('uncategorized', uncatId);
          categoriesCreated++;
        }
        categoryId = uncatId;
      }

      const unitPrice = Number(row.unit_price) || 0;
      const unit = String(row.unit || 'piece').toLowerCase();
      const hsnCode = String(row.hsn_code || '');

      // Check for duplicate by code
      const existing = await getOne('SELECT id FROM skus WHERE code = $1', [code]);

      if (existing) {
        await query(
          `UPDATE skus SET name=$1, category_id=$2, unit_price=$3, unit=$4, hsn_code=$5 WHERE id=$6`,
          [name, categoryId, unitPrice, unit, hsnCode, existing.id]
        );
        skusUpdated++;
      } else {
        await query(
          `INSERT INTO skus (name, code, category_id, unit_price, unit, hsn_code)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [name, code, categoryId, unitPrice, unit, hsnCode]
        );
        skusCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      skus_created: skusCreated,
      skus_updated: skusUpdated,
      categories_created: categoriesCreated,
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

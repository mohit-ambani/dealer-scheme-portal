/**
 * AI-powered column mapping for Excel/JSON uploads.
 * Sends column headers + sample data to GPT-4o / Claude and gets back
 * a mapping from source columns to our target schema fields.
 */

export interface ColumnMapping {
  [sourceColumn: string]: string; // source_col -> target_field
}

export interface MappingResult {
  mapping: ColumnMapping;
  model: string;
  unmapped_columns: string[];
}

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Try OpenAI first
  if (openaiKey && openaiKey !== 'your-openai-api-key-here') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0,
      }),
    });
    if (response.ok) {
      const result = await response.json();
      return result.choices?.[0]?.message?.content || '';
    }
  }

  // Fallback to Anthropic
  if (anthropicKey && anthropicKey !== 'your-anthropic-api-key-here') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (response.ok) {
      const result = await response.json();
      return result.content[0]?.text || '';
    }
  }

  return '';
}

export async function mapInvoiceColumns(
  headers: string[],
  sampleRows: Record<string, unknown>[]
): Promise<MappingResult> {
  const targetFields = [
    'invoice_number - The invoice/bill number (required)',
    'dealer_name - Name of dealer/party/customer (used to lookup dealer)',
    'dealer_code - Code of dealer (alternative to name)',
    'invoice_date - Date of the invoice (required)',
    'sku_name - Name of product/item/SKU (used to lookup SKU)',
    'sku_code - Code of SKU/product (alternative to name)',
    'quantity - Number of units purchased (required for items)',
    'unit_price - Price per unit (required for items)',
    'total_price - Total line amount (optional, can be calculated)',
    'payment_terms - Payment terms like net30, net60',
    'hsn_code - HSN code of the item',
    'gst_number - GST number of dealer',
  ];

  const systemPrompt = `You are a data mapping expert. Given Excel column headers and sample data, map each source column to the closest target field.

Target fields:
${targetFields.join('\n')}

RULES:
- Map EVERY source column that has a reasonable match to a target field
- If a column doesn't match any target, mark it as "unmapped"
- Be smart about abbreviations: "Inv No" = invoice_number, "Qty" = quantity, "Amt" = total_price
- Be smart about Indian business terms: "Party" = dealer_name, "Rate" = unit_price, "Bill" = invoice
- Return ONLY valid JSON, no markdown

Return JSON: { "mapping": { "Source Column": "target_field", ... }, "unmapped": ["col1", ...] }`;

  const userMessage = `Headers: ${JSON.stringify(headers)}
Sample data (first 3 rows): ${JSON.stringify(sampleRows.slice(0, 3), null, 2)}`;

  const text = await callAI(systemPrompt, userMessage);
  if (!text) {
    return { mapping: guessInvoiceMapping(headers), model: 'fallback', unmapped_columns: [] };
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { mapping: guessInvoiceMapping(headers), model: 'fallback', unmapped_columns: [] };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    mapping: parsed.mapping || {},
    model: 'ai',
    unmapped_columns: parsed.unmapped || [],
  };
}

export async function mapDealerColumns(
  headers: string[],
  sampleRows: Record<string, unknown>[]
): Promise<MappingResult> {
  const targetFields = [
    'name - Dealer/contact name (required)',
    'code - Unique dealer code (required)',
    'firm_name - Business/firm/company name',
    'type - Dealer type: distributor, retailer, sub_dealer, project_dealer, wholesaler',
    'region - Region: north, south, east, west, central',
    'state - State name',
    'city - City name',
    'phone - Phone/mobile number',
    'email - Email address',
    'gst_number - GST number',
    'pin_code - PIN/ZIP code',
  ];

  const systemPrompt = `You are a data mapping expert. Map Excel columns to target dealer fields.

Target fields:
${targetFields.join('\n')}

RULES:
- Map EVERY source column with a reasonable match
- "unmapped" for columns with no match
- Indian terms: "Mobile" = phone, "GST"/"GSTIN" = gst_number, "Pincode" = pin_code
- If a column contains type info like "Distributor"/"Retailer", map to "type"
- Return ONLY valid JSON

Return JSON: { "mapping": { "Source Column": "target_field", ... }, "unmapped": ["col1", ...] }`;

  const userMessage = `Headers: ${JSON.stringify(headers)}
Sample data (first 3 rows): ${JSON.stringify(sampleRows.slice(0, 3), null, 2)}`;

  const text = await callAI(systemPrompt, userMessage);
  if (!text) {
    return { mapping: guessDealerMapping(headers), model: 'fallback', unmapped_columns: [] };
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { mapping: guessDealerMapping(headers), model: 'fallback', unmapped_columns: [] };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    mapping: parsed.mapping || {},
    model: 'ai',
    unmapped_columns: parsed.unmapped || [],
  };
}

export async function mapSKUColumns(
  headers: string[],
  sampleRows: Record<string, unknown>[]
): Promise<MappingResult> {
  const targetFields = [
    'name - Product/SKU name (required)',
    'code - Unique SKU/product code (required)',
    'category_name - Category name (used to lookup or create category)',
    'category_code - Category code (alternative to name)',
    'unit_price - MRP/selling price per unit',
    'unit - Unit of measurement (piece, meter, box, etc)',
    'hsn_code - HSN/SAC code',
  ];

  const systemPrompt = `You are a data mapping expert. Map Excel columns to target SKU/product fields.

Target fields:
${targetFields.join('\n')}

RULES:
- Map EVERY source column with a reasonable match
- "unmapped" for columns with no match
- "MRP"/"Price"/"Rate" = unit_price, "HSN" = hsn_code, "UOM" = unit
- "Category"/"Group"/"Product Group" = category_name
- Return ONLY valid JSON

Return JSON: { "mapping": { "Source Column": "target_field", ... }, "unmapped": ["col1", ...] }`;

  const userMessage = `Headers: ${JSON.stringify(headers)}
Sample data (first 3 rows): ${JSON.stringify(sampleRows.slice(0, 3), null, 2)}`;

  const text = await callAI(systemPrompt, userMessage);
  if (!text) {
    return { mapping: guessSKUMapping(headers), model: 'fallback', unmapped_columns: [] };
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { mapping: guessSKUMapping(headers), model: 'fallback', unmapped_columns: [] };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    mapping: parsed.mapping || {},
    model: 'ai',
    unmapped_columns: parsed.unmapped || [],
  };
}

// Fallback heuristic mapping when AI is unavailable
function guessInvoiceMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const h of headers) {
    const l = lower(h);
    if (l.includes('invoice') && (l.includes('no') || l.includes('num') || l.includes('number')) || l === 'billno' || l === 'invno') mapping[h] = 'invoice_number';
    else if (l.includes('dealer') && l.includes('name') || l === 'party' || l === 'partyname' || l === 'customer' || l === 'customername') mapping[h] = 'dealer_name';
    else if (l.includes('dealer') && l.includes('code') || l === 'partycode') mapping[h] = 'dealer_code';
    else if (l.includes('date') || l === 'billdate' || l === 'invoicedate') mapping[h] = 'invoice_date';
    else if (l.includes('sku') && l.includes('name') || l === 'product' || l === 'productname' || l === 'item' || l === 'itemname' || l === 'description') mapping[h] = 'sku_name';
    else if (l.includes('sku') && l.includes('code') || l === 'productcode' || l === 'itemcode') mapping[h] = 'sku_code';
    else if (l === 'qty' || l === 'quantity' || l === 'units') mapping[h] = 'quantity';
    else if (l === 'rate' || l === 'unitprice' || l === 'price' || l === 'mrp') mapping[h] = 'unit_price';
    else if (l === 'amount' || l === 'total' || l === 'totalamount' || l === 'totalprice' || l === 'netamount') mapping[h] = 'total_price';
    else if (l.includes('payment') || l.includes('terms')) mapping[h] = 'payment_terms';
    else if (l.includes('hsn')) mapping[h] = 'hsn_code';
    else if (l.includes('gst')) mapping[h] = 'gst_number';
  }
  return mapping;
}

function guessDealerMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const h of headers) {
    const l = lower(h);
    if (l === 'name' || l === 'dealername' || l === 'contactname') mapping[h] = 'name';
    else if (l === 'code' || l === 'dealercode') mapping[h] = 'code';
    else if (l.includes('firm') || l.includes('company') || l.includes('business')) mapping[h] = 'firm_name';
    else if (l === 'type' || l === 'dealertype' || l === 'channel') mapping[h] = 'type';
    else if (l === 'region' || l === 'zone') mapping[h] = 'region';
    else if (l === 'state') mapping[h] = 'state';
    else if (l === 'city' || l === 'town') mapping[h] = 'city';
    else if (l === 'phone' || l === 'mobile' || l === 'contact' || l === 'mobileno') mapping[h] = 'phone';
    else if (l === 'email' || l === 'emailid') mapping[h] = 'email';
    else if (l.includes('gst') || l.includes('gstin')) mapping[h] = 'gst_number';
    else if (l.includes('pin') || l.includes('zip') || l === 'pincode') mapping[h] = 'pin_code';
  }
  return mapping;
}

function guessSKUMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const h of headers) {
    const l = lower(h);
    if (l === 'name' || l === 'productname' || l === 'skuname' || l === 'itemname') mapping[h] = 'name';
    else if (l === 'code' || l === 'productcode' || l === 'skucode' || l === 'itemcode') mapping[h] = 'code';
    else if (l.includes('category') || l.includes('group') || l === 'productgroup') mapping[h] = 'category_name';
    else if (l === 'price' || l === 'mrp' || l === 'unitprice' || l === 'rate') mapping[h] = 'unit_price';
    else if (l === 'unit' || l === 'uom') mapping[h] = 'unit';
    else if (l.includes('hsn') || l.includes('sac')) mapping[h] = 'hsn_code';
  }
  return mapping;
}

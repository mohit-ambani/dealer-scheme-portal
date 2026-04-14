import { NextRequest, NextResponse } from 'next/server';
import { getAll, getOne } from '@/lib/db';
import { calculateSchemeForDealer } from '@/lib/scheme-engine';
import * as XLSX from 'xlsx';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const schemeId = parseInt(id);

    // Fetch scheme details
    const scheme = await getOne('SELECT * FROM schemes WHERE id = $1', [schemeId]);
    if (!scheme) {
      return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
    }

    // Fetch scheme rules with category/SKU names
    const rules = await getAll(
      `SELECT sr.*, sc.name as category_name, s.name as sku_name
       FROM scheme_rules sr
       LEFT JOIN sku_categories sc ON sr.sku_category_id = sc.id
       LEFT JOIN skus s ON sr.sku_id = s.id
       WHERE sr.scheme_id = $1
       ORDER BY sr.rule_order`,
      [schemeId]
    );

    // Fetch all SKU categories for breakdown
    const allCategories = await getAll('SELECT id, name, code FROM sku_categories ORDER BY name');

    // Find applicable dealers
    const regions = scheme.applicable_regions || [];
    const dealerTypes = scheme.applicable_dealer_types || [];

    let dealerQuery = 'SELECT * FROM dealers WHERE is_active = true';
    const dealerParams: unknown[] = [];
    let paramIndex = 1;

    if (regions.length > 0) {
      dealerQuery += ` AND region = ANY($${paramIndex})`;
      dealerParams.push(regions);
      paramIndex++;
    }
    if (dealerTypes.length > 0) {
      dealerQuery += ` AND type = ANY($${paramIndex})`;
      dealerParams.push(dealerTypes);
      paramIndex++;
    }
    dealerQuery += ' ORDER BY name';

    const dealers = await getAll(dealerQuery, dealerParams);

    // Calculate scheme for each dealer
    const overviewRows: Record<string, unknown>[] = [];
    const categoryBreakdownRows: Record<string, unknown>[] = [];
    const ruleDetailRows: Record<string, unknown>[] = [];
    const invoiceDetailRows: Record<string, unknown>[] = [];

    for (const dealer of dealers) {
      try {
        const result = await calculateSchemeForDealer(schemeId, dealer.id);

        // -- Sheet 1: Overview --
        const rulesAchieved = result.rules.filter(r => r.target_met).length;
        const totalRules = result.rules.length;
        const bonusesAchieved = result.bonuses.filter(b => b.achieved).length;

        overviewRows.push({
          'Dealer Code': dealer.code,
          'Dealer Name': dealer.name,
          'Firm Name': dealer.firm_name || '',
          'Type': String(dealer.type).replaceAll('_', ' '),
          'Region': dealer.region,
          'City': dealer.city || '',
          'State': dealer.state || '',
          'Rules Achieved': `${rulesAchieved} / ${totalRules}`,
          'Completion %': totalRules > 0 ? Math.round((rulesAchieved / totalRules) * 100) : 0,
          'Bonuses Earned': `${bonusesAchieved} / ${result.bonuses.length}`,
          'Total Incentive (Rs)': result.total_incentive,
          'Incentive Type': String(scheme.incentive_type).replaceAll('_', ' '),
          'Status': rulesAchieved === totalRules ? 'FULLY ACHIEVED' : rulesAchieved > 0 ? 'PARTIALLY ACHIEVED' : 'NOT STARTED',
        });

        // -- Sheet 2: SKU Category Breakdown --
        // For each category, compute how much the dealer has purchased within scheme period
        const invoiceItems = await getAll(
          `SELECT ii.*, s.name as sku_name, s.code as sku_code, s.category_id,
                  sc.name as category_name, i.invoice_date
           FROM invoice_items ii
           JOIN skus s ON ii.sku_id = s.id
           JOIN sku_categories sc ON s.category_id = sc.id
           JOIN invoices i ON ii.invoice_id = i.id
           WHERE i.dealer_id = $1
             AND i.invoice_date >= $2
             AND i.invoice_date <= $3
             AND i.status = 'confirmed'
           ORDER BY sc.name, s.name`,
          [dealer.id, scheme.start_date, scheme.end_date]
        );

        // Aggregate by category
        const catAgg: Record<number, { name: string; totalQty: number; totalValue: number }> = {};
        for (const item of invoiceItems) {
          if (!catAgg[item.category_id]) {
            catAgg[item.category_id] = { name: item.category_name, totalQty: 0, totalValue: 0 };
          }
          catAgg[item.category_id].totalQty += Number(item.quantity);
          catAgg[item.category_id].totalValue += Number(item.total_price);
        }

        for (const cat of allCategories) {
          const agg = catAgg[cat.id];
          // Find rules targeting this category
          const catRules = result.rules.filter(r => {
            const matchingRule = rules.find(sr => sr.id === r.rule_id);
            return matchingRule && Number(matchingRule.sku_category_id) === cat.id;
          });

          const catTarget = catRules.length > 0
            ? catRules.reduce((sum, r) => sum + r.target, 0)
            : 0;
          const catAchieved = catRules.length > 0
            ? catRules.reduce((sum, r) => sum + (r.condition_type === 'value' ? r.achieved_value : r.achieved_quantity), 0)
            : 0;
          const catIncentive = catRules.reduce((sum, r) => sum + r.incentive_earned, 0);
          const catProgress = catRules.length > 0
            ? catRules.reduce((sum, r) => sum + r.progress_percentage, 0) / catRules.length
            : 0;

          categoryBreakdownRows.push({
            'Dealer Code': dealer.code,
            'Dealer Name': dealer.name,
            'SKU Category': cat.name,
            'Total Quantity Purchased': agg ? agg.totalQty : 0,
            'Total Value Purchased (Rs)': agg ? Math.round(agg.totalValue) : 0,
            'Scheme Target': catTarget > 0 ? catTarget : 'N/A',
            'Target Achieved': catTarget > 0 ? catAchieved : 'N/A',
            'Progress %': catTarget > 0 ? Math.round(catProgress) : 'N/A',
            'Pending': catTarget > 0 ? Math.max(0, catTarget - catAchieved) : 'N/A',
            'Incentive Earned (Rs)': catIncentive,
            'Status': catRules.length === 0
              ? 'No Rule'
              : catRules.every(r => r.target_met)
                ? 'ACHIEVED'
                : catProgress > 0
                  ? 'IN PROGRESS'
                  : 'NOT STARTED',
          });
        }

        // -- Sheet 3: Rule-wise Detail --
        for (const rule of result.rules) {
          const matchingRule = rules.find(sr => sr.id === rule.rule_id);
          ruleDetailRows.push({
            'Dealer Code': dealer.code,
            'Dealer Name': dealer.name,
            'Rule #': matchingRule ? matchingRule.rule_order : '',
            'Rule Name': rule.rule_name,
            'Category/SKU': matchingRule
              ? (matchingRule.category_name || matchingRule.sku_name || 'All')
              : '',
            'Condition': rule.condition_type === 'value' ? 'Value Based' : 'Quantity Based',
            'Target': rule.target,
            'Achieved Value (Rs)': Math.round(rule.achieved_value),
            'Achieved Quantity': rule.achieved_quantity,
            'Progress %': Math.round(rule.progress_percentage),
            'Pending': rule.condition_type === 'value'
              ? Math.max(0, Math.round(rule.target - rule.achieved_value))
              : Math.max(0, rule.target - rule.achieved_quantity),
            'Target Met': rule.target_met ? 'YES' : 'NO',
            'Incentive Earned (Rs)': rule.incentive_earned,
            'Calculation': rule.incentive_breakdown,
            'Invoices Count': rule.matching_invoices.length,
          });

          // -- Sheet 4: Invoice Details --
          for (const inv of rule.matching_invoices) {
            invoiceDetailRows.push({
              'Dealer Code': dealer.code,
              'Dealer Name': dealer.name,
              'Rule Name': rule.rule_name,
              'Invoice Number': inv.invoice_number,
              'Invoice Date': inv.invoice_date,
              'SKU': inv.sku_name,
              'Quantity': inv.quantity,
              'Value (Rs)': inv.value,
            });
          }
        }
      } catch {
        overviewRows.push({
          'Dealer Code': dealer.code,
          'Dealer Name': dealer.name,
          'Firm Name': dealer.firm_name || '',
          'Type': String(dealer.type).replaceAll('_', ' '),
          'Region': dealer.region,
          'City': dealer.city || '',
          'State': dealer.state || '',
          'Rules Achieved': 'Error',
          'Completion %': 0,
          'Bonuses Earned': '-',
          'Total Incentive (Rs)': 0,
          'Incentive Type': String(scheme.incentive_type).replaceAll('_', ' '),
          'Status': 'CALCULATION ERROR',
        });
      }
    }

    // Build Excel workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Overview
    const ws1 = XLSX.utils.json_to_sheet(overviewRows);
    setColumnWidths(ws1, overviewRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Dealer Overview');

    // Sheet 2: Category Breakdown
    const ws2 = XLSX.utils.json_to_sheet(categoryBreakdownRows);
    setColumnWidths(ws2, categoryBreakdownRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'SKU Category Breakdown');

    // Sheet 3: Rule Details
    const ws3 = XLSX.utils.json_to_sheet(ruleDetailRows);
    setColumnWidths(ws3, ruleDetailRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Rule-wise Details');

    // Sheet 4: Invoice Details
    if (invoiceDetailRows.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(invoiceDetailRows);
      setColumnWidths(ws4, invoiceDetailRows);
      XLSX.utils.book_append_sheet(wb, ws4, 'Invoice Mapping');
    }

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `${scheme.scheme_code || 'Scheme-' + schemeId}_Dealer_Report.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function setColumnWidths(ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  ws['!cols'] = keys.map(key => {
    let maxLen = key.length;
    for (const row of rows.slice(0, 50)) {
      const val = String(row[key] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    }
    return { wch: Math.min(maxLen + 2, 40) };
  });
}

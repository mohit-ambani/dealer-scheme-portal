/**
 * Shared dealer analytics — reusable queries for intelligence hub & AI builder.
 */
import { getAll, getOne } from './db';

export async function getDealerFull(dealerId: number) {
  return getOne('SELECT * FROM dealers WHERE id = $1', [dealerId]);
}

export async function getDealerMonthlyTrends(dealerId: number, months = 12) {
  return getAll(`
    SELECT DATE_TRUNC('month', i.invoice_date)::date as month,
           SUM(i.total_amount)::numeric as revenue,
           COUNT(*)::int as invoice_count,
           SUM(ii_agg.total_qty)::int as total_units
    FROM invoices i
    LEFT JOIN (SELECT invoice_id, SUM(quantity) as total_qty FROM invoice_items GROUP BY invoice_id) ii_agg ON ii_agg.invoice_id = i.id
    WHERE i.dealer_id = $1 AND i.status = 'confirmed'
      AND i.invoice_date >= NOW() - ($2 || ' months')::interval
    GROUP BY DATE_TRUNC('month', i.invoice_date)
    ORDER BY month`, [dealerId, months]);
}

export async function getDealerCategoryBreakdown(dealerId: number) {
  return getAll(`
    SELECT sc.id as category_id, sc.name as category, sc.code,
           COALESCE(SUM(d.total_price), 0)::numeric as total_value,
           COALESCE(SUM(d.quantity), 0)::int as total_qty,
           COUNT(DISTINCT d.invoice_id)::int as invoice_count
    FROM sku_categories sc
    LEFT JOIN (
      SELECT s.category_id, ii.total_price, ii.quantity, i.id as invoice_id
      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
      JOIN skus s ON s.id = ii.sku_id
      WHERE i.dealer_id = $1 AND i.status = 'confirmed'
    ) d ON d.category_id = sc.id
    GROUP BY sc.id, sc.name, sc.code
    ORDER BY total_value DESC`, [dealerId]);
}

export async function getDealerSchemeProgress(dealerId: number) {
  return getAll(`
    WITH rule_data AS (
      SELECT
        s.id as scheme_id, s.name as scheme_name, s.status as scheme_status,
        s.start_date, s.end_date, s.incentive_type,
        sr.id as rule_id, sr.rule_name, sr.condition_type, sr.min_threshold, sr.max_threshold,
        sr.incentive_calc_type, sr.incentive_value, sr.is_additional, sr.apply_on, sr.description,
        dsp.progress_percentage, dsp.target_achieved, dsp.incentive_earned,
        dsp.current_value, dsp.current_quantity,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', ss.id,
            'slab_from', ss.slab_from,
            'slab_to', ss.slab_to,
            'incentive_calc_type', ss.incentive_calc_type,
            'incentive_value', ss.incentive_value
          ) ORDER BY ss.slab_from)
          FROM scheme_slabs ss WHERE ss.rule_id = sr.id
        ), '[]'::json) as slabs
      FROM schemes s
      LEFT JOIN scheme_rules sr ON sr.scheme_id = s.id
      LEFT JOIN dealer_scheme_progress dsp ON dsp.scheme_id = s.id AND dsp.rule_id = sr.id AND dsp.dealer_id = $1
      WHERE s.status = 'active'
        AND (s.applicable_regions::jsonb ? (SELECT region FROM dealers WHERE id = $1))
        AND (s.applicable_dealer_types::jsonb ? (SELECT type FROM dealers WHERE id = $1))
    )
    SELECT scheme_id, scheme_name, scheme_status, start_date, end_date, incentive_type,
      COALESCE(json_agg(json_build_object(
        'rule_id', rule_id,
        'rule_name', rule_name,
        'condition_type', condition_type,
        'min_threshold', min_threshold,
        'max_threshold', max_threshold,
        'incentive_calc_type', incentive_calc_type,
        'incentive_value', incentive_value,
        'is_additional', is_additional,
        'apply_on', apply_on,
        'description', description,
        'progress', COALESCE(progress_percentage, 0),
        'achieved', COALESCE(target_achieved, false),
        'earned', COALESCE(incentive_earned, 0),
        'current_value', COALESCE(current_value, 0),
        'current_quantity', COALESCE(current_quantity, 0),
        'slabs', slabs
      )) FILTER (WHERE rule_id IS NOT NULL), '[]') as rules,
      COALESCE(SUM(incentive_earned), 0)::numeric as total_earned
    FROM rule_data
    GROUP BY scheme_id, scheme_name, scheme_status, start_date, end_date, incentive_type
    ORDER BY start_date DESC`, [dealerId]);
}

export async function getDealerInvoices(dealerId: number, limit = 20) {
  return getAll(`
    SELECT i.id, i.invoice_number, i.invoice_date, i.total_amount, i.status,
           COUNT(ii.id)::int as item_count
    FROM invoices i
    LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.dealer_id = $1
    GROUP BY i.id, i.invoice_number, i.invoice_date, i.total_amount, i.status
    ORDER BY i.invoice_date DESC
    LIMIT $2`, [dealerId, limit]);
}

export async function getDealerNotes(dealerId: number) {
  return getAll('SELECT * FROM dealer_notes WHERE dealer_id = $1 ORDER BY created_at DESC', [dealerId]);
}

export async function getRegionStats() {
  const revenue = await getAll(`
    SELECT d.region,
           COUNT(DISTINCT d.id)::int as dealer_count,
           COALESCE(SUM(i.total_amount), 0)::numeric as total_revenue,
           COUNT(DISTINCT i.id)::int as invoice_count
    FROM dealers d
    LEFT JOIN invoices i ON i.dealer_id = d.id AND i.status = 'confirmed'
    WHERE d.is_active = true
    GROUP BY d.region`);

  const progress = await getAll(`
    SELECT d.region,
           COUNT(*)::int as total_rules,
           COUNT(*) FILTER (WHERE dsp.target_achieved = true)::int as achieved_count,
           COALESCE(SUM(dsp.incentive_earned), 0)::numeric as total_incentive
    FROM dealer_scheme_progress dsp
    JOIN dealers d ON dsp.dealer_id = d.id
    GROUP BY d.region`);

  const categories = await getAll(`
    SELECT d.region, sc.name as category,
           COALESCE(SUM(ii.total_price), 0)::numeric as revenue
    FROM dealers d
    JOIN invoices i ON i.dealer_id = d.id AND i.status = 'confirmed'
    JOIN invoice_items ii ON ii.invoice_id = i.id
    JOIN skus s ON s.id = ii.sku_id
    JOIN sku_categories sc ON sc.id = s.category_id
    WHERE d.is_active = true
    GROUP BY d.region, sc.name
    ORDER BY d.region, revenue DESC`);

  const topDealers = await getAll(`
    SELECT d.region, d.id, d.name, d.firm_name, d.type,
           COALESCE(SUM(i.total_amount), 0)::numeric as total_purchase
    FROM dealers d
    LEFT JOIN invoices i ON i.dealer_id = d.id AND i.status = 'confirmed'
    WHERE d.is_active = true
    GROUP BY d.region, d.id, d.name, d.firm_name, d.type
    ORDER BY d.region, total_purchase DESC`);

  // Assemble per-region
  const regions: Record<string, {
    dealer_count: number; total_revenue: number; invoice_count: number;
    scheme_completion_pct: number; total_incentive: number;
    top_dealers: { id: number; name: string; firm_name: string; type: string; total_purchase: number }[];
    category_breakdown: { category: string; revenue: number }[];
  }> = {};

  for (const r of revenue) {
    regions[r.region] = {
      dealer_count: r.dealer_count, total_revenue: Number(r.total_revenue), invoice_count: r.invoice_count,
      scheme_completion_pct: 0, total_incentive: 0, top_dealers: [], category_breakdown: [],
    };
  }
  for (const p of progress) {
    if (regions[p.region]) {
      regions[p.region].scheme_completion_pct = p.total_rules > 0 ? Math.round((p.achieved_count / p.total_rules) * 100) : 0;
      regions[p.region].total_incentive = Number(p.total_incentive);
    }
  }
  for (const c of categories) {
    if (regions[c.region]) {
      regions[c.region].category_breakdown.push({ category: c.category, revenue: Number(c.revenue) });
    }
  }
  for (const d of topDealers) {
    if (regions[d.region] && regions[d.region].top_dealers.length < 5) {
      regions[d.region].top_dealers.push({
        id: d.id, name: d.name, firm_name: d.firm_name, type: d.type, total_purchase: Number(d.total_purchase),
      });
    }
  }

  return regions;
}

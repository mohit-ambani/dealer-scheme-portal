import { Pool, QueryResult } from 'pg';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'greatwhite_schemes',
      password: '',
      port: 5432,
    });

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function getOne(text: string, params?: unknown[]) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

export async function getAll(text: string, params?: unknown[]) {
  const result = await query(text, params);
  return result.rows;
}

export async function initializeDatabase() {
  await query(`
    -- SKU Categories
    CREATE TABLE IF NOT EXISTS sku_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- SKU Master
    CREATE TABLE IF NOT EXISTS skus (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      category_id INTEGER REFERENCES sku_categories(id),
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'piece',
      hsn_code TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Dealer Master
    CREATE TABLE IF NOT EXISTS dealers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      firm_name TEXT,
      type TEXT NOT NULL CHECK(type IN ('distributor','retailer','sub_dealer','project_dealer','wholesaler')),
      region TEXT NOT NULL CHECK(region IN ('north','south','east','west','central')),
      state TEXT,
      city TEXT,
      phone TEXT,
      email TEXT,
      gst_number TEXT,
      pin_code TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Invoices
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      dealer_id INTEGER NOT NULL REFERENCES dealers(id),
      invoice_date DATE NOT NULL,
      total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      payment_terms TEXT DEFAULT 'net30',
      status TEXT DEFAULT 'confirmed' CHECK(status IN ('draft','confirmed','cancelled')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Invoice Line Items
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      sku_id INTEGER NOT NULL REFERENCES skus(id),
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12,2) NOT NULL,
      total_price NUMERIC(14,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Schemes
    CREATE TABLE IF NOT EXISTS schemes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      scheme_code TEXT UNIQUE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('draft','active','paused','expired','cancelled')),
      applicable_regions JSONB NOT NULL DEFAULT '[]',
      applicable_dealer_types JSONB NOT NULL DEFAULT '[]',
      incentive_type TEXT NOT NULL CHECK(incentive_type IN ('gift','voucher','credit_note')),
      is_backdated BOOLEAN DEFAULT false,
      created_date DATE DEFAULT CURRENT_DATE,
      ai_prompt TEXT,
      ai_model TEXT,
      calculation_logic TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Scheme Rules
    CREATE TABLE IF NOT EXISTS scheme_rules (
      id SERIAL PRIMARY KEY,
      scheme_id INTEGER NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
      rule_order INTEGER NOT NULL DEFAULT 1,
      rule_name TEXT NOT NULL,
      sku_category_id INTEGER REFERENCES sku_categories(id),
      sku_id INTEGER REFERENCES skus(id),
      condition_type TEXT NOT NULL CHECK(condition_type IN ('value','quantity')),
      min_threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
      max_threshold NUMERIC(14,2),
      incentive_calc_type TEXT NOT NULL CHECK(incentive_calc_type IN ('percentage','per_unit','fixed','slab')),
      incentive_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      is_additional BOOLEAN DEFAULT false,
      apply_on TEXT DEFAULT 'above_threshold' CHECK(apply_on IN ('all','above_threshold','total')),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Scheme Slabs
    CREATE TABLE IF NOT EXISTS scheme_slabs (
      id SERIAL PRIMARY KEY,
      rule_id INTEGER NOT NULL REFERENCES scheme_rules(id) ON DELETE CASCADE,
      slab_from NUMERIC(14,2) NOT NULL,
      slab_to NUMERIC(14,2),
      incentive_calc_type TEXT NOT NULL CHECK(incentive_calc_type IN ('percentage','per_unit','fixed')),
      incentive_value NUMERIC(12,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Scheme Bonus Rules
    CREATE TABLE IF NOT EXISTS scheme_bonus_rules (
      id SERIAL PRIMARY KEY,
      scheme_id INTEGER NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
      bonus_name TEXT NOT NULL,
      required_rule_ids JSONB NOT NULL DEFAULT '[]',
      bonus_calc_type TEXT NOT NULL CHECK(bonus_calc_type IN ('percentage','per_unit','fixed')),
      bonus_value NUMERIC(12,2) NOT NULL,
      apply_on TEXT DEFAULT 'total_purchase' CHECK(apply_on IN ('total_purchase','total_incentive','specific_category')),
      description TEXT,
      min_threshold NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Dealer Scheme Progress
    CREATE TABLE IF NOT EXISTS dealer_scheme_progress (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL REFERENCES dealers(id),
      scheme_id INTEGER NOT NULL REFERENCES schemes(id),
      rule_id INTEGER NOT NULL REFERENCES scheme_rules(id),
      current_value NUMERIC(14,2) DEFAULT 0,
      current_quantity INTEGER DEFAULT 0,
      target_achieved BOOLEAN DEFAULT false,
      incentive_earned NUMERIC(14,2) DEFAULT 0,
      progress_percentage NUMERIC(5,2) DEFAULT 0,
      last_calculated TIMESTAMPTZ,
      UNIQUE(dealer_id, scheme_id, rule_id)
    );

    -- Dealer Bonus Progress
    CREATE TABLE IF NOT EXISTS dealer_bonus_progress (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL REFERENCES dealers(id),
      scheme_id INTEGER NOT NULL REFERENCES schemes(id),
      bonus_rule_id INTEGER NOT NULL REFERENCES scheme_bonus_rules(id),
      achieved BOOLEAN DEFAULT false,
      bonus_earned NUMERIC(14,2) DEFAULT 0,
      last_calculated TIMESTAMPTZ,
      UNIQUE(dealer_id, scheme_id, bonus_rule_id)
    );

    -- Invoice-to-Scheme Mapping
    CREATE TABLE IF NOT EXISTS scheme_invoice_mapping (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL REFERENCES dealers(id),
      scheme_id INTEGER NOT NULL REFERENCES schemes(id),
      rule_id INTEGER NOT NULL REFERENCES scheme_rules(id),
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      invoice_item_id INTEGER NOT NULL REFERENCES invoice_items(id),
      contributing_value NUMERIC(14,2) DEFAULT 0,
      contributing_quantity INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Incentives (downloadable)
    CREATE TABLE IF NOT EXISTS incentives (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL REFERENCES dealers(id),
      scheme_id INTEGER NOT NULL REFERENCES schemes(id),
      type TEXT NOT NULL CHECK(type IN ('gift','voucher','credit_note')),
      amount NUMERIC(14,2) NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','issued','redeemed','expired')),
      issued_date DATE,
      valid_until DATE,
      download_token TEXT UNIQUE,
      certificate_data TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Calculation Logs
    CREATE TABLE IF NOT EXISTS calculation_logs (
      id SERIAL PRIMARY KEY,
      scheme_id INTEGER NOT NULL REFERENCES schemes(id),
      dealer_id INTEGER REFERENCES dealers(id),
      calculation_type TEXT NOT NULL CHECK(calculation_type IN ('full','incremental','backdated')),
      invoices_processed INTEGER DEFAULT 0,
      total_incentive_calculated NUMERIC(14,2) DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      status TEXT DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Dealer Notes (CRM / Salesperson context)
    CREATE TABLE IF NOT EXISTS dealer_notes (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL REFERENCES dealers(id),
      author_role TEXT NOT NULL CHECK(author_role IN ('admin','salesperson')),
      author_name TEXT,
      note_type TEXT DEFAULT 'general' CHECK(note_type IN ('general','territory','performance','visit','complaint','opportunity')),
      content TEXT NOT NULL,
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Dealer Intelligence Cache (AI-generated profiles)
    CREATE TABLE IF NOT EXISTS dealer_intelligence_cache (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL REFERENCES dealers(id) UNIQUE,
      profile_data JSONB NOT NULL DEFAULT '{}',
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      model_used TEXT,
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
    );

    -- Territory Comments (admin territory context)
    CREATE TABLE IF NOT EXISTS territory_comments (
      id SERIAL PRIMARY KEY,
      region TEXT NOT NULL CHECK(region IN ('north','south','east','west','central')),
      state TEXT,
      comment TEXT NOT NULL,
      author_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_dealer_notes_dealer ON dealer_notes(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_territory_comments_region ON territory_comments(region);
    CREATE INDEX IF NOT EXISTS idx_dealers_region_type ON dealers(region, type);
    CREATE INDEX IF NOT EXISTS idx_invoices_dealer ON invoices(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_sku ON invoice_items(sku_id);
    CREATE INDEX IF NOT EXISTS idx_scheme_rules_scheme ON scheme_rules(scheme_id);
    CREATE INDEX IF NOT EXISTS idx_dealer_progress_dealer ON dealer_scheme_progress(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_dealer_progress_scheme ON dealer_scheme_progress(scheme_id);
    CREATE INDEX IF NOT EXISTS idx_scheme_invoice_map ON scheme_invoice_mapping(dealer_id, scheme_id);
    CREATE INDEX IF NOT EXISTS idx_incentives_dealer ON incentives(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_schemes_dates ON schemes(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_schemes_status ON schemes(status);
  `);
}

export default pool;

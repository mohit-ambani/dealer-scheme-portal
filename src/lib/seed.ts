import { query, getAll, initializeDatabase } from './db';

export async function seedDatabase() {
  await initializeDatabase();

  // Check if already seeded
  const existing = await getAll('SELECT COUNT(*) as count FROM sku_categories');
  if (existing[0]?.count > 0) {
    console.log('Database already seeded');
    return;
  }

  // ===== SKU CATEGORIES =====
  const categories = [
    { name: 'Modular Switches', code: 'MOD-SW', description: 'Premium modular switches and accessories' },
    { name: 'Sockets & Outlets', code: 'SOCK', description: 'Power sockets, USB outlets, and multi-function outlets' },
    { name: 'MCB & Distribution', code: 'MCB-DB', description: 'Miniature circuit breakers and distribution boards' },
    { name: 'Wires & Cables', code: 'WIRE', description: 'House wiring, flexible cables, and industrial wires' },
    { name: 'LED Lighting', code: 'LED', description: 'LED panels, bulbs, battens, and downlights' },
    { name: 'Fans', code: 'FAN', description: 'Ceiling fans, exhaust fans, and pedestal fans' },
    { name: 'Conduit & Accessories', code: 'COND', description: 'PVC conduits, junction boxes, and accessories' },
    { name: 'Smart Home', code: 'SMART', description: 'WiFi switches, smart plugs, and home automation' },
  ];

  for (const cat of categories) {
    await query(
      'INSERT INTO sku_categories (name, code, description) VALUES ($1, $2, $3)',
      [cat.name, cat.code, cat.description]
    );
  }

  // ===== SKUs =====
  const skus = [
    // Modular Switches (cat 1)
    { name: 'GW 1M Switch 6A', code: 'GW-SW-1M-6A', category_id: 1, unit_price: 45, hsn: '8536' },
    { name: 'GW 2M Switch 16A', code: 'GW-SW-2M-16A', category_id: 1, unit_price: 85, hsn: '8536' },
    { name: 'GW Dimmer 400W', code: 'GW-DIM-400W', category_id: 1, unit_price: 320, hsn: '8536' },
    { name: 'GW Bell Push', code: 'GW-BELL-PUSH', category_id: 1, unit_price: 55, hsn: '8536' },
    { name: 'GW Piano Switch 1M', code: 'GW-PIANO-1M', category_id: 1, unit_price: 95, hsn: '8536' },
    { name: 'GW Indicator LED', code: 'GW-IND-LED', category_id: 1, unit_price: 40, hsn: '8536' },
    // Sockets (cat 2)
    { name: 'GW 6A 3-Pin Socket', code: 'GW-SK-6A-3P', category_id: 2, unit_price: 65, hsn: '8536' },
    { name: 'GW 16A 3-Pin Socket', code: 'GW-SK-16A-3P', category_id: 2, unit_price: 95, hsn: '8536' },
    { name: 'GW USB Charger 2.1A', code: 'GW-USB-2A', category_id: 2, unit_price: 280, hsn: '8536' },
    { name: 'GW Universal Socket', code: 'GW-SK-UNIV', category_id: 2, unit_price: 110, hsn: '8536' },
    // MCB & Distribution (cat 3)
    { name: 'GW MCB SP 16A', code: 'GW-MCB-SP16', category_id: 3, unit_price: 185, hsn: '8536' },
    { name: 'GW MCB DP 32A', code: 'GW-MCB-DP32', category_id: 3, unit_price: 420, hsn: '8536' },
    { name: 'GW RCCB 40A', code: 'GW-RCCB-40A', category_id: 3, unit_price: 1850, hsn: '8536' },
    { name: 'GW DB 8-Way', code: 'GW-DB-8WAY', category_id: 3, unit_price: 950, hsn: '8536' },
    { name: 'GW DB 12-Way', code: 'GW-DB-12WAY', category_id: 3, unit_price: 1450, hsn: '8536' },
    // Wires (cat 4)
    { name: 'GW Wire 1.0 sqmm (90m)', code: 'GW-WR-1.0-90', category_id: 4, unit_price: 1250, hsn: '8544' },
    { name: 'GW Wire 1.5 sqmm (90m)', code: 'GW-WR-1.5-90', category_id: 4, unit_price: 1850, hsn: '8544' },
    { name: 'GW Wire 2.5 sqmm (90m)', code: 'GW-WR-2.5-90', category_id: 4, unit_price: 2950, hsn: '8544' },
    { name: 'GW Wire 4.0 sqmm (90m)', code: 'GW-WR-4.0-90', category_id: 4, unit_price: 4650, hsn: '8544' },
    // LED Lighting (cat 5)
    { name: 'GW LED Bulb 9W', code: 'GW-LED-9W', category_id: 5, unit_price: 85, hsn: '9405' },
    { name: 'GW LED Bulb 12W', code: 'GW-LED-12W', category_id: 5, unit_price: 110, hsn: '9405' },
    { name: 'GW LED Panel 15W Round', code: 'GW-PNL-15W-R', category_id: 5, unit_price: 380, hsn: '9405' },
    { name: 'GW LED Panel 18W Square', code: 'GW-PNL-18W-S', category_id: 5, unit_price: 450, hsn: '9405' },
    { name: 'GW LED Batten 20W 4ft', code: 'GW-BAT-20W', category_id: 5, unit_price: 320, hsn: '9405' },
    { name: 'GW LED Downlight 12W', code: 'GW-DL-12W', category_id: 5, unit_price: 520, hsn: '9405' },
    // Fans (cat 6)
    { name: 'GW Ceiling Fan 1200mm', code: 'GW-FAN-1200', category_id: 6, unit_price: 1850, hsn: '8414' },
    { name: 'GW Ceiling Fan 1400mm', code: 'GW-FAN-1400', category_id: 6, unit_price: 2250, hsn: '8414' },
    { name: 'GW Exhaust Fan 150mm', code: 'GW-EXH-150', category_id: 6, unit_price: 850, hsn: '8414' },
    { name: 'GW BLDC Fan 1200mm', code: 'GW-BLDC-1200', category_id: 6, unit_price: 3450, hsn: '8414' },
    // Conduit (cat 7)
    { name: 'GW PVC Conduit 20mm (3m)', code: 'GW-PVC-20', category_id: 7, unit_price: 65, hsn: '3917' },
    { name: 'GW PVC Conduit 25mm (3m)', code: 'GW-PVC-25', category_id: 7, unit_price: 85, hsn: '3917' },
    { name: 'GW Junction Box', code: 'GW-JB-DEEP', category_id: 7, unit_price: 22, hsn: '3926' },
    // Smart Home (cat 8)
    { name: 'GW Smart Switch 4M WiFi', code: 'GW-SMART-4M', category_id: 8, unit_price: 2850, hsn: '8536' },
    { name: 'GW Smart Plug 16A', code: 'GW-SMART-PLUG', category_id: 8, unit_price: 1250, hsn: '8536' },
    { name: 'GW Smart IR Remote', code: 'GW-SMART-IR', category_id: 8, unit_price: 1950, hsn: '8536' },
  ];

  for (const sku of skus) {
    await query(
      'INSERT INTO skus (name, code, category_id, unit_price, hsn_code) VALUES ($1, $2, $3, $4, $5)',
      [sku.name, sku.code, sku.category_id, sku.unit_price, sku.hsn]
    );
  }

  // ===== DEALERS =====
  const dealers = [
    { name: 'Rajesh Kumar', code: 'DLR-001', firm: 'Kumar Electricals', type: 'distributor', region: 'north', state: 'Delhi', city: 'New Delhi', phone: '9811234567', email: 'rajesh@kumar-elect.com', gst: '07AAAPK1234A1Z5' },
    { name: 'Suresh Patel', code: 'DLR-002', firm: 'Patel Trading Co.', type: 'distributor', region: 'west', state: 'Gujarat', city: 'Ahmedabad', phone: '9822345678', email: 'suresh@patel-trade.com', gst: '24AAAPK2345B1Z5' },
    { name: 'Anil Sharma', code: 'DLR-003', firm: 'Sharma Electricals', type: 'retailer', region: 'north', state: 'Rajasthan', city: 'Jaipur', phone: '9833456789', email: 'anil@sharma-elect.com', gst: '08AAAPK3456C1Z5' },
    { name: 'Mohan Reddy', code: 'DLR-004', firm: 'Reddy Power Solutions', type: 'distributor', region: 'south', state: 'Telangana', city: 'Hyderabad', phone: '9844567890', email: 'mohan@reddy-power.com', gst: '36AAAPK4567D1Z5' },
    { name: 'Vikram Singh', code: 'DLR-005', firm: 'Singh Enterprises', type: 'wholesaler', region: 'north', state: 'Punjab', city: 'Ludhiana', phone: '9855678901', email: 'vikram@singh-ent.com', gst: '03AAAPK5678E1Z5' },
    { name: 'Prakash Jain', code: 'DLR-006', firm: 'Jain Switchgear', type: 'retailer', region: 'west', state: 'Maharashtra', city: 'Pune', phone: '9866789012', email: 'prakash@jain-sg.com', gst: '27AAAPK6789F1Z5' },
    { name: 'Sanjay Mehta', code: 'DLR-007', firm: 'Mehta Electrical Hub', type: 'project_dealer', region: 'west', state: 'Maharashtra', city: 'Mumbai', phone: '9877890123', email: 'sanjay@mehta-hub.com', gst: '27AAAPK7890G1Z5' },
    { name: 'Deepak Gupta', code: 'DLR-008', firm: 'Gupta Electrical Store', type: 'sub_dealer', region: 'central', state: 'Madhya Pradesh', city: 'Bhopal', phone: '9888901234', email: 'deepak@gupta-store.com', gst: '23AAAPK8901H1Z5' },
    { name: 'Ramesh Iyer', code: 'DLR-009', firm: 'Iyer Electric World', type: 'distributor', region: 'south', state: 'Tamil Nadu', city: 'Chennai', phone: '9899012345', email: 'ramesh@iyer-world.com', gst: '33AAAPK9012I1Z5' },
    { name: 'Arjun Das', code: 'DLR-010', firm: 'Das Power Systems', type: 'retailer', region: 'east', state: 'West Bengal', city: 'Kolkata', phone: '9800123456', email: 'arjun@das-power.com', gst: '19AAAPK0123J1Z5' },
    { name: 'Manoj Tiwari', code: 'DLR-011', firm: 'Tiwari Electricals', type: 'distributor', region: 'central', state: 'Uttar Pradesh', city: 'Lucknow', phone: '9811234568', email: 'manoj@tiwari-elect.com', gst: '09AAAPK1234K1Z5' },
    { name: 'Karthik Nair', code: 'DLR-012', firm: 'Nair Solutions', type: 'wholesaler', region: 'south', state: 'Kerala', city: 'Kochi', phone: '9822345679', email: 'karthik@nair-sol.com', gst: '32AAAPK2345L1Z5' },
  ];

  for (const d of dealers) {
    await query(
      'INSERT INTO dealers (name, code, firm_name, type, region, state, city, phone, email, gst_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [d.name, d.code, d.firm, d.type, d.region, d.state, d.city, d.phone, d.email, d.gst]
    );
  }

  // ===== INVOICES (March - April 2026, backdated scenario) =====
  const invoiceData = [
    // Rajesh Kumar (DLR-001) - Distributor North - heavy buyer
    { dealer_id: 1, inv: 'INV-2026-0301', date: '2026-03-05', items: [
      { sku_id: 1, qty: 500, price: 45 }, { sku_id: 2, qty: 200, price: 85 },
      { sku_id: 7, qty: 300, price: 65 }, { sku_id: 11, qty: 100, price: 185 },
    ]},
    { dealer_id: 1, inv: 'INV-2026-0302', date: '2026-03-18', items: [
      { sku_id: 16, qty: 50, price: 1250 }, { sku_id: 17, qty: 40, price: 1850 },
      { sku_id: 20, qty: 200, price: 85 }, { sku_id: 21, qty: 150, price: 110 },
    ]},
    { dealer_id: 1, inv: 'INV-2026-0401', date: '2026-04-02', items: [
      { sku_id: 1, qty: 600, price: 45 }, { sku_id: 3, qty: 100, price: 320 },
      { sku_id: 5, qty: 200, price: 95 }, { sku_id: 22, qty: 100, price: 380 },
    ]},
    { dealer_id: 1, inv: 'INV-2026-0402', date: '2026-04-10', items: [
      { sku_id: 11, qty: 150, price: 185 }, { sku_id: 12, qty: 80, price: 420 },
      { sku_id: 26, qty: 20, price: 1850 }, { sku_id: 29, qty: 15, price: 3450 },
    ]},
    // Suresh Patel (DLR-002) - Distributor West
    { dealer_id: 2, inv: 'INV-2026-0303', date: '2026-03-10', items: [
      { sku_id: 1, qty: 400, price: 45 }, { sku_id: 2, qty: 300, price: 85 },
      { sku_id: 11, qty: 200, price: 185 }, { sku_id: 14, qty: 30, price: 950 },
    ]},
    { dealer_id: 2, inv: 'INV-2026-0403', date: '2026-04-05', items: [
      { sku_id: 16, qty: 80, price: 1250 }, { sku_id: 17, qty: 60, price: 1850 },
      { sku_id: 20, qty: 500, price: 85 }, { sku_id: 24, qty: 100, price: 320 },
    ]},
    { dealer_id: 2, inv: 'INV-2026-0404', date: '2026-04-11', items: [
      { sku_id: 5, qty: 300, price: 95 }, { sku_id: 6, qty: 200, price: 40 },
      { sku_id: 32, qty: 10, price: 2850 }, { sku_id: 33, qty: 15, price: 1250 },
    ]},
    // Anil Sharma (DLR-003) - Retailer North
    { dealer_id: 3, inv: 'INV-2026-0304', date: '2026-03-12', items: [
      { sku_id: 1, qty: 100, price: 45 }, { sku_id: 7, qty: 80, price: 65 },
      { sku_id: 20, qty: 50, price: 85 }, { sku_id: 22, qty: 30, price: 380 },
    ]},
    { dealer_id: 3, inv: 'INV-2026-0405', date: '2026-04-08', items: [
      { sku_id: 2, qty: 60, price: 85 }, { sku_id: 11, qty: 40, price: 185 },
      { sku_id: 26, qty: 5, price: 1850 }, { sku_id: 24, qty: 20, price: 320 },
    ]},
    // Mohan Reddy (DLR-004) - Distributor South
    { dealer_id: 4, inv: 'INV-2026-0305', date: '2026-03-08', items: [
      { sku_id: 1, qty: 800, price: 45 }, { sku_id: 2, qty: 400, price: 85 },
      { sku_id: 3, qty: 150, price: 320 }, { sku_id: 7, qty: 500, price: 65 },
    ]},
    { dealer_id: 4, inv: 'INV-2026-0306', date: '2026-03-22', items: [
      { sku_id: 11, qty: 300, price: 185 }, { sku_id: 13, qty: 50, price: 1850 },
      { sku_id: 16, qty: 100, price: 1250 }, { sku_id: 17, qty: 70, price: 1850 },
    ]},
    { dealer_id: 4, inv: 'INV-2026-0406', date: '2026-04-03', items: [
      { sku_id: 20, qty: 400, price: 85 }, { sku_id: 22, qty: 200, price: 380 },
      { sku_id: 23, qty: 150, price: 450 }, { sku_id: 25, qty: 80, price: 520 },
    ]},
    { dealer_id: 4, inv: 'INV-2026-0407', date: '2026-04-12', items: [
      { sku_id: 26, qty: 30, price: 1850 }, { sku_id: 27, qty: 25, price: 2250 },
      { sku_id: 29, qty: 10, price: 3450 }, { sku_id: 32, qty: 8, price: 2850 },
    ]},
    // Vikram Singh (DLR-005) - Wholesaler North
    { dealer_id: 5, inv: 'INV-2026-0307', date: '2026-03-15', items: [
      { sku_id: 1, qty: 1000, price: 45 }, { sku_id: 2, qty: 500, price: 85 },
      { sku_id: 4, qty: 300, price: 55 }, { sku_id: 7, qty: 400, price: 65 },
    ]},
    { dealer_id: 5, inv: 'INV-2026-0408', date: '2026-04-07', items: [
      { sku_id: 16, qty: 120, price: 1250 }, { sku_id: 18, qty: 80, price: 2950 },
      { sku_id: 30, qty: 200, price: 65 }, { sku_id: 31, qty: 500, price: 22 },
    ]},
    // Prakash Jain (DLR-006) - Retailer West
    { dealer_id: 6, inv: 'INV-2026-0308', date: '2026-03-20', items: [
      { sku_id: 5, qty: 50, price: 95 }, { sku_id: 9, qty: 30, price: 280 },
      { sku_id: 20, qty: 40, price: 85 }, { sku_id: 28, qty: 10, price: 850 },
    ]},
    { dealer_id: 6, inv: 'INV-2026-0409', date: '2026-04-09', items: [
      { sku_id: 1, qty: 80, price: 45 }, { sku_id: 11, qty: 25, price: 185 },
      { sku_id: 22, qty: 15, price: 380 }, { sku_id: 24, qty: 20, price: 320 },
    ]},
    // Sanjay Mehta (DLR-007) - Project Dealer West
    { dealer_id: 7, inv: 'INV-2026-0309', date: '2026-03-25', items: [
      { sku_id: 32, qty: 50, price: 2850 }, { sku_id: 33, qty: 40, price: 1250 },
      { sku_id: 34, qty: 30, price: 1950 }, { sku_id: 3, qty: 200, price: 320 },
    ]},
    { dealer_id: 7, inv: 'INV-2026-0410', date: '2026-04-06', items: [
      { sku_id: 13, qty: 100, price: 1850 }, { sku_id: 14, qty: 50, price: 950 },
      { sku_id: 15, qty: 40, price: 1450 }, { sku_id: 26, qty: 40, price: 1850 },
    ]},
    // Deepak Gupta (DLR-008) - Sub Dealer Central
    { dealer_id: 8, inv: 'INV-2026-0310', date: '2026-03-28', items: [
      { sku_id: 1, qty: 150, price: 45 }, { sku_id: 7, qty: 100, price: 65 },
      { sku_id: 20, qty: 80, price: 85 }, { sku_id: 11, qty: 30, price: 185 },
    ]},
    // Ramesh Iyer (DLR-009) - Distributor South
    { dealer_id: 9, inv: 'INV-2026-0311', date: '2026-03-14', items: [
      { sku_id: 1, qty: 600, price: 45 }, { sku_id: 2, qty: 350, price: 85 },
      { sku_id: 16, qty: 90, price: 1250 }, { sku_id: 26, qty: 25, price: 1850 },
    ]},
    { dealer_id: 9, inv: 'INV-2026-0411', date: '2026-04-10', items: [
      { sku_id: 11, qty: 120, price: 185 }, { sku_id: 12, qty: 60, price: 420 },
      { sku_id: 22, qty: 80, price: 380 }, { sku_id: 23, qty: 60, price: 450 },
    ]},
    // Arjun Das (DLR-010) - Retailer East
    { dealer_id: 10, inv: 'INV-2026-0312', date: '2026-03-30', items: [
      { sku_id: 1, qty: 200, price: 45 }, { sku_id: 5, qty: 100, price: 95 },
      { sku_id: 20, qty: 60, price: 85 }, { sku_id: 30, qty: 100, price: 65 },
    ]},
    // Manoj Tiwari (DLR-011) - Distributor Central
    { dealer_id: 11, inv: 'INV-2026-0313', date: '2026-03-17', items: [
      { sku_id: 1, qty: 700, price: 45 }, { sku_id: 2, qty: 350, price: 85 },
      { sku_id: 11, qty: 200, price: 185 }, { sku_id: 16, qty: 60, price: 1250 },
    ]},
    { dealer_id: 11, inv: 'INV-2026-0412', date: '2026-04-08', items: [
      { sku_id: 17, qty: 50, price: 1850 }, { sku_id: 20, qty: 300, price: 85 },
      { sku_id: 26, qty: 15, price: 1850 }, { sku_id: 29, qty: 8, price: 3450 },
    ]},
    // Karthik Nair (DLR-012) - Wholesaler South
    { dealer_id: 12, inv: 'INV-2026-0314', date: '2026-03-22', items: [
      { sku_id: 1, qty: 900, price: 45 }, { sku_id: 7, qty: 600, price: 65 },
      { sku_id: 11, qty: 150, price: 185 }, { sku_id: 20, qty: 200, price: 85 },
    ]},
    { dealer_id: 12, inv: 'INV-2026-0413', date: '2026-04-11', items: [
      { sku_id: 16, qty: 100, price: 1250 }, { sku_id: 18, qty: 60, price: 2950 },
      { sku_id: 26, qty: 20, price: 1850 }, { sku_id: 32, qty: 12, price: 2850 },
    ]},
  ];

  for (const inv of invoiceData) {
    let total = 0;
    for (const item of inv.items) {
      total += item.qty * item.price;
    }
    const invResult = await query(
      'INSERT INTO invoices (invoice_number, dealer_id, invoice_date, total_amount) VALUES ($1,$2,$3,$4) RETURNING id',
      [inv.inv, inv.dealer_id, inv.date, total]
    );
    const invoiceId = invResult.rows[0].id;
    for (const item of inv.items) {
      await query(
        'INSERT INTO invoice_items (invoice_id, sku_id, quantity, unit_price, total_price) VALUES ($1,$2,$3,$4,$5)',
        [invoiceId, item.sku_id, item.qty, item.price, item.qty * item.price]
      );
    }
  }

  // ===== SAMPLE COMPLEX SCHEMES =====

  // Scheme 1: Q1 Modular Switches Push - Value Based + Additional for MCBs
  const s1 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, is_backdated, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      'Q1 Modular Switch Mega Push',
      'Earn up to 3% incentive on Modular Switches + additional 2% on MCB purchases. Combo bonus of 0.5% on total if both targets achieved.',
      'SCH-Q1-SWMCB-2026',
      '2026-03-01', '2026-06-30', 'active',
      JSON.stringify(['north', 'west', 'south', 'east', 'central']),
      JSON.stringify(['distributor', 'wholesaler']),
      'credit_note', true, '2026-04-10',
      'Create a scheme for all distributors and wholesalers. If they purchase Rs 1,00,000 worth of Modular Switches from March to June 2026, give 1% incentive. If purchase crosses 2,50,000 give 2%. Above 5,00,000 give 3%. Additionally if they also buy Rs 50,000 of MCBs give extra 2%. If both targets met give 0.5% combo bonus on total purchase value.',
      'Rule 1: Slab-based on Modular Switches value. Rule 2: Flat 2% on MCB value above 50K. Bonus: 0.5% on total if both Rule1 (any slab) + Rule2 achieved.'
    ]
  );
  const scheme1Id = s1.rows[0].id;

  // Scheme 1 Rules
  const r1 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme1Id, 1, 'Modular Switches Value Target', 1, 'value', 100000, 'slab', 0, 'total',
     'Purchase Modular Switches worth ₹1L+ to earn slab-based incentive']
  );
  const rule1Id = r1.rows[0].id;

  // Slabs for rule 1
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [rule1Id, 100000, 250000, 'percentage', 1]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [rule1Id, 250000, 500000, 'percentage', 2]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [rule1Id, 500000, null, 'percentage', 3]);

  const r2 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, is_additional, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [scheme1Id, 2, 'MCB Purchase Bonus', 3, 'value', 50000, 'percentage', 2, true, 'total',
     'Additionally purchase ₹50K+ MCBs for extra 2% on MCB purchase value']
  );

  await query(
    `INSERT INTO scheme_bonus_rules (scheme_id, bonus_name, required_rule_ids, bonus_calc_type, bonus_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [scheme1Id, 'Combo Achievement Bonus', JSON.stringify([rule1Id, r2.rows[0].id]), 'percentage', 0.5, 'total_purchase',
     'Achieve both Switch and MCB targets to earn 0.5% bonus on total purchase value across all categories']
  );

  // Scheme 2: LED Lighting Quantity Push
  const s2 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, is_backdated, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      'LED Lighting Volume Champion',
      'Buy 500+ LED products and earn ₹5 per unit. Buy additional 100+ LED Panels for ₹8 per panel. Cross 1000 total LED units for ₹3 extra per unit on ALL units.',
      'SCH-Q1-LED-2026',
      '2026-04-01', '2026-06-30', 'active',
      JSON.stringify(['north', 'south', 'west']),
      JSON.stringify(['distributor', 'retailer', 'wholesaler']),
      'voucher', false, '2026-04-01',
      'For distributors, retailers and wholesalers in North, South & West. Buy 500 units of any LED product, get Rs 5 per unit on all units. Also buy 100 LED Panels (15W or 18W), get Rs 8 per panel. If total LED units cross 1000, give Rs 3 extra per unit on everything.',
      'Rule 1: Qty based on LED category ≥500 units, ₹5/unit on all. Rule 2: Qty on LED Panels ≥100, ₹8/unit on all panels. Bonus: If total LED ≥1000, ₹3/unit on everything.'
    ]
  );
  const scheme2Id = s2.rows[0].id;

  const r3 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme2Id, 1, 'LED Volume Target', 5, 'quantity', 500, 'per_unit', 5, 'all',
     'Purchase 500+ LED products to earn ₹5 per unit on all LED units']
  );

  const r4 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, is_additional, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [scheme2Id, 2, 'LED Panel Specialist', null, 'quantity', 100, 'per_unit', 8, true, 'all',
     'Additionally buy 100+ LED Panels (15W Round or 18W Square) for ₹8 per panel']
  );
  // Link specific SKUs for panel rule (sku_id 22=15W Round, 23=18W Square)
  await query('UPDATE scheme_rules SET sku_id = 22 WHERE id = $1', [r4.rows[0].id]);

  await query(
    `INSERT INTO scheme_bonus_rules (scheme_id, bonus_name, required_rule_ids, bonus_calc_type, bonus_value, apply_on, description, min_threshold)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [scheme2Id, 'Volume Superstar Bonus', JSON.stringify([r3.rows[0].id]), 'per_unit', 3, 'total_purchase',
     'Cross 1000 total LED units for ₹3 extra per unit on all LED purchases', 1000]
  );

  // Scheme 3: Wire & Cable Regional Push (North only)
  const s3 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, is_backdated, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      'North Zone Wire Warriors',
      'Exclusive for North zone dealers. Value-based slabs on Wire purchases with premium bonus for 4.0sqmm cables.',
      'SCH-Q1-WIRE-N-2026',
      '2026-03-01', '2026-05-31', 'active',
      JSON.stringify(['north']),
      JSON.stringify(['distributor', 'wholesaler', 'retailer']),
      'credit_note', true, '2026-04-05',
      'North region exclusive. Buy wires worth 2 lakh get 1.5%. Above 5 lakh get 2.5%. Above 10 lakh get 4%. Additionally if 4.0sqmm wire purchase exceeds 50 units, give Rs 100 per coil extra. Scheme started March 1 but created April 5 - backdate calculations.',
      'Slab-based on Wire category value. Additional per-unit bonus on 4.0sqmm SKU. Backdated from March 1.'
    ]
  );
  const scheme3Id = s3.rows[0].id;

  const r5 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme3Id, 1, 'Wire Value Slabs', 4, 'value', 200000, 'slab', 0, 'total',
     'Purchase Wires & Cables to earn slab-based incentive on total wire value']
  );
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r5.rows[0].id, 200000, 500000, 'percentage', 1.5]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r5.rows[0].id, 500000, 1000000, 'percentage', 2.5]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r5.rows[0].id, 1000000, null, 'percentage', 4]);

  await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_id, condition_type, min_threshold, incentive_calc_type, incentive_value, is_additional, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [scheme3Id, 2, '4.0sqmm Premium Bonus', 19, 'quantity', 50, 'per_unit', 100, true, 'above_threshold',
     'Buy 50+ coils of 4.0sqmm wire for ₹100 bonus per coil above 50']
  );

  // Scheme 4: Smart Home Early Adopter (Project Dealers Only)
  const s4 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      'Smart Home Pioneer Program',
      'Project dealers get aggressive incentives on Smart Home products to push new category adoption.',
      'SCH-Q2-SMART-2026',
      '2026-04-01', '2026-09-30', 'active',
      JSON.stringify(['north', 'west', 'south', 'east', 'central']),
      JSON.stringify(['project_dealer']),
      'gift', '2026-04-01',
      'For project dealers across all regions. Buy 20 Smart WiFi Switches get 5% on value. Buy 30 Smart Plugs get Rs 50 per plug. Buy 15 Smart IR Remotes get flat Rs 5000 bonus. Hit all 3 targets get 10% bonus on total smart home purchase.',
      'Per-SKU quantity targets with mixed incentive types. All-target combo bonus.'
    ]
  );
  const scheme4Id = s4.rows[0].id;

  const r6 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme4Id, 1, 'Smart Switch Target', 32, 'quantity', 20, 'percentage', 5, 'total',
     'Buy 20+ Smart WiFi 4M Switches for 5% incentive on purchase value']
  );
  const r7 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme4Id, 2, 'Smart Plug Target', 33, 'quantity', 30, 'per_unit', 50, 'all',
     'Buy 30+ Smart Plugs 16A for ₹50 per plug on all plugs purchased']
  );
  const r8 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme4Id, 3, 'Smart IR Remote Target', 34, 'quantity', 15, 'fixed', 5000, 'all',
     'Buy 15+ Smart IR Remotes for flat ₹5,000 bonus']
  );

  await query(
    `INSERT INTO scheme_bonus_rules (scheme_id, bonus_name, required_rule_ids, bonus_calc_type, bonus_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [scheme4Id, 'Smart Home Champion', JSON.stringify([r6.rows[0].id, r7.rows[0].id, r8.rows[0].id]), 'percentage', 10, 'total_purchase',
     'Achieve ALL 3 Smart Home targets for 10% bonus on entire Smart Home purchase value']
  );

  // Scheme 5: Fan Season Bonanza - Time-limited with payment term condition
  const s5 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      'Summer Fan Fiesta 2026',
      'Pre-summer fan stocking scheme. Heavy incentives on ceiling fans and BLDC fans with quantity milestones.',
      'SCH-SUM-FAN-2026',
      '2026-04-01', '2026-05-31', 'active',
      JSON.stringify(['north', 'south', 'west', 'east', 'central']),
      JSON.stringify(['distributor', 'retailer', 'wholesaler', 'sub_dealer']),
      'voucher', '2026-04-01',
      'All dealer types across all regions. Buy 50 ceiling fans (any size) get Rs 200 per fan. Buy 100 fans get Rs 350 per fan. Buy 200 fans get Rs 500 per fan. Additionally if BLDC fans are 25%+ of total fan quantity, give extra 3% on BLDC value.',
      'Slab-based per-unit on fan quantity. Additional percentage bonus on BLDC if mix target met.'
    ]
  );
  const scheme5Id = s5.rows[0].id;

  // Scheme 5 Rule 1: Slab-based per-unit on Fan category (category_id=6) by quantity
  // Buy 50 fans = Rs 200/fan, 100 fans = Rs 350/fan, 200 fans = Rs 500/fan
  const r9 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme5Id, 1, 'Fan Quantity Slab Target', 6, 'quantity', 50, 'slab', 0, 'all',
     'Purchase 50+ ceiling fans to earn slab-based per-unit incentive on all fan units']
  );
  const rule9Id = r9.rows[0].id;

  // Slabs for rule 9: quantity-based per_unit slabs
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [rule9Id, 50, 100, 'per_unit', 200]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [rule9Id, 100, 200, 'per_unit', 350]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [rule9Id, 200, null, 'per_unit', 500]);

  // Scheme 5 Rule 2: Additional rule - BLDC Fan (sku_id=29) percentage bonus
  // If BLDC fans are 25%+ of total fan quantity, give extra 3% on BLDC value
  await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_id, condition_type, min_threshold, incentive_calc_type, incentive_value, is_additional, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [scheme5Id, 2, 'BLDC Fan Mix Bonus', 29, 'quantity', 1, 'percentage', 3, true, 'total',
     'If BLDC fans are 25%+ of total fan quantity, earn extra 3% on BLDC fan purchase value']
  );

  console.log('Database seeded successfully with Greatwhite data!');
}

import { query, getAll } from './db';

/**
 * Extended seed: adds 20 more dealers, 80+ more invoices across Feb-May 2026,
 * and 5 new schemes on top of existing data.
 */
export async function seedExtendedData() {
  // Check if extended data already exists
  const dealerCount = await getAll("SELECT COUNT(*) as count FROM dealers");
  if (Number(dealerCount[0]?.count) > 20) {
    console.log('Extended data already seeded');
    return { message: 'Already seeded', skipped: true };
  }

  // ===== 20 MORE DEALERS =====
  const newDealers = [
    // North (5 more)
    { name: 'Amit Verma', code: 'DLR-013', firm: 'Verma Power House', type: 'distributor', region: 'north', state: 'Haryana', city: 'Gurugram', phone: '9810111213', email: 'amit@verma-power.com', gst: '06AAAPV1301A1Z5' },
    { name: 'Rohit Kapoor', code: 'DLR-014', firm: 'Kapoor Electric Hub', type: 'retailer', region: 'north', state: 'Uttarakhand', city: 'Dehradun', phone: '9810141516', email: 'rohit@kapoor-hub.com', gst: '05AAAPK1401A1Z5' },
    { name: 'Naveen Chaudhary', code: 'DLR-015', firm: 'Chaudhary Enterprises', type: 'wholesaler', region: 'north', state: 'Uttar Pradesh', city: 'Agra', phone: '9810171819', email: 'naveen@chaudhary-ent.com', gst: '09AAAPC1501A1Z5' },
    { name: 'Pankaj Saxena', code: 'DLR-016', firm: 'Saxena Switchgear', type: 'sub_dealer', region: 'north', state: 'Delhi', city: 'New Delhi', phone: '9810202122', email: 'pankaj@saxena-sg.com', gst: '07AAAPS1601A1Z5' },
    { name: 'Harish Tandon', code: 'DLR-017', firm: 'Tandon Electricals', type: 'project_dealer', region: 'north', state: 'Punjab', city: 'Chandigarh', phone: '9810232425', email: 'harish@tandon-elect.com', gst: '03AAAPT1701A1Z5' },
    // South (4 more)
    { name: 'Venkatesh Rao', code: 'DLR-018', firm: 'Rao Electrical Solutions', type: 'distributor', region: 'south', state: 'Karnataka', city: 'Bangalore', phone: '9820111213', email: 'venkat@rao-elect.com', gst: '29AAAPR1801A1Z5' },
    { name: 'Subramaniam K', code: 'DLR-019', firm: 'KS Electricals', type: 'wholesaler', region: 'south', state: 'Tamil Nadu', city: 'Coimbatore', phone: '9820141516', email: 'subram@ks-elect.com', gst: '33AAAPK1901A1Z5' },
    { name: 'Anitha Menon', code: 'DLR-020', firm: 'Menon Power Hub', type: 'retailer', region: 'south', state: 'Kerala', city: 'Trivandrum', phone: '9820171819', email: 'anitha@menon-power.com', gst: '32AAAPM2001A1Z5' },
    { name: 'Balaji Sundaram', code: 'DLR-021', firm: 'Sundaram Electric World', type: 'project_dealer', region: 'south', state: 'Andhra Pradesh', city: 'Visakhapatnam', phone: '9820202122', email: 'balaji@sundaram-ew.com', gst: '37AAAPS2101A1Z5' },
    // West (4 more)
    { name: 'Nikhil Deshmukh', code: 'DLR-022', firm: 'Deshmukh Trading Co.', type: 'distributor', region: 'west', state: 'Maharashtra', city: 'Nagpur', phone: '9830111213', email: 'nikhil@deshmukh-tc.com', gst: '27AAAPD2201A1Z5' },
    { name: 'Rajendra Shah', code: 'DLR-023', firm: 'Shah Electrical Mart', type: 'wholesaler', region: 'west', state: 'Gujarat', city: 'Surat', phone: '9830141516', email: 'rajendra@shah-mart.com', gst: '24AAAPS2301A1Z5' },
    { name: 'Priya Kulkarni', code: 'DLR-024', firm: 'Kulkarni Electricals', type: 'retailer', region: 'west', state: 'Maharashtra', city: 'Nashik', phone: '9830171819', email: 'priya@kulkarni-elect.com', gst: '27AAAPK2401A1Z5' },
    { name: 'Govind Agarwal', code: 'DLR-025', firm: 'Agarwal Power Systems', type: 'sub_dealer', region: 'west', state: 'Rajasthan', city: 'Udaipur', phone: '9830202122', email: 'govind@agarwal-ps.com', gst: '08AAAPA2501A1Z5' },
    // East (4 more)
    { name: 'Sourav Banerjee', code: 'DLR-026', firm: 'Banerjee Electrical House', type: 'distributor', region: 'east', state: 'West Bengal', city: 'Howrah', phone: '9840111213', email: 'sourav@banerjee-eh.com', gst: '19AAAPB2601A1Z5' },
    { name: 'Bijay Mohapatra', code: 'DLR-027', firm: 'Mohapatra Enterprises', type: 'wholesaler', region: 'east', state: 'Odisha', city: 'Bhubaneswar', phone: '9840141516', email: 'bijay@mohapatra-ent.com', gst: '21AAAPM2701A1Z5' },
    { name: 'Ravi Thakur', code: 'DLR-028', firm: 'Thakur Switchgear', type: 'retailer', region: 'east', state: 'Bihar', city: 'Patna', phone: '9840171819', email: 'ravi@thakur-sg.com', gst: '10AAAPT2801A1Z5' },
    { name: 'Manish Choudhury', code: 'DLR-029', firm: 'Choudhury Electricals', type: 'sub_dealer', region: 'east', state: 'Jharkhand', city: 'Ranchi', phone: '9840202122', email: 'manish@choudhury-el.com', gst: '20AAAPC2901A1Z5' },
    // Central (3 more)
    { name: 'Ashok Pandey', code: 'DLR-030', firm: 'Pandey Power Solutions', type: 'distributor', region: 'central', state: 'Madhya Pradesh', city: 'Indore', phone: '9850111213', email: 'ashok@pandey-ps.com', gst: '23AAAPP3001A1Z5' },
    { name: 'Santosh Mishra', code: 'DLR-031', firm: 'Mishra Electricals', type: 'wholesaler', region: 'central', state: 'Chhattisgarh', city: 'Raipur', phone: '9850141516', email: 'santosh@mishra-el.com', gst: '22AAAPM3101A1Z5' },
    { name: 'Dinesh Yadav', code: 'DLR-032', firm: 'Yadav Electric Mart', type: 'retailer', region: 'central', state: 'Uttar Pradesh', city: 'Kanpur', phone: '9850171819', email: 'dinesh@yadav-em.com', gst: '09AAAPY3201A1Z5' },
  ];

  const dealerIdMap: Record<string, number> = {};
  for (const d of newDealers) {
    const res = await query(
      'INSERT INTO dealers (name, code, firm_name, type, region, state, city, phone, email, gst_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [d.name, d.code, d.firm, d.type, d.region, d.state, d.city, d.phone, d.email, d.gst]
    );
    dealerIdMap[d.code] = res.rows[0].id;
  }

  // ===== 80+ MORE INVOICES =====
  // Mix of Feb (pre-scheme), March, April, May 2026
  const invoiceData = [
    // --- Amit Verma (DLR-013) - Heavy distributor North, 6 invoices ---
    { dealer: 'DLR-013', inv: 'INV-2026-1301', date: '2026-02-20', items: [
      { sku_id: 1, qty: 800, price: 45 }, { sku_id: 2, qty: 400, price: 85 },
      { sku_id: 3, qty: 50, price: 320 }, { sku_id: 7, qty: 200, price: 65 },
    ]},
    { dealer: 'DLR-013', inv: 'INV-2026-1302', date: '2026-03-08', items: [
      { sku_id: 11, qty: 300, price: 185 }, { sku_id: 12, qty: 100, price: 420 },
      { sku_id: 14, qty: 40, price: 950 }, { sku_id: 13, qty: 30, price: 1850 },
    ]},
    { dealer: 'DLR-013', inv: 'INV-2026-1303', date: '2026-03-22', items: [
      { sku_id: 16, qty: 150, price: 1250 }, { sku_id: 17, qty: 100, price: 1850 },
      { sku_id: 18, qty: 40, price: 2950 }, { sku_id: 19, qty: 60, price: 4650 },
    ]},
    { dealer: 'DLR-013', inv: 'INV-2026-1304', date: '2026-04-05', items: [
      { sku_id: 1, qty: 1200, price: 45 }, { sku_id: 5, qty: 500, price: 95 },
      { sku_id: 6, qty: 300, price: 40 }, { sku_id: 4, qty: 200, price: 55 },
    ]},
    { dealer: 'DLR-013', inv: 'INV-2026-1305', date: '2026-04-18', items: [
      { sku_id: 20, qty: 600, price: 85 }, { sku_id: 21, qty: 400, price: 110 },
      { sku_id: 22, qty: 200, price: 380 }, { sku_id: 24, qty: 150, price: 320 },
    ]},
    { dealer: 'DLR-013', inv: 'INV-2026-1306', date: '2026-05-02', items: [
      { sku_id: 26, qty: 60, price: 1850 }, { sku_id: 27, qty: 40, price: 2250 },
      { sku_id: 29, qty: 30, price: 3450 }, { sku_id: 28, qty: 50, price: 850 },
    ]},

    // --- Rohit Kapoor (DLR-014) - Retailer North, 3 invoices ---
    { dealer: 'DLR-014', inv: 'INV-2026-1401', date: '2026-03-15', items: [
      { sku_id: 1, qty: 150, price: 45 }, { sku_id: 5, qty: 80, price: 95 },
      { sku_id: 20, qty: 100, price: 85 }, { sku_id: 22, qty: 40, price: 380 },
    ]},
    { dealer: 'DLR-014', inv: 'INV-2026-1402', date: '2026-04-12', items: [
      { sku_id: 11, qty: 60, price: 185 }, { sku_id: 26, qty: 8, price: 1850 },
      { sku_id: 30, qty: 100, price: 65 }, { sku_id: 31, qty: 200, price: 22 },
    ]},
    { dealer: 'DLR-014', inv: 'INV-2026-1403', date: '2026-05-05', items: [
      { sku_id: 2, qty: 100, price: 85 }, { sku_id: 16, qty: 20, price: 1250 },
      { sku_id: 17, qty: 15, price: 1850 }, { sku_id: 3, qty: 30, price: 320 },
    ]},

    // --- Naveen Chaudhary (DLR-015) - Wholesaler North, 5 invoices ---
    { dealer: 'DLR-015', inv: 'INV-2026-1501', date: '2026-03-01', items: [
      { sku_id: 1, qty: 2000, price: 45 }, { sku_id: 2, qty: 1000, price: 85 },
      { sku_id: 4, qty: 500, price: 55 }, { sku_id: 7, qty: 800, price: 65 },
    ]},
    { dealer: 'DLR-015', inv: 'INV-2026-1502', date: '2026-03-15', items: [
      { sku_id: 11, qty: 500, price: 185 }, { sku_id: 12, qty: 200, price: 420 },
      { sku_id: 13, qty: 40, price: 1850 }, { sku_id: 14, qty: 60, price: 950 },
    ]},
    { dealer: 'DLR-015', inv: 'INV-2026-1503', date: '2026-04-01', items: [
      { sku_id: 16, qty: 200, price: 1250 }, { sku_id: 17, qty: 150, price: 1850 },
      { sku_id: 18, qty: 100, price: 2950 }, { sku_id: 19, qty: 80, price: 4650 },
    ]},
    { dealer: 'DLR-015', inv: 'INV-2026-1504', date: '2026-04-20', items: [
      { sku_id: 20, qty: 1000, price: 85 }, { sku_id: 21, qty: 500, price: 110 },
      { sku_id: 22, qty: 300, price: 380 }, { sku_id: 23, qty: 200, price: 450 },
    ]},
    { dealer: 'DLR-015', inv: 'INV-2026-1505', date: '2026-05-10', items: [
      { sku_id: 26, qty: 100, price: 1850 }, { sku_id: 27, qty: 80, price: 2250 },
      { sku_id: 29, qty: 50, price: 3450 }, { sku_id: 28, qty: 80, price: 850 },
    ]},

    // --- Pankaj Saxena (DLR-016) - Sub Dealer North, 2 invoices ---
    { dealer: 'DLR-016', inv: 'INV-2026-1601', date: '2026-03-25', items: [
      { sku_id: 1, qty: 100, price: 45 }, { sku_id: 7, qty: 50, price: 65 },
      { sku_id: 20, qty: 30, price: 85 }, { sku_id: 11, qty: 20, price: 185 },
    ]},
    { dealer: 'DLR-016', inv: 'INV-2026-1602', date: '2026-04-15', items: [
      { sku_id: 26, qty: 5, price: 1850 }, { sku_id: 30, qty: 50, price: 65 },
      { sku_id: 31, qty: 100, price: 22 }, { sku_id: 2, qty: 50, price: 85 },
    ]},

    // --- Harish Tandon (DLR-017) - Project Dealer North, 4 invoices ---
    { dealer: 'DLR-017', inv: 'INV-2026-1701', date: '2026-04-01', items: [
      { sku_id: 32, qty: 40, price: 2850 }, { sku_id: 33, qty: 50, price: 1250 },
      { sku_id: 34, qty: 25, price: 1950 }, { sku_id: 3, qty: 100, price: 320 },
    ]},
    { dealer: 'DLR-017', inv: 'INV-2026-1702', date: '2026-04-15', items: [
      { sku_id: 1, qty: 500, price: 45 }, { sku_id: 2, qty: 300, price: 85 },
      { sku_id: 5, qty: 200, price: 95 }, { sku_id: 9, qty: 80, price: 280 },
    ]},
    { dealer: 'DLR-017', inv: 'INV-2026-1703', date: '2026-05-01', items: [
      { sku_id: 13, qty: 60, price: 1850 }, { sku_id: 14, qty: 30, price: 950 },
      { sku_id: 15, qty: 20, price: 1450 }, { sku_id: 26, qty: 25, price: 1850 },
    ]},
    { dealer: 'DLR-017', inv: 'INV-2026-1704', date: '2026-05-15', items: [
      { sku_id: 32, qty: 30, price: 2850 }, { sku_id: 33, qty: 35, price: 1250 },
      { sku_id: 34, qty: 20, price: 1950 }, { sku_id: 29, qty: 15, price: 3450 },
    ]},

    // --- Venkatesh Rao (DLR-018) - Distributor South, 5 invoices ---
    { dealer: 'DLR-018', inv: 'INV-2026-1801', date: '2026-02-28', items: [
      { sku_id: 1, qty: 600, price: 45 }, { sku_id: 2, qty: 350, price: 85 },
      { sku_id: 7, qty: 300, price: 65 }, { sku_id: 8, qty: 150, price: 95 },
    ]},
    { dealer: 'DLR-018', inv: 'INV-2026-1802', date: '2026-03-12', items: [
      { sku_id: 11, qty: 250, price: 185 }, { sku_id: 12, qty: 80, price: 420 },
      { sku_id: 14, qty: 25, price: 950 }, { sku_id: 16, qty: 80, price: 1250 },
    ]},
    { dealer: 'DLR-018', inv: 'INV-2026-1803', date: '2026-03-28', items: [
      { sku_id: 20, qty: 500, price: 85 }, { sku_id: 21, qty: 300, price: 110 },
      { sku_id: 22, qty: 150, price: 380 }, { sku_id: 25, qty: 100, price: 520 },
    ]},
    { dealer: 'DLR-018', inv: 'INV-2026-1804', date: '2026-04-10', items: [
      { sku_id: 26, qty: 50, price: 1850 }, { sku_id: 27, qty: 30, price: 2250 },
      { sku_id: 29, qty: 20, price: 3450 }, { sku_id: 28, qty: 40, price: 850 },
    ]},
    { dealer: 'DLR-018', inv: 'INV-2026-1805', date: '2026-05-05', items: [
      { sku_id: 1, qty: 400, price: 45 }, { sku_id: 5, qty: 200, price: 95 },
      { sku_id: 11, qty: 150, price: 185 }, { sku_id: 17, qty: 60, price: 1850 },
    ]},

    // --- Subramaniam K (DLR-019) - Wholesaler South, 4 invoices ---
    { dealer: 'DLR-019', inv: 'INV-2026-1901', date: '2026-03-05', items: [
      { sku_id: 1, qty: 1500, price: 45 }, { sku_id: 2, qty: 800, price: 85 },
      { sku_id: 3, qty: 200, price: 320 }, { sku_id: 4, qty: 400, price: 55 },
    ]},
    { dealer: 'DLR-019', inv: 'INV-2026-1902', date: '2026-03-20', items: [
      { sku_id: 16, qty: 100, price: 1250 }, { sku_id: 18, qty: 80, price: 2950 },
      { sku_id: 19, qty: 40, price: 4650 }, { sku_id: 30, qty: 500, price: 65 },
    ]},
    { dealer: 'DLR-019', inv: 'INV-2026-1903', date: '2026-04-08', items: [
      { sku_id: 20, qty: 800, price: 85 }, { sku_id: 22, qty: 400, price: 380 },
      { sku_id: 23, qty: 300, price: 450 }, { sku_id: 24, qty: 200, price: 320 },
    ]},
    { dealer: 'DLR-019', inv: 'INV-2026-1904', date: '2026-05-01', items: [
      { sku_id: 26, qty: 80, price: 1850 }, { sku_id: 27, qty: 60, price: 2250 },
      { sku_id: 29, qty: 40, price: 3450 }, { sku_id: 11, qty: 200, price: 185 },
    ]},

    // --- Anitha Menon (DLR-020) - Retailer South, 3 invoices ---
    { dealer: 'DLR-020', inv: 'INV-2026-2001', date: '2026-03-18', items: [
      { sku_id: 1, qty: 200, price: 45 }, { sku_id: 5, qty: 100, price: 95 },
      { sku_id: 20, qty: 80, price: 85 }, { sku_id: 7, qty: 60, price: 65 },
    ]},
    { dealer: 'DLR-020', inv: 'INV-2026-2002', date: '2026-04-05', items: [
      { sku_id: 22, qty: 50, price: 380 }, { sku_id: 23, qty: 30, price: 450 },
      { sku_id: 11, qty: 40, price: 185 }, { sku_id: 26, qty: 10, price: 1850 },
    ]},
    { dealer: 'DLR-020', inv: 'INV-2026-2003', date: '2026-05-10', items: [
      { sku_id: 2, qty: 80, price: 85 }, { sku_id: 3, qty: 20, price: 320 },
      { sku_id: 16, qty: 15, price: 1250 }, { sku_id: 29, qty: 5, price: 3450 },
    ]},

    // --- Balaji Sundaram (DLR-021) - Project Dealer South, 3 invoices ---
    { dealer: 'DLR-021', inv: 'INV-2026-2101', date: '2026-04-02', items: [
      { sku_id: 32, qty: 25, price: 2850 }, { sku_id: 33, qty: 20, price: 1250 },
      { sku_id: 34, qty: 18, price: 1950 }, { sku_id: 3, qty: 80, price: 320 },
    ]},
    { dealer: 'DLR-021', inv: 'INV-2026-2102', date: '2026-04-20', items: [
      { sku_id: 1, qty: 300, price: 45 }, { sku_id: 2, qty: 200, price: 85 },
      { sku_id: 13, qty: 40, price: 1850 }, { sku_id: 14, qty: 25, price: 950 },
    ]},
    { dealer: 'DLR-021', inv: 'INV-2026-2103', date: '2026-05-08', items: [
      { sku_id: 32, qty: 20, price: 2850 }, { sku_id: 33, qty: 25, price: 1250 },
      { sku_id: 34, qty: 10, price: 1950 }, { sku_id: 26, qty: 15, price: 1850 },
    ]},

    // --- Nikhil Deshmukh (DLR-022) - Distributor West, 5 invoices ---
    { dealer: 'DLR-022', inv: 'INV-2026-2201', date: '2026-03-03', items: [
      { sku_id: 1, qty: 700, price: 45 }, { sku_id: 2, qty: 500, price: 85 },
      { sku_id: 5, qty: 300, price: 95 }, { sku_id: 7, qty: 400, price: 65 },
    ]},
    { dealer: 'DLR-022', inv: 'INV-2026-2202', date: '2026-03-18', items: [
      { sku_id: 11, qty: 400, price: 185 }, { sku_id: 12, qty: 150, price: 420 },
      { sku_id: 13, qty: 25, price: 1850 }, { sku_id: 16, qty: 100, price: 1250 },
    ]},
    { dealer: 'DLR-022', inv: 'INV-2026-2203', date: '2026-04-02', items: [
      { sku_id: 20, qty: 400, price: 85 }, { sku_id: 21, qty: 200, price: 110 },
      { sku_id: 22, qty: 100, price: 380 }, { sku_id: 24, qty: 100, price: 320 },
    ]},
    { dealer: 'DLR-022', inv: 'INV-2026-2204', date: '2026-04-22', items: [
      { sku_id: 26, qty: 40, price: 1850 }, { sku_id: 29, qty: 25, price: 3450 },
      { sku_id: 27, qty: 30, price: 2250 }, { sku_id: 17, qty: 50, price: 1850 },
    ]},
    { dealer: 'DLR-022', inv: 'INV-2026-2205', date: '2026-05-08', items: [
      { sku_id: 1, qty: 500, price: 45 }, { sku_id: 3, qty: 80, price: 320 },
      { sku_id: 9, qty: 50, price: 280 }, { sku_id: 10, qty: 100, price: 110 },
    ]},

    // --- Rajendra Shah (DLR-023) - Wholesaler West, 4 invoices ---
    { dealer: 'DLR-023', inv: 'INV-2026-2301', date: '2026-03-08', items: [
      { sku_id: 1, qty: 1200, price: 45 }, { sku_id: 2, qty: 600, price: 85 },
      { sku_id: 4, qty: 300, price: 55 }, { sku_id: 3, qty: 100, price: 320 },
    ]},
    { dealer: 'DLR-023', inv: 'INV-2026-2302', date: '2026-03-25', items: [
      { sku_id: 11, qty: 350, price: 185 }, { sku_id: 12, qty: 120, price: 420 },
      { sku_id: 14, qty: 50, price: 950 }, { sku_id: 15, qty: 30, price: 1450 },
    ]},
    { dealer: 'DLR-023', inv: 'INV-2026-2303', date: '2026-04-12', items: [
      { sku_id: 20, qty: 600, price: 85 }, { sku_id: 22, qty: 200, price: 380 },
      { sku_id: 23, qty: 150, price: 450 }, { sku_id: 25, qty: 80, price: 520 },
    ]},
    { dealer: 'DLR-023', inv: 'INV-2026-2304', date: '2026-05-05', items: [
      { sku_id: 26, qty: 60, price: 1850 }, { sku_id: 27, qty: 40, price: 2250 },
      { sku_id: 28, qty: 60, price: 850 }, { sku_id: 29, qty: 30, price: 3450 },
    ]},

    // --- Priya Kulkarni (DLR-024) - Retailer West, 2 invoices ---
    { dealer: 'DLR-024', inv: 'INV-2026-2401', date: '2026-03-20', items: [
      { sku_id: 1, qty: 120, price: 45 }, { sku_id: 5, qty: 60, price: 95 },
      { sku_id: 20, qty: 80, price: 85 }, { sku_id: 11, qty: 30, price: 185 },
    ]},
    { dealer: 'DLR-024', inv: 'INV-2026-2402', date: '2026-04-18', items: [
      { sku_id: 22, qty: 40, price: 380 }, { sku_id: 26, qty: 8, price: 1850 },
      { sku_id: 2, qty: 50, price: 85 }, { sku_id: 3, qty: 15, price: 320 },
    ]},

    // --- Govind Agarwal (DLR-025) - Sub Dealer West, 2 invoices ---
    { dealer: 'DLR-025', inv: 'INV-2026-2501', date: '2026-04-01', items: [
      { sku_id: 1, qty: 80, price: 45 }, { sku_id: 7, qty: 40, price: 65 },
      { sku_id: 20, qty: 50, price: 85 }, { sku_id: 30, qty: 80, price: 65 },
    ]},
    { dealer: 'DLR-025', inv: 'INV-2026-2502', date: '2026-04-25', items: [
      { sku_id: 26, qty: 3, price: 1850 }, { sku_id: 11, qty: 15, price: 185 },
      { sku_id: 2, qty: 30, price: 85 }, { sku_id: 28, qty: 5, price: 850 },
    ]},

    // --- Sourav Banerjee (DLR-026) - Distributor East, 4 invoices ---
    { dealer: 'DLR-026', inv: 'INV-2026-2601', date: '2026-03-05', items: [
      { sku_id: 1, qty: 500, price: 45 }, { sku_id: 2, qty: 300, price: 85 },
      { sku_id: 3, qty: 80, price: 320 }, { sku_id: 7, qty: 250, price: 65 },
    ]},
    { dealer: 'DLR-026', inv: 'INV-2026-2602', date: '2026-03-22', items: [
      { sku_id: 11, qty: 200, price: 185 }, { sku_id: 12, qty: 80, price: 420 },
      { sku_id: 16, qty: 60, price: 1250 }, { sku_id: 17, qty: 40, price: 1850 },
    ]},
    { dealer: 'DLR-026', inv: 'INV-2026-2603', date: '2026-04-08', items: [
      { sku_id: 20, qty: 300, price: 85 }, { sku_id: 22, qty: 100, price: 380 },
      { sku_id: 23, qty: 80, price: 450 }, { sku_id: 25, qty: 50, price: 520 },
    ]},
    { dealer: 'DLR-026', inv: 'INV-2026-2604', date: '2026-05-01', items: [
      { sku_id: 26, qty: 30, price: 1850 }, { sku_id: 29, qty: 15, price: 3450 },
      { sku_id: 19, qty: 30, price: 4650 }, { sku_id: 32, qty: 5, price: 2850 },
    ]},

    // --- Bijay Mohapatra (DLR-027) - Wholesaler East, 3 invoices ---
    { dealer: 'DLR-027', inv: 'INV-2026-2701', date: '2026-03-10', items: [
      { sku_id: 1, qty: 800, price: 45 }, { sku_id: 2, qty: 400, price: 85 },
      { sku_id: 7, qty: 300, price: 65 }, { sku_id: 8, qty: 200, price: 95 },
    ]},
    { dealer: 'DLR-027', inv: 'INV-2026-2702', date: '2026-04-05', items: [
      { sku_id: 11, qty: 180, price: 185 }, { sku_id: 16, qty: 80, price: 1250 },
      { sku_id: 20, qty: 400, price: 85 }, { sku_id: 22, qty: 100, price: 380 },
    ]},
    { dealer: 'DLR-027', inv: 'INV-2026-2703', date: '2026-05-02', items: [
      { sku_id: 26, qty: 40, price: 1850 }, { sku_id: 27, qty: 25, price: 2250 },
      { sku_id: 29, qty: 20, price: 3450 }, { sku_id: 18, qty: 30, price: 2950 },
    ]},

    // --- Ravi Thakur (DLR-028) - Retailer East, 2 invoices ---
    { dealer: 'DLR-028', inv: 'INV-2026-2801', date: '2026-03-20', items: [
      { sku_id: 1, qty: 100, price: 45 }, { sku_id: 7, qty: 50, price: 65 },
      { sku_id: 20, qty: 60, price: 85 }, { sku_id: 26, qty: 5, price: 1850 },
    ]},
    { dealer: 'DLR-028', inv: 'INV-2026-2802', date: '2026-04-15', items: [
      { sku_id: 2, qty: 80, price: 85 }, { sku_id: 11, qty: 30, price: 185 },
      { sku_id: 22, qty: 25, price: 380 }, { sku_id: 30, qty: 60, price: 65 },
    ]},

    // --- Manish Choudhury (DLR-029) - Sub Dealer East, 1 invoice ---
    { dealer: 'DLR-029', inv: 'INV-2026-2901', date: '2026-04-10', items: [
      { sku_id: 1, qty: 60, price: 45 }, { sku_id: 7, qty: 30, price: 65 },
      { sku_id: 20, qty: 40, price: 85 }, { sku_id: 11, qty: 15, price: 185 },
    ]},

    // --- Ashok Pandey (DLR-030) - Distributor Central, 4 invoices ---
    { dealer: 'DLR-030', inv: 'INV-2026-3001', date: '2026-03-05', items: [
      { sku_id: 1, qty: 600, price: 45 }, { sku_id: 2, qty: 400, price: 85 },
      { sku_id: 3, qty: 60, price: 320 }, { sku_id: 5, qty: 200, price: 95 },
    ]},
    { dealer: 'DLR-030', inv: 'INV-2026-3002', date: '2026-03-22', items: [
      { sku_id: 11, qty: 250, price: 185 }, { sku_id: 12, qty: 100, price: 420 },
      { sku_id: 13, qty: 20, price: 1850 }, { sku_id: 16, qty: 70, price: 1250 },
    ]},
    { dealer: 'DLR-030', inv: 'INV-2026-3003', date: '2026-04-10', items: [
      { sku_id: 20, qty: 350, price: 85 }, { sku_id: 22, qty: 120, price: 380 },
      { sku_id: 24, qty: 80, price: 320 }, { sku_id: 25, qty: 60, price: 520 },
    ]},
    { dealer: 'DLR-030', inv: 'INV-2026-3004', date: '2026-05-05', items: [
      { sku_id: 26, qty: 35, price: 1850 }, { sku_id: 27, qty: 20, price: 2250 },
      { sku_id: 29, qty: 15, price: 3450 }, { sku_id: 17, qty: 40, price: 1850 },
    ]},

    // --- Santosh Mishra (DLR-031) - Wholesaler Central, 3 invoices ---
    { dealer: 'DLR-031', inv: 'INV-2026-3101', date: '2026-03-12', items: [
      { sku_id: 1, qty: 900, price: 45 }, { sku_id: 2, qty: 500, price: 85 },
      { sku_id: 4, qty: 250, price: 55 }, { sku_id: 7, qty: 400, price: 65 },
    ]},
    { dealer: 'DLR-031', inv: 'INV-2026-3102', date: '2026-04-01', items: [
      { sku_id: 11, qty: 300, price: 185 }, { sku_id: 16, qty: 80, price: 1250 },
      { sku_id: 17, qty: 50, price: 1850 }, { sku_id: 20, qty: 500, price: 85 },
    ]},
    { dealer: 'DLR-031', inv: 'INV-2026-3103', date: '2026-05-01', items: [
      { sku_id: 26, qty: 50, price: 1850 }, { sku_id: 29, qty: 25, price: 3450 },
      { sku_id: 18, qty: 40, price: 2950 }, { sku_id: 22, qty: 150, price: 380 },
    ]},

    // --- Dinesh Yadav (DLR-032) - Retailer Central, 2 invoices ---
    { dealer: 'DLR-032', inv: 'INV-2026-3201', date: '2026-03-25', items: [
      { sku_id: 1, qty: 150, price: 45 }, { sku_id: 5, qty: 70, price: 95 },
      { sku_id: 7, qty: 60, price: 65 }, { sku_id: 20, qty: 50, price: 85 },
    ]},
    { dealer: 'DLR-032', inv: 'INV-2026-3202', date: '2026-04-20', items: [
      { sku_id: 11, qty: 25, price: 185 }, { sku_id: 22, qty: 20, price: 380 },
      { sku_id: 26, qty: 4, price: 1850 }, { sku_id: 2, qty: 40, price: 85 },
    ]},

    // === EXTRA INVOICES FOR EXISTING DEALERS (more volume, May data) ===

    // Rajesh Kumar (dealer_id=1) - 2 more May invoices
    { dealer_id: 1, inv: 'INV-2026-0501', date: '2026-05-05', items: [
      { sku_id: 1, qty: 800, price: 45 }, { sku_id: 2, qty: 400, price: 85 },
      { sku_id: 3, qty: 80, price: 320 }, { sku_id: 11, qty: 200, price: 185 },
    ]},
    { dealer_id: 1, inv: 'INV-2026-0502', date: '2026-05-15', items: [
      { sku_id: 20, qty: 300, price: 85 }, { sku_id: 22, qty: 100, price: 380 },
      { sku_id: 26, qty: 30, price: 1850 }, { sku_id: 29, qty: 20, price: 3450 },
    ]},

    // Suresh Patel (dealer_id=2) - 2 more May invoices
    { dealer_id: 2, inv: 'INV-2026-0503', date: '2026-05-08', items: [
      { sku_id: 1, qty: 600, price: 45 }, { sku_id: 11, qty: 250, price: 185 },
      { sku_id: 20, qty: 400, price: 85 }, { sku_id: 22, qty: 150, price: 380 },
    ]},
    { dealer_id: 2, inv: 'INV-2026-0504', date: '2026-05-18', items: [
      { sku_id: 26, qty: 25, price: 1850 }, { sku_id: 27, qty: 20, price: 2250 },
      { sku_id: 16, qty: 40, price: 1250 }, { sku_id: 17, qty: 30, price: 1850 },
    ]},

    // Mohan Reddy (dealer_id=4) - 2 more May invoices
    { dealer_id: 4, inv: 'INV-2026-0505', date: '2026-05-03', items: [
      { sku_id: 1, qty: 500, price: 45 }, { sku_id: 2, qty: 300, price: 85 },
      { sku_id: 20, qty: 350, price: 85 }, { sku_id: 23, qty: 100, price: 450 },
    ]},
    { dealer_id: 4, inv: 'INV-2026-0506', date: '2026-05-20', items: [
      { sku_id: 11, qty: 200, price: 185 }, { sku_id: 26, qty: 20, price: 1850 },
      { sku_id: 29, qty: 12, price: 3450 }, { sku_id: 32, qty: 5, price: 2850 },
    ]},

    // Vikram Singh (dealer_id=5) - 2 more May invoices
    { dealer_id: 5, inv: 'INV-2026-0507', date: '2026-05-10', items: [
      { sku_id: 1, qty: 1500, price: 45 }, { sku_id: 2, qty: 800, price: 85 },
      { sku_id: 11, qty: 400, price: 185 }, { sku_id: 12, qty: 150, price: 420 },
    ]},
    { dealer_id: 5, inv: 'INV-2026-0508', date: '2026-05-22', items: [
      { sku_id: 16, qty: 100, price: 1250 }, { sku_id: 19, qty: 70, price: 4650 },
      { sku_id: 20, qty: 600, price: 85 }, { sku_id: 26, qty: 40, price: 1850 },
    ]},

    // Ramesh Iyer (dealer_id=9) - 2 more May invoices
    { dealer_id: 9, inv: 'INV-2026-0509', date: '2026-05-05', items: [
      { sku_id: 1, qty: 400, price: 45 }, { sku_id: 2, qty: 250, price: 85 },
      { sku_id: 11, qty: 150, price: 185 }, { sku_id: 20, qty: 200, price: 85 },
    ]},
    { dealer_id: 9, inv: 'INV-2026-0510', date: '2026-05-18', items: [
      { sku_id: 22, qty: 60, price: 380 }, { sku_id: 26, qty: 15, price: 1850 },
      { sku_id: 16, qty: 50, price: 1250 }, { sku_id: 29, qty: 10, price: 3450 },
    ]},

    // Karthik Nair (dealer_id=12) - 2 more May invoices
    { dealer_id: 12, inv: 'INV-2026-0511', date: '2026-05-02', items: [
      { sku_id: 1, qty: 700, price: 45 }, { sku_id: 2, qty: 400, price: 85 },
      { sku_id: 11, qty: 200, price: 185 }, { sku_id: 20, qty: 300, price: 85 },
    ]},
    { dealer_id: 12, inv: 'INV-2026-0512', date: '2026-05-20', items: [
      { sku_id: 26, qty: 30, price: 1850 }, { sku_id: 29, qty: 18, price: 3450 },
      { sku_id: 22, qty: 80, price: 380 }, { sku_id: 17, qty: 40, price: 1850 },
    ]},

    // Manoj Tiwari (dealer_id=11) - 2 more May invoices
    { dealer_id: 11, inv: 'INV-2026-0513', date: '2026-05-08', items: [
      { sku_id: 1, qty: 500, price: 45 }, { sku_id: 5, qty: 200, price: 95 },
      { sku_id: 11, qty: 150, price: 185 }, { sku_id: 20, qty: 250, price: 85 },
    ]},
    { dealer_id: 11, inv: 'INV-2026-0514', date: '2026-05-22', items: [
      { sku_id: 26, qty: 20, price: 1850 }, { sku_id: 29, qty: 10, price: 3450 },
      { sku_id: 16, qty: 30, price: 1250 }, { sku_id: 18, qty: 20, price: 2950 },
    ]},
  ];

  // Insert all invoices
  for (const inv of invoiceData) {
    const dealerId = inv.dealer_id || dealerIdMap[inv.dealer!];
    if (!dealerId) continue;
    let total = 0;
    for (const item of inv.items) total += item.qty * item.price;
    const invResult = await query(
      'INSERT INTO invoices (invoice_number, dealer_id, invoice_date, total_amount) VALUES ($1,$2,$3,$4) RETURNING id',
      [inv.inv, dealerId, inv.date, total]
    );
    const invoiceId = invResult.rows[0].id;
    for (const item of inv.items) {
      await query(
        'INSERT INTO invoice_items (invoice_id, sku_id, quantity, unit_price, total_price) VALUES ($1,$2,$3,$4,$5)',
        [invoiceId, item.sku_id, item.qty, item.price, item.qty * item.price]
      );
    }
  }

  // ===== 5 NEW SCHEMES =====

  // Scheme 6: Conduit Clearance Sale (simple fixed + percentage)
  const s6 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      'Conduit Category Booster',
      'Push conduit and accessories category. Simple target: buy ₹50,000 worth of conduits, get 5% cashback. Buy ₹1,00,000+ and get 8%.',
      'SCH-COND-BOOST-2026',
      '2026-04-01', '2026-06-30', 'active',
      JSON.stringify(['north', 'south', 'west', 'east', 'central']),
      JSON.stringify(['distributor', 'wholesaler', 'retailer', 'sub_dealer']),
      'credit_note', '2026-04-01',
      'All dealers across all regions. Buy conduit products worth 50K get 5% back. Cross 1 lakh get 8% back. Simple value-based slabs.',
      'Slab-based on Conduit category value. 50K-1L = 5%, 1L+ = 8%.'
    ]
  );
  const scheme6Id = s6.rows[0].id;
  const r6_1 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme6Id, 1, 'Conduit Value Target', 7, 'value', 50000, 'slab', 0, 'total',
     'Purchase Conduit & Accessories worth ₹50K+ to earn slab-based cashback']
  );
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r6_1.rows[0].id, 50000, 100000, 'percentage', 5]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r6_1.rows[0].id, 100000, null, 'percentage', 8]);

  // Scheme 7: Multi-Category Cross-Sell Champion
  const s7 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      'Cross-Category Champion',
      'Incentivize dealers to buy across multiple categories. Individual targets on Switches, MCB, and LED with a mega combo bonus for achieving all 3.',
      'SCH-CROSS-CAT-2026',
      '2026-03-01', '2026-06-30', 'active',
      JSON.stringify(['north', 'south', 'west', 'east', 'central']),
      JSON.stringify(['distributor', 'wholesaler']),
      'voucher', '2026-03-15',
      'For all distributors and wholesalers. Buy 2L switches get 1.5%. Buy 1L MCBs get 2%. Buy 500 LED units get Rs 4/unit. Achieve ALL 3 targets get flat Rs 25000 mega bonus.',
      'Three independent category targets. Achievement of all three unlocks a flat mega bonus.'
    ]
  );
  const scheme7Id = s7.rows[0].id;
  const r7_1 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme7Id, 1, 'Switch Value Target', 1, 'value', 200000, 'percentage', 1.5, 'total',
     'Purchase ₹2L+ Modular Switches for 1.5% incentive on total switch value']
  );
  const r7_2 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme7Id, 2, 'MCB Value Target', 3, 'value', 100000, 'percentage', 2, 'total',
     'Purchase ₹1L+ MCB & Distribution for 2% incentive on total MCB value']
  );
  const r7_3 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme7Id, 3, 'LED Volume Target', 5, 'quantity', 500, 'per_unit', 4, 'all',
     'Purchase 500+ LED units for ₹4/unit on all LED units']
  );
  await query(
    `INSERT INTO scheme_bonus_rules (scheme_id, bonus_name, required_rule_ids, bonus_calc_type, bonus_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [scheme7Id, 'Cross-Category Mega Bonus', JSON.stringify([r7_1.rows[0].id, r7_2.rows[0].id, r7_3.rows[0].id]), 'fixed', 25000, 'total_purchase',
     'Achieve ALL 3 category targets to earn flat ₹25,000 mega bonus']
  );

  // Scheme 8: Socket & Outlet Push (expired scheme for historical data)
  const s8 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, is_backdated, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      'Socket Revolution Q4-2025',
      'Previous quarter scheme to push socket category adoption. Now expired but kept for reference.',
      'SCH-SOCK-Q4-2025',
      '2025-10-01', '2025-12-31', 'expired',
      JSON.stringify(['north', 'south', 'west']),
      JSON.stringify(['distributor', 'retailer']),
      'credit_note', false, '2025-10-01',
      'Push sockets category. Buy 1000 units of sockets get Rs 10 per unit. Above 2000 units get Rs 15 per unit.',
      'Quantity slab on socket category. Historical reference scheme.'
    ]
  );
  const scheme8Id = s8.rows[0].id;
  const r8_1 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme8Id, 1, 'Socket Volume Target', 2, 'quantity', 1000, 'slab', 0, 'all',
     'Purchase 1000+ sockets to earn slab-based per-unit incentive']
  );
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r8_1.rows[0].id, 1000, 2000, 'per_unit', 10]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r8_1.rows[0].id, 2000, null, 'per_unit', 15]);

  // Scheme 9: Monsoon Season Wire Safety Campaign (upcoming/draft)
  const s9 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, created_date, ai_prompt, calculation_logic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      'Monsoon Wire Safety Drive',
      'Pre-monsoon safety campaign. Push fire-resistant wires and heavy-gauge cables with aggressive incentives.',
      'SCH-WIRE-MON-2026',
      '2026-06-01', '2026-08-31', 'draft',
      JSON.stringify(['north', 'south', 'west', 'east', 'central']),
      JSON.stringify(['distributor', 'wholesaler', 'retailer']),
      'credit_note', '2026-04-10',
      'All dealers. Wire value above 3L get 2%. Above 5L get 3.5%. Above 10L get 5%. Extra Rs 200/coil bonus for 2.5sqmm and 4.0sqmm wires if quantity exceeds 100 coils.',
      'Slab on wire value + additional per-unit for premium wires. Draft - not yet active.'
    ]
  );
  const scheme9Id = s9.rows[0].id;
  const r9_1 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scheme9Id, 1, 'Wire Category Value Slabs', 4, 'value', 300000, 'slab', 0, 'total',
     'Purchase Wires worth ₹3L+ to earn slab-based percentage incentive']
  );
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r9_1.rows[0].id, 300000, 500000, 'percentage', 2]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r9_1.rows[0].id, 500000, 1000000, 'percentage', 3.5]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r9_1.rows[0].id, 1000000, null, 'percentage', 5]);

  await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, sku_category_id, condition_type, min_threshold, incentive_calc_type, incentive_value, is_additional, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [scheme9Id, 2, 'Premium Wire Bonus', 4, 'quantity', 100, 'per_unit', 200, true, 'above_threshold',
     'Buy 100+ coils of any wire for ₹200 bonus per coil above 100']
  );

  // Scheme 10: Mega Festival Dhamaka (all categories, aggressive)
  const s10 = await query(
    `INSERT INTO schemes (name, description, scheme_code, start_date, end_date, status, applicable_regions, applicable_dealer_types, incentive_type, created_date, ai_prompt, calculation_logic, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      'Mega Festival Dhamaka 2026',
      'All-category festival scheme with progressive value slabs. Biggest scheme of the year covering all product categories with extra bonus for diversified buying.',
      'SCH-FEST-MEGA-2026',
      '2026-04-01', '2026-05-31', 'active',
      JSON.stringify(['north', 'south', 'west', 'east', 'central']),
      JSON.stringify(['distributor', 'wholesaler', 'retailer', 'sub_dealer', 'project_dealer']),
      'credit_note', '2026-04-01',
      'Festival season mega scheme for ALL dealers. Total purchase across all categories: 5L = 1%, 10L = 2%, 20L = 3%. Extra 0.5% bonus if dealer buys from 4+ different categories.',
      'Progressive slab on total cross-category purchase value. Diversification bonus for buying across 4+ categories.',
      'Approved by VP Sales. Budget cap: ₹50L total payout across all dealers.'
    ]
  );
  const scheme10Id = s10.rows[0].id;
  const r10_1 = await query(
    `INSERT INTO scheme_rules (scheme_id, rule_order, rule_name, condition_type, min_threshold, incentive_calc_type, incentive_value, apply_on, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [scheme10Id, 1, 'Total Purchase Value Slabs', 'value', 500000, 'slab', 0, 'total',
     'Total purchase across ALL categories worth ₹5L+ to earn slab-based incentive']
  );
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r10_1.rows[0].id, 500000, 1000000, 'percentage', 1]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r10_1.rows[0].id, 1000000, 2000000, 'percentage', 2]);
  await query('INSERT INTO scheme_slabs (rule_id, slab_from, slab_to, incentive_calc_type, incentive_value) VALUES ($1,$2,$3,$4,$5)', [r10_1.rows[0].id, 2000000, null, 'percentage', 3]);

  // Diversification bonus rule for scheme 10
  await query(
    `INSERT INTO scheme_bonus_rules (scheme_id, bonus_name, required_rule_ids, bonus_calc_type, bonus_value, apply_on, description, min_threshold)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [scheme10Id, 'Category Diversification Bonus', JSON.stringify([r10_1.rows[0].id]), 'percentage', 0.5, 'total_purchase',
     'Buy from 4+ different product categories for extra 0.5% on total purchase value', 500000]
  );

  // Get counts for report
  const dealerTotal = await getAll('SELECT COUNT(*) as count FROM dealers');
  const invoiceTotal = await getAll('SELECT COUNT(*) as count FROM invoices');
  const itemTotal = await getAll('SELECT COUNT(*) as count FROM invoice_items');
  const schemeTotal = await getAll('SELECT COUNT(*) as count FROM schemes');
  const ruleTotal = await getAll('SELECT COUNT(*) as count FROM scheme_rules');

  return {
    message: 'Extended seed completed!',
    dealers: Number(dealerTotal[0].count),
    invoices: Number(invoiceTotal[0].count),
    invoice_items: Number(itemTotal[0].count),
    schemes: Number(schemeTotal[0].count),
    rules: Number(ruleTotal[0].count),
    new_dealers_added: 20,
    new_invoices_added: invoiceData.length,
    new_schemes_added: 5,
  };
}

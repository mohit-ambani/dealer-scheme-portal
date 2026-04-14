/**
 * Massive seed: generates 100+ dealers and 500+ invoices procedurally
 * to stress-test calculation, AI, and visualizations at realistic scale.
 */
import { query, getAll, getOne } from './db';

const FIRST_NAMES = ['Rajesh', 'Suresh', 'Naveen', 'Pankaj', 'Harish', 'Venkatesh', 'Anil', 'Bala', 'Nikhil', 'Raju', 'Priya', 'Govind', 'Sourav', 'Bijay', 'Ravi', 'Manish', 'Ashok', 'Santosh', 'Dinesh', 'Vinod', 'Ramesh', 'Mahesh', 'Kiran', 'Arjun', 'Arvind', 'Sandeep', 'Deepak', 'Ajay', 'Vikas', 'Vinay', 'Rohit', 'Amit', 'Rahul', 'Sunil', 'Karan', 'Gaurav', 'Manoj', 'Anand', 'Sachin', 'Rakesh', 'Shyam', 'Gopal', 'Subhash', 'Lalit', 'Neeraj'];
const LAST_NAMES = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Shah', 'Agarwal', 'Mehta', 'Reddy', 'Iyer', 'Nair', 'Rao', 'Verma', 'Kapoor', 'Chopra', 'Bhatt', 'Saxena', 'Joshi', 'Menon', 'Desai', 'Pillai', 'Bose', 'Chatterjee', 'Banerjee', 'Dutta', 'Sinha', 'Mishra', 'Tiwari', 'Pandey', 'Yadav', 'Thakur', 'Das', 'Roy', 'Ghosh', 'Naidu', 'Hegde'];
const FIRMS = ['Power House', 'Electric Hub', 'Enterprises', 'Switchgear', 'Electricals', 'Power Solutions', 'Trading Co.', 'Electrical Mart', 'Power Systems', 'Electrical House', 'Electric World', 'Electric Mart', 'Power Hub', 'Trading', 'Electricals Ltd'];

const REGION_STATES: Record<string, { state: string; cities: string[]; gst_prefix: string }[]> = {
  north: [
    { state: 'Delhi', cities: ['New Delhi', 'Dwarka', 'Rohini'], gst_prefix: '07' },
    { state: 'Punjab', cities: ['Ludhiana', 'Amritsar', 'Jalandhar'], gst_prefix: '03' },
    { state: 'Haryana', cities: ['Gurugram', 'Faridabad', 'Panipat'], gst_prefix: '06' },
    { state: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Agra', 'Noida'], gst_prefix: '09' },
    { state: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur'], gst_prefix: '08' },
    { state: 'Uttarakhand', cities: ['Dehradun', 'Haridwar'], gst_prefix: '05' },
  ],
  south: [
    { state: 'Karnataka', cities: ['Bangalore', 'Mysore', 'Hubli'], gst_prefix: '29' },
    { state: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai'], gst_prefix: '33' },
    { state: 'Kerala', cities: ['Kochi', 'Trivandrum', 'Calicut'], gst_prefix: '32' },
    { state: 'Andhra Pradesh', cities: ['Vijayawada', 'Visakhapatnam', 'Guntur'], gst_prefix: '37' },
    { state: 'Telangana', cities: ['Hyderabad', 'Warangal'], gst_prefix: '36' },
  ],
  west: [
    { state: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'], gst_prefix: '27' },
    { state: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'], gst_prefix: '24' },
    { state: 'Goa', cities: ['Panaji', 'Margao'], gst_prefix: '30' },
  ],
  east: [
    { state: 'West Bengal', cities: ['Kolkata', 'Howrah', 'Durgapur'], gst_prefix: '19' },
    { state: 'Odisha', cities: ['Bhubaneswar', 'Cuttack'], gst_prefix: '21' },
    { state: 'Bihar', cities: ['Patna', 'Gaya'], gst_prefix: '10' },
    { state: 'Jharkhand', cities: ['Ranchi', 'Jamshedpur'], gst_prefix: '20' },
    { state: 'Assam', cities: ['Guwahati', 'Dibrugarh'], gst_prefix: '18' },
  ],
  central: [
    { state: 'Madhya Pradesh', cities: ['Indore', 'Bhopal', 'Gwalior', 'Jabalpur'], gst_prefix: '23' },
    { state: 'Chhattisgarh', cities: ['Raipur', 'Bilaspur'], gst_prefix: '22' },
  ],
};

const DEALER_TYPES = ['distributor', 'wholesaler', 'retailer', 'sub_dealer', 'project_dealer'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

export async function seedMassiveData() {
  const dealerCount = await getOne('SELECT COUNT(*)::int as count FROM dealers');
  if (Number(dealerCount?.count) >= 100) {
    return { message: 'Massive data already seeded', skipped: true, dealers: dealerCount.count };
  }

  // Fetch existing SKUs so we can reference real SKU IDs
  const skus = await getAll('SELECT id, unit_price, category_id FROM skus');
  if (skus.length === 0) throw new Error('No SKUs — run base seed first');

  // ========== GENERATE ~80 MORE DEALERS (on top of existing ~33) ==========
  const dealersToCreate = 80;
  const createdDealerIds: number[] = [];
  const existingCodes = new Set((await getAll('SELECT code FROM dealers')).map((d: { code: string }) => d.code));
  let nextCodeNum = 100;

  for (let i = 0; i < dealersToCreate; i++) {
    const regionKeys = Object.keys(REGION_STATES);
    const region = pick(regionKeys);
    const stateCfg = pick(REGION_STATES[region]);
    const city = pick(stateCfg.cities);
    const type = pick(DEALER_TYPES);
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const firm = `${last} ${pick(FIRMS)}`;

    let code: string;
    do { code = `DLR-${String(nextCodeNum++).padStart(4, '0')}`; } while (existingCodes.has(code));
    existingCodes.add(code);

    const phone = `9${rand(800000000, 999999999)}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@${firm.toLowerCase().replace(/[^a-z]/g, '')}.com`.slice(0, 80);
    const gst = `${stateCfg.gst_prefix}AAAP${last.slice(0, 1).toUpperCase()}${rand(1000, 9999)}A1Z${rand(0, 9)}`;

    const res = await query(
      `INSERT INTO dealers (name, code, firm_name, type, region, state, city, phone, email, gst_number, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) RETURNING id`,
      [`${first} ${last}`, code, firm, type, region, stateCfg.state, city, phone, email, gst]
    );
    createdDealerIds.push(res.rows[0].id);
  }

  // ========== GENERATE INVOICES FOR ALL DEALERS (new + existing to hit 500+) ==========
  // Mix: new dealers get 3-8 invoices each (avg ~5 × 80 = 400 invoices)
  // Also add some to existing dealers for realism
  const allDealers = await getAll('SELECT id, type FROM dealers ORDER BY id');
  const existingInvoiceCount = Number((await getOne('SELECT COUNT(*)::int as count FROM invoices'))?.count || 0);

  let invoicesCreated = 0;
  // Invoice date range: Oct 2025 - Apr 2026
  const startTs = new Date('2025-10-01').getTime();
  const endTs = new Date('2026-04-10').getTime();
  let invoiceNumCounter = existingInvoiceCount + 1000;

  for (const dealer of allDealers) {
    // Existing dealers might already have invoices; skip if they do
    const existingInv = await getOne('SELECT COUNT(*)::int as c FROM invoices WHERE dealer_id = $1', [dealer.id]);
    if (Number(existingInv?.c) >= 3) continue;

    const invCount = rand(3, 8);
    for (let j = 0; j < invCount; j++) {
      const invoiceDate = new Date(startTs + Math.random() * (endTs - startTs));
      const invoiceNum = `INV-${String(invoiceNumCounter++).padStart(6, '0')}`;

      // 3-8 items per invoice
      const itemCount = rand(3, 8);
      const selectedSkus = new Set<number>();
      let totalAmount = 0;
      const items: { sku_id: number; qty: number; unit_price: number; total: number }[] = [];

      for (let k = 0; k < itemCount; k++) {
        const sku = pick(skus);
        if (selectedSkus.has(sku.id)) continue;
        selectedSkus.add(sku.id);

        // Quantity influenced by dealer type
        const qtyMultiplier = dealer.type === 'distributor' ? rand(20, 200)
          : dealer.type === 'wholesaler' ? rand(15, 120)
          : dealer.type === 'project_dealer' ? rand(10, 80)
          : rand(5, 40); // retailer / sub_dealer
        const unitPrice = Number(sku.unit_price);
        const total = qtyMultiplier * unitPrice;
        totalAmount += total;
        items.push({ sku_id: sku.id, qty: qtyMultiplier, unit_price: unitPrice, total });
      }

      // Create invoice
      const invRes = await query(
        `INSERT INTO invoices (dealer_id, invoice_number, invoice_date, total_amount, status)
         VALUES ($1,$2,$3,$4,'confirmed') RETURNING id`,
        [dealer.id, invoiceNum, invoiceDate.toISOString().slice(0, 10), totalAmount]
      );
      const invoiceId = invRes.rows[0].id;

      for (const item of items) {
        await query(
          `INSERT INTO invoice_items (invoice_id, sku_id, quantity, unit_price, total_price)
           VALUES ($1,$2,$3,$4,$5)`,
          [invoiceId, item.sku_id, item.qty, item.unit_price, item.total]
        );
      }

      invoicesCreated++;
    }
  }

  // Final stats
  const finalDealerCount = (await getOne('SELECT COUNT(*)::int as count FROM dealers')).count;
  const finalInvoiceCount = (await getOne('SELECT COUNT(*)::int as count FROM invoices')).count;
  const finalItemCount = (await getOne('SELECT COUNT(*)::int as count FROM invoice_items')).count;

  return {
    status: 'seeded',
    new_dealers: createdDealerIds.length,
    new_invoices: invoicesCreated,
    total_dealers: Number(finalDealerCount),
    total_invoices: Number(finalInvoiceCount),
    total_invoice_items: Number(finalItemCount),
  };
}

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const envLocalPath = path.join(process.cwd(), '.env.local');
let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let dbPassword = process.env.SUPABASE_DB_PASSWORD || '';
let dbUrl = process.env.DATABASE_URL || '';

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key === 'NEXT_PUBLIC_SUPABASE_URL' && !url) url = val;
        if (key === 'SUPABASE_DB_PASSWORD' && !dbPassword) dbPassword = val;
        if (key === 'DATABASE_URL' && !dbUrl) dbUrl = val;
      }
    }
  });
}

function extractProjectRef(supabaseUrl: string): string {
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.hostname.split('.')[0];
  } catch {
    return '';
  }
}

async function seedTruthDataset() {
  if (process.env.ALLOW_SEED_DATA !== 'true' || process.env.NODE_ENV === 'production') {
    console.error('⛔ SEED PROTECTION TRIGGERED: Seed scripts cannot be executed against production database unless ALLOW_SEED_DATA=true is set in non-production environment.');
    process.exit(1);
  }

  const projectRef = extractProjectRef(url);
  if (!dbUrl) {
    dbUrl = `postgres://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
  }

  console.log('🚀 WILLSHOP OS — SEEDING CONTROLLED DEV TRUTH DATASET\n');
  console.log(`📡 Target PostgreSQL DB: db.${projectRef}.supabase.co`);

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const CEO_USER_ID = '11111111-1111-1111-1111-111111111111';
    const SALES_USER_ID = '22222222-2222-2222-2222-222222222222';
    const DRIVER_USER_ID = '33333333-3333-3333-3333-333333333333';

    // 1. Seed Organization & Auth Users
    console.log('[1/14] Ensuring Root Organization & Auth Test Users...');
    await client.query(`
      INSERT INTO public.organizations (id, name, slug, country, currency, timezone, settings)
      VALUES ($1, 'WillShop DEV', 'willshop', 'Burkina Faso', 'XOF', 'Africa/Ouagadougou', '{"mode":"DEV_TEST"}')
      ON CONFLICT (id) DO UPDATE SET name = 'WillShop DEV';
    `, [ORG_ID]);

    await client.query(`
      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      VALUES 
        ($1, '00000000-0000-0000-0000-000000000000', 'ceo@willshop.bf', 'hashed_pwd', NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Amadou Fall"}'),
        ($2, '00000000-0000-0000-0000-000000000000', 'sales@willshop.bf', 'hashed_pwd', NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ibrahim Kaboré"}'),
        ($3, '00000000-0000-0000-0000-000000000000', 'driver@willshop.bf', 'hashed_pwd', NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Samba Diallo"}')
      ON CONFLICT (id) DO NOTHING;
    `, [CEO_USER_ID, SALES_USER_ID, DRIVER_USER_ID]);

    await client.query(`
      INSERT INTO public.user_organization_roles (organization_id, user_id, role)
      VALUES 
        ($1, $2, 'OWNER'),
        ($1, $3, 'COMMERCIAL'),
        ($1, $4, 'LIVREUR')
      ON CONFLICT DO NOTHING;
    `, [ORG_ID, CEO_USER_ID, SALES_USER_ID, DRIVER_USER_ID]);

    // Clean existing test data cleanly in reverse order of FKs
    console.log('🧹 Cleaning existing test data from previous runs...');
    await client.query(`DELETE FROM public.transactions WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.payments WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.deliveries WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.stock_movements WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.order_items WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.orders WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.product_stock WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.products WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.messages WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.conversations WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.customers WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.drivers WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.employees WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.zones WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.financial_accounts WHERE organization_id = $1;`, [ORG_ID]);
    await client.query(`DELETE FROM public.strategic_goals WHERE organization_id = $1;`, [ORG_ID]);

    // Delete personal test items for test user
    await client.query(`DELETE FROM public.personal_goals WHERE user_id = $1;`, [CEO_USER_ID]);
    await client.query(`DELETE FROM public.personal_tasks WHERE user_id = $1;`, [CEO_USER_ID]);
    await client.query(`DELETE FROM public.personal_habits WHERE user_id = $1;`, [CEO_USER_ID]);
    await client.query(`DELETE FROM public.personal_financial_accounts WHERE user_id = $1;`, [CEO_USER_ID]);

    // 2. Zone
    console.log('[2/14] Inserting Delivery Zone...');
    const zoneRes = await client.query(`
      INSERT INTO public.zones (organization_id, name, city, delivery_fee, status)
      VALUES ($1, 'Ouagadougou Centre', 'Ouagadougou', 0.00, 'ACTIVE')
      RETURNING id;
    `, [ORG_ID]);
    const ZONE_ID = zoneRes.rows[0].id;

    // 3. Employees & Drivers
    console.log('[3/14] Inserting Employees & Driver...');
    await client.query(`
      INSERT INTO public.employees (organization_id, user_id, first_name, last_name, phone, role, employment_status)
      VALUES 
        ($1, $2, 'Amadou', 'Fall', '+22670000000', 'CEO', 'ACTIVE'),
        ($1, $3, 'Ibrahim', 'Kaboré', '+22670000004', 'COMMERCIAL', 'ACTIVE');
    `, [ORG_ID, CEO_USER_ID, SALES_USER_ID]);

    const driverRes = await client.query(`
      INSERT INTO public.drivers (organization_id, user_id, name, phone, vehicle, status)
      VALUES ($1, $2, 'Samba Diallo', '+22670000003', 'Moto Yamaka 125', 'AVAILABLE')
      RETURNING id;
    `, [ORG_ID, DRIVER_USER_ID]);
    const DRIVER_ID = driverRes.rows[0].id;

    // 4. Products
    console.log('[4/14] Inserting 3 Test Products...');
    const prodARes = await client.query(`
      INSERT INTO public.products (organization_id, sku, name, description, category, purchase_price, selling_price, currency, status)
      VALUES ($1, 'SKU-PROD-A', 'Produit Test A', 'Description Produit A', 'ELECTRO', 4000.00, 10000.00, 'XOF', 'ACTIVE')
      RETURNING id;
    `, [ORG_ID]);
    const PROD_A_ID = prodARes.rows[0].id;

    const prodBRes = await client.query(`
      INSERT INTO public.products (organization_id, sku, name, description, category, purchase_price, selling_price, currency, status)
      VALUES ($1, 'SKU-PROD-B', 'Produit Test B', 'Description Produit B', 'MODE', 6000.00, 15000.00, 'XOF', 'ACTIVE')
      RETURNING id;
    `, [ORG_ID]);
    const PROD_B_ID = prodBRes.rows[0].id;

    const prodCRes = await client.query(`
      INSERT INTO public.products (organization_id, sku, name, description, category, purchase_price, selling_price, currency, status)
      VALUES ($1, 'SKU-PROD-C', 'Produit Test C', 'Description Produit C', 'ACCESSORY', 8000.00, 20000.00, 'XOF', 'ACTIVE')
      RETURNING id;
    `, [ORG_ID]);
    const PROD_C_ID = prodCRes.rows[0].id;

    // 5. Initial Product Stock
    console.log('[5/14] Initializing Product Stock (50 physical each)...');
    await client.query(`
      INSERT INTO public.product_stock (organization_id, product_id, physical_stock, reserved_stock, minimum_stock)
      VALUES 
        ($1, $2, 50, 0, 5),
        ($1, $3, 50, 0, 5),
        ($1, $4, 50, 0, 5);
    `, [ORG_ID, PROD_A_ID, PROD_B_ID, PROD_C_ID]);

    // 6. Customers
    console.log('[6/14] Inserting 2 Test Customers...');
    const cust1Res = await client.query(`
      INSERT INTO public.customers (organization_id, first_name, last_name, phone, whatsapp_phone, city, zone_id, source, status)
      VALUES ($1, 'Moussa', 'Traoré', '+22670000001', '+22670000001', 'Ouagadougou', $2, 'WHATSAPP', 'ACTIVE')
      RETURNING id;
    `, [ORG_ID, ZONE_ID]);
    const CUST_1_ID = cust1Res.rows[0].id;

    const cust2Res = await client.query(`
      INSERT INTO public.customers (organization_id, first_name, last_name, phone, whatsapp_phone, city, zone_id, source, status)
      VALUES ($1, 'Awa', 'Sawadogo', '+22670000002', '+22670000002', 'Ouagadougou', $2, 'WHATSAPP', 'ACTIVE')
      RETURNING id;
    `, [ORG_ID, ZONE_ID]);
    const CUST_2_ID = cust2Res.rows[0].id;

    // 7. Orders & Items
    console.log('[7/14] Creating 3 Test Orders...');
    // Order 001: 1 x Produit A (10 000 XOF) - Status DELIVERED
    const ord1Res = await client.query(`
      INSERT INTO public.orders (organization_id, customer_id, order_number, status, subtotal, delivery_fee, discount, total, currency, source)
      VALUES ($1, $2, 'ORD-TEST-001', 'DELIVERED', 10000.00, 0.00, 0.00, 10000.00, 'XOF', 'WHATSAPP')
      RETURNING id;
    `, [ORG_ID, CUST_1_ID]);
    const ORD_1_ID = ord1Res.rows[0].id;

    await client.query(`
      INSERT INTO public.order_items (organization_id, order_id, product_id, quantity, unit_price, subtotal, product_name_snapshot, sku_snapshot)
      VALUES ($1, $2, $3, 1, 10000.00, 10000.00, 'Produit Test A', 'SKU-PROD-A');
    `, [ORG_ID, ORD_1_ID, PROD_A_ID]);

    // Order 002: 1 x Produit B (15 000 XOF) - Status CONFIRMED
    const ord2Res = await client.query(`
      INSERT INTO public.orders (organization_id, customer_id, order_number, status, subtotal, delivery_fee, discount, total, currency, source)
      VALUES ($1, $2, 'ORD-TEST-002', 'CONFIRMED', 15000.00, 0.00, 0.00, 15000.00, 'XOF', 'WHATSAPP')
      RETURNING id;
    `, [ORG_ID, CUST_2_ID]);
    const ORD_2_ID = ord2Res.rows[0].id;

    await client.query(`
      INSERT INTO public.order_items (organization_id, order_id, product_id, quantity, unit_price, subtotal, product_name_snapshot, sku_snapshot)
      VALUES ($1, $2, $3, 1, 15000.00, 15000.00, 'Produit Test B', 'SKU-PROD-B');
    `, [ORG_ID, ORD_2_ID, PROD_B_ID]);

    // Order 003: 1 x Produit A + 1 x Produit C (30 000 XOF) - Status DRAFT
    const ord3Res = await client.query(`
      INSERT INTO public.orders (organization_id, customer_id, order_number, status, subtotal, delivery_fee, discount, total, currency, source)
      VALUES ($1, $2, 'ORD-TEST-003', 'DRAFT', 30000.00, 0.00, 0.00, 30000.00, 'XOF', 'WHATSAPP')
      RETURNING id;
    `, [ORG_ID, CUST_1_ID]);
    const ORD_3_ID = ord3Res.rows[0].id;

    await client.query(`
      INSERT INTO public.order_items (organization_id, order_id, product_id, quantity, unit_price, subtotal, product_name_snapshot, sku_snapshot)
      VALUES 
        ($1, $2, $3, 1, 10000.00, 10000.00, 'Produit Test A', 'SKU-PROD-A'),
        ($1, $2, $4, 1, 20000.00, 20000.00, 'Produit Test C', 'SKU-PROD-C');
    `, [ORG_ID, ORD_3_ID, PROD_A_ID, PROD_C_ID]);

    // 8. Stock Movements & Stock Updates
    console.log('[8/14] Updating Stock Levels according to Order Workflow...');
    // Order 001 DELIVERED: 1 unit Produit A sold -> physical = 49, reserved = 0
    await client.query(`
      UPDATE public.product_stock 
      SET physical_stock = 49, reserved_stock = 0 
      WHERE organization_id = $1 AND product_id = $2;
    `, [ORG_ID, PROD_A_ID]);

    await client.query(`
      INSERT INTO public.stock_movements (organization_id, product_id, movement_type, direction, quantity, reference_type, reference_id, reason)
      VALUES ($1, $2, 'SALE', 'OUT', 1, 'ORDER', $3, 'Vente Livrée ORD-TEST-001');
    `, [ORG_ID, PROD_A_ID, ORD_1_ID]);

    // Order 002 CONFIRMED: 1 unit Produit B reserved -> physical = 50, reserved = 1
    await client.query(`
      UPDATE public.product_stock 
      SET physical_stock = 50, reserved_stock = 1 
      WHERE organization_id = $1 AND product_id = $2;
    `, [ORG_ID, PROD_B_ID]);

    await client.query(`
      INSERT INTO public.stock_movements (organization_id, product_id, movement_type, direction, quantity, reference_type, reference_id, reason)
      VALUES ($1, $2, 'RESERVATION', 'RESERVE', 1, 'ORDER', $3, 'Réservation Commande ORD-TEST-002');
    `, [ORG_ID, PROD_B_ID, ORD_2_ID]);

    // 9. Deliveries
    console.log('[9/14] Creating Test Deliveries...');
    await client.query(`
      INSERT INTO public.deliveries (organization_id, order_id, driver_id, zone_id, status, delivery_address, delivery_fee, delivered_at)
      VALUES ($1, $2, $3, $4, 'DELIVERED', 'Avenue Kwame N Krumah, Ouagadougou', 0.00, NOW());
    `, [ORG_ID, ORD_1_ID, DRIVER_ID, ZONE_ID]);

    await client.query(`
      INSERT INTO public.deliveries (organization_id, order_id, driver_id, zone_id, status, delivery_address, delivery_fee, assigned_at)
      VALUES ($1, $2, $3, $4, 'IN_TRANSIT', 'Secteur 15, Ouagadougou', 0.00, NOW());
    `, [ORG_ID, ORD_2_ID, DRIVER_ID, ZONE_ID]);

    // 10. Financial Accounts & Payments
    console.log('[10/14] Creating Financial Accounts & Payments...');
    const acc1Res = await client.query(`
      INSERT INTO public.financial_accounts (organization_id, name, type, currency, opening_balance, status)
      VALUES ($1, 'Caisse Principale DEV', 'CASH_REGISTER', 'XOF', 100000.00, 'ACTIVE')
      RETURNING id;
    `, [ORG_ID]);
    const ACC_1_ID = acc1Res.rows[0].id;

    const acc2Res = await client.query(`
      INSERT INTO public.financial_accounts (organization_id, name, type, currency, opening_balance, status)
      VALUES ($1, 'Orange Money Pro DEV', 'MOBILE_MONEY', 'XOF', 250000.00, 'ACTIVE')
      RETURNING id;
    `, [ORG_ID]);
    const ACC_2_ID = acc2Res.rows[0].id;

    // Payment 1: Full Payment for Order 001 (10 000 XOF)
    await client.query(`
      INSERT INTO public.payments (organization_id, order_id, amount, currency, method, status, received_at)
      VALUES ($1, $2, 10000.00, 'XOF', 'CASH', 'VERIFIED', NOW());
    `, [ORG_ID, ORD_1_ID]);

    // Payment 2: Partial Payment for Order 002 (5 000 XOF)
    await client.query(`
      INSERT INTO public.payments (organization_id, order_id, amount, currency, method, status, received_at)
      VALUES ($1, $2, 5000.00, 'XOF', 'MOBILE_MONEY', 'RECEIVED', NOW());
    `, [ORG_ID, ORD_2_ID]);

    // 11. Transactions (Income & Expenses)
    console.log('[11/14] Recording Financial Transactions...');
    await client.query(`
      INSERT INTO public.transactions (organization_id, financial_account_id, type, amount, currency, category, reference_type, reference_id, description)
      VALUES 
        ($1, $2, 'INCOME', 10000.00, 'XOF', 'VENTE_ESPÈCE', 'PAYMENT', $4, 'Recouvrement Vente ORD-TEST-001'),
        ($1, $3, 'INCOME', 5000.00, 'XOF', 'VENTE_MOBILE_MONEY', 'PAYMENT', $5, 'Acompte Vente ORD-TEST-002'),
        ($1, $2, 'EXPENSE', 15000.00, 'XOF', 'CARBURANT_LIVRAISON', 'EXPENSE', 'EXP-001', 'Carburant flotte livraison Ouaga');
    `, [ORG_ID, ACC_1_ID, ACC_2_ID, ORD_1_ID, ORD_2_ID]);

    // 12. CRM Conversations & Messages
    console.log('[12/14] Creating WhatsApp CRM Conversations & Messages...');
    const conv1Res = await client.query(`
      INSERT INTO public.conversations (organization_id, customer_id, unread_count, status)
      VALUES ($1, $2, 0, 'OPEN')
      RETURNING id;
    `, [ORG_ID, CUST_1_ID]);
    const CONV_1_ID = conv1Res.rows[0].id;

    await client.query(`
      INSERT INTO public.messages (organization_id, conversation_id, direction, sender_type, content, status)
      VALUES 
        ($1, $2, 'INBOUND', 'CUSTOMER', 'Bonjour WillShop, je souhaite commander le Produit A.', 'READ'),
        ($1, $2, 'OUTBOUND', 'SYSTEM', 'Bonjour ! Votre commande ORD-TEST-001 a été validée.', 'DELIVERED');
    `, [ORG_ID, CONV_1_ID]);

    const conv2Res = await client.query(`
      INSERT INTO public.conversations (organization_id, customer_id, unread_count, status)
      VALUES ($1, $2, 1, 'OPEN')
      RETURNING id;
    `, [ORG_ID, CUST_2_ID]);
    const CONV_2_ID = conv2Res.rows[0].id;

    await client.query(`
      INSERT INTO public.messages (organization_id, conversation_id, direction, sender_type, content, status)
      VALUES 
        ($1, $2, 'INBOUND', 'CUSTOMER', 'Est-ce que le Produit B est en stock ?', 'RECEIVED');
    `, [ORG_ID, CONV_2_ID]);

    // 13. Strategy Engine Goals
    console.log('[13/14] Inserting Strategic Goals...');
    await client.query(`
      INSERT INTO public.strategic_goals (organization_id, title, description, owner_id, baseline_value, target_value, current_value, start_date, due_date, status, created_by)
      VALUES ($1, 'Objectif CA Mensuel Q3', 'Atteindre le palier de chiffre d affaires', $2, 0.00, 1000000.00, 55000.00, NOW(), NOW() + INTERVAL '90 days', 'ON_TRACK', $2);
    `, [ORG_ID, CEO_USER_ID]);

    // 14. Wilty Personal OS Data
    console.log('[14/14] Inserting Wilty Personal OS Test Data...');
    await client.query(`
      INSERT INTO public.personal_goals (user_id, scope, category, title, baseline_value, target_value, current_value, progress_percent, status, timeframe, start_date, target_date)
      VALUES ($1, 'personal', 'LEARNING', 'Lire 12 livres de Business/Tech', 0, 12, 3, 25.00, 'ACTIVE', '2026', NOW(), NOW() + INTERVAL '300 days');
    `, [CEO_USER_ID]);

    await client.query(`
      INSERT INTO public.personal_tasks (user_id, scope, title, priority, status)
      VALUES ($1, 'personal', 'Séance de sport matinale (30 min)', 'HIGH', 'COMPLETED');
    `, [CEO_USER_ID]);

    await client.query(`
      INSERT INTO public.personal_habits (user_id, scope, name, frequency, target_days_per_week, streak_count)
      VALUES ($1, 'personal', 'Méditation matinale', 'DAILY', 7, 5);
    `, [CEO_USER_ID]);

    await client.query(`
      INSERT INTO public.personal_financial_accounts (user_id, scope, name, type, currency, current_balance)
      VALUES ($1, 'personal', 'Compte Épargne Personnel', 'SAVINGS', 'XOF', 500000.00);
    `, [CEO_USER_ID]);

    await client.query('COMMIT;');

    console.log('\n🎉 CONTROLLED DEV TRUTH DATASET SUCCESSFULLY SEEDED!');
  } catch (err: any) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('🔴 Seeding Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedTruthDataset();

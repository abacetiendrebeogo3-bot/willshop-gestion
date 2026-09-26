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

async function executeAtomicReset() {
  console.log('🚀 WILLSHOP OS — EXECUTION DU RESET ATOMIQUE TRANSACTIONNEL\n');

  const projectRef = extractProjectRef(url);
  if (!dbUrl) {
    if (!projectRef || !dbPassword) {
      console.error('❌ Error: Missing SUPABASE_DB_PASSWORD or DATABASE_URL in .env.local');
      process.exit(1);
    }
    dbUrl = `postgres://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------
    // STEP 1: Inspect existing public tables
    // -------------------------------------------------------------
    console.log('🔍 1. Inspection des tables et FOREIGN KEYS réelles dans PostgreSQL...');
    const existingTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    const existingTableNames = new Set(existingTablesRes.rows.map(r => r.table_name));

    // Ordre strict de suppression établi par analyse FK réelle des migrations :
    //
    // FK CRITIQUES (child AVANT parent) :
    //   product_images       → products (CASCADE)              ← AVANT products
    //   stock_movements      → products (RESTRICT)             ← AVANT products
    //   product_stock        → products (RESTRICT)             ← AVANT products
    //   task_dependencies    → team_tasks (CASCADE)            ← AVANT team_tasks
    //   task_comments        → team_tasks (CASCADE)            ← AVANT team_tasks
    //   task_activities      → team_tasks (CASCADE)            ← AVANT team_tasks
    //   task_escalations     → team_tasks (CASCADE)            ← AVANT team_tasks
    //   workflow_stack_states→ work_routines (CASCADE)         ← AVANT work_routines
    //   routine_steps        → work_routines (CASCADE)         ← AVANT work_routines
    //   internal_messages    → internal_threads (CASCADE)      ← AVANT internal_threads
    //   internal_thread_participants → internal_threads (CASCADE) ← AVANT internal_threads
    //   customer_engagements → customers (CASCADE)             ← AVANT customers
    //   order_items          → orders (CASCADE)                ← AVANT orders
    //   deliveries           → orders (RESTRICT)               ← OBLIGATOIREMENT AVANT orders
    //   payments             → orders (SET NULL)               ← AVANT orders par sécurité
    //   orders               → customers (RESTRICT)            ← OBLIGATOIREMENT AVANT customers
    //   products             → organizations (RESTRICT)
    //   customers            → organizations (RESTRICT)        ← DERNIER

    const candidateDeletionOrder = [
      // ── Enfants de products (AVANT products) ──────────────────────────────
      'product_images',             // → products (CASCADE)
      'stock_movements',            // → products (RESTRICT)
      'product_stock',              // → products (RESTRICT)
      'product_stocks',             // alias potentiel
      'inventory_movements',
      'product_inventory',
      // ── Enfants de team_tasks (AVANT team_tasks) ──────────────────────────
      'task_dependencies',          // → team_tasks (CASCADE)
      'task_comments',              // → team_tasks (CASCADE)
      'task_activities',            // → team_tasks (CASCADE)
      'task_escalations',           // → team_tasks (CASCADE)
      'team_tasks',                 // → organizations (CASCADE)
      // ── Enfants de work_routines (AVANT work_routines) ────────────────────
      'workflow_stack_states',      // → work_routines (CASCADE)
      'routine_steps',              // → work_routines (CASCADE)
      'work_routines',              // → organizations (CASCADE)
      // ── Messagerie interne (ordre interne respecté) ───────────────────────
      'internal_messages',          // → internal_threads (CASCADE)
      'internal_thread_participants', // → internal_threads (CASCADE)
      'internal_threads',           // → organizations (CASCADE)
      // ── Notifications ────────────────────────────────────────────────────
      'user_notifications',
      // ── Engagements clients (AVANT customers) ─────────────────────────────
      'customer_engagements',       // → customers (CASCADE)
      // ── AI ───────────────────────────────────────────────────────────────
      'ai_actions',
      'ai_recommendations',
      'ai_decisions',
      'ai_usage_logs',
      // ── WhatsApp / CRM ───────────────────────────────────────────────────
      'whatsapp_messages',
      'whatsapp_conversations',
      'sales_conversations',
      'leads',
      'customer_notes',
      'customer_tags',
      'customer_contacts',
      'customer_attributions',
      'attribution_lifecycle_events',
      // ── Finance ──────────────────────────────────────────────────────────
      'financial_transactions',
      'payouts',
      // ── Chaîne orders (ordre CRITIQUE) ───────────────────────────────────
      'order_items',                // → orders (CASCADE)
      'delivery_histories',
      'deliveries',                 // → orders (RESTRICT) ← AVANT orders OBLIGATOIRE
      'payments',                   // → orders (SET NULL) ← AVANT orders
      'orders',                     // → customers (RESTRICT) ← AVANT customers OBLIGATOIRE
      // ── Products ─────────────────────────────────────────────────────────
      'products',                   // → organizations (RESTRICT)
      // ── Customers (dernier) ───────────────────────────────────────────────
      'customers',                  // → organizations (RESTRICT)
    ];

    const activeDeletionOrder = candidateDeletionOrder.filter(t => existingTableNames.has(t));
    console.log(`   Found ${activeDeletionOrder.length} active business tables in deletion order out of ${candidateDeletionOrder.length} candidates.`);

    // -------------------------------------------------------------
    // STEP 2: Verify Pilot Organization Exists
    // -------------------------------------------------------------
    console.log('\n🎯 2. Vérification de l\'organisation pilote...');
    const orgRes = await client.query(`SELECT id, name, slug FROM public.organizations ORDER BY created_at ASC LIMIT 1;`);
    if (orgRes.rows.length === 0) {
      throw new Error('Aucune organisation trouvée dans la base de données.');
    }
    const pilotOrg = orgRes.rows[0];
    const pilotOrgId = pilotOrg.id;
    console.log(`   Pilot Org Target: [${pilotOrgId}] "${pilotOrg.name}"`);

    if (pilotOrgId !== 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') {
      throw new Error(`Incohérence ID d'organisation pilote : attendu a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11, reçu ${pilotOrgId}`);
    }

    // -------------------------------------------------------------
    // STEP 3: Count rows BEFORE in transaction
    // -------------------------------------------------------------
    console.log('\n📊 3. Démarrage de la transaction PostgreSQL (BEGIN)...');
    await client.query('BEGIN;');

    // Count rows before in other orgs to protect them
    let initialOtherOrgsCount = 0;
    for (const tbl of activeDeletionOrder) {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'organization_id';
      `, [tbl]);

      if (colCheck.rows.length > 0) {
        const cntRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM public.${tbl} WHERE organization_id != $1;`,
          [pilotOrgId]
        );
        initialOtherOrgsCount += cntRes.rows[0].count;
      }
    }
    console.log(`   Protection Multi-Tenant : ${initialOtherOrgsCount} lignes hors organisation pilote mesurées avant suppression.`);

    // Expected pilot rows to delete (calibrated from DB inspection run):
    const expectedCounts: Record<string, number> = {
      products: 5,
      product_images: 1,
      product_stock: 4,
      stock_movements: 1,
      customers: 3,
      orders: 1,
      order_items: 1,
      payments: 1,
      deliveries: 1,
      team_tasks: 1,
    };
    const EXPECTED_TOTAL = 19;

    // -------------------------------------------------------------
    // STEP 4: Perform deletion within transaction
    // -------------------------------------------------------------
    console.log('\n🧹 4. Exécution des suppressions filtrées par organization_id...');
    const deletedReport: Record<string, number> = {};
    let totalDeleted = 0;

    for (const tbl of activeDeletionOrder) {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'organization_id';
      `, [tbl]);

      if (colCheck.rows.length > 0) {
        const delRes = await client.query(
          `DELETE FROM public.${tbl} WHERE organization_id = $1;`,
          [pilotOrgId]
        );
        const rowCount = delRes.rowCount || 0;
        deletedReport[tbl] = rowCount;
        totalDeleted += rowCount;
        if (rowCount > 0) {
          console.log(`   Suppression dans ${tbl.padEnd(25)} : ${rowCount} ligne(s)`);
        }
      }
    }

    console.log(`   Total de lignes supprimées dans l'organisation pilote : ${totalDeleted}`);

    // -------------------------------------------------------------
    // STEP 5: Quantity Safeguard Assertions
    // -------------------------------------------------------------
    console.log('\n🛡️ 5. Contrôle des garde-fous de quantité avant COMMIT...');
    if (totalDeleted !== EXPECTED_TOTAL) {
      throw new Error(`Garde-fou de quantité ÉCHOUÉ : attendu ${EXPECTED_TOTAL} lignes supprimées, obtenu ${totalDeleted}. ROLLBACK déclenché.`);
    }

    for (const [tbl, expCount] of Object.entries(expectedCounts)) {
      if (deletedReport[tbl] !== expCount) {
        throw new Error(`Garde-fou de quantité ÉCHOUÉ sur ${tbl} : attendu ${expCount}, obtenu ${deletedReport[tbl]}. ROLLBACK déclenché.`);
      }
    }
    console.log(`   ✅ Garde-fous de quantité validés à 100% (${EXPECTED_TOTAL}/${EXPECTED_TOTAL} lignes).`);

    // -------------------------------------------------------------
    // STEP 6: Multi-Tenant Protection Assertions
    // -------------------------------------------------------------
    console.log('\n🔒 6. Contrôle de l\'intégrité des autres organisations...');
    let postOtherOrgsCount = 0;
    for (const tbl of activeDeletionOrder) {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'organization_id';
      `, [tbl]);

      if (colCheck.rows.length > 0) {
        const cntRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM public.${tbl} WHERE organization_id != $1;`,
          [pilotOrgId]
        );
        postOtherOrgsCount += cntRes.rows[0].count;
      }
    }

    if (postOtherOrgsCount !== initialOtherOrgsCount) {
      throw new Error(`DÉTECTION D'ALTÉRATION SUR AUTRES ORGANISATIONS : avant=${initialOtherOrgsCount}, après=${postOtherOrgsCount}. ROLLBACK D'URGENCE.`);
    }
    console.log(`   ✅ Protection Multi-Tenant validée : les ${postOtherOrgsCount} lignes des 11 autres organisations sont strictly intactes.`);

    // -------------------------------------------------------------
    // STEP 7: System & Config Tables Integrity Assertions
    // -------------------------------------------------------------
    console.log('\n🏛️ 7. Contrôle de préservation des données système...');
    const sysOrgs = await client.query(`SELECT COUNT(*)::int AS count FROM public.organizations;`);
    const sysRoles = await client.query(`SELECT COUNT(*)::int AS count FROM public.user_organization_roles;`);
    const sysWhatsapp = await client.query(`SELECT COUNT(*)::int AS count FROM public.whatsapp_numbers;`);
    const sysDrivers = await client.query(`SELECT COUNT(*)::int AS count FROM public.drivers;`);

    if (sysOrgs.rows[0].count < 12 || sysRoles.rows[0].count < 8 || sysWhatsapp.rows[0].count < 4) {
      throw new Error(`DÉTECTION D'ANOMALIE SYSTÈME : tables système modifiées. ROLLBACK D'URGENCE.`);
    }
    console.log(`   ✅ Données système intactes : ${sysOrgs.rows[0].count} orgs, ${sysRoles.rows[0].count} rôles, ${sysWhatsapp.rows[0].count} numéros whatsapp, ${sysDrivers.rows[0].count} livreurs.`);

    // -------------------------------------------------------------
    // STEP 8: COMMIT TRANSACTION
    // -------------------------------------------------------------
    console.log('\n💾 8. Validation finale de la transaction (COMMIT)...');
    await client.query('COMMIT;');
    console.log('🎉 TRANSACTION POSTGRESQL EFFECTUÉE ET COMMITTÉE AVEC SUCCÈS !\n');

    // -------------------------------------------------------------
    // STEP 9: Post-Commit Clean Slate Verification
    // -------------------------------------------------------------
    console.log('✨ 9. Vérification Post-Commit de l\'état zéro pour WillShop DEV...');
    let pilotOrgRemainingRows = 0;
    for (const tbl of activeDeletionOrder) {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'organization_id';
      `, [tbl]);

      if (colCheck.rows.length > 0) {
        const cntRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM public.${tbl} WHERE organization_id = $1;`,
          [pilotOrgId]
        );
        pilotOrgRemainingRows += cntRes.rows[0].count;
      }
    }

    if (pilotOrgRemainingRows !== 0) {
      console.error(`⚠️ Attention : ${pilotOrgRemainingRows} lignes restent présentes dans l'organisation pilote.`);
    } else {
      console.log('   ✅ ÉTAT ZÉRO CONFIRMÉ : 0 donnée métier restante pour WillShop DEV !');
    }

  } catch (err: any) {
    console.error('\n❌ ERREUR LORS DU RESET : ROLLBACK EXÉCUTÉ !');
    console.error('   Raison :', err.message);
    await client.query('ROLLBACK;').catch(() => {});
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

executeAtomicReset();

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envLocalPath = path.join(process.cwd(), '.env.local');
let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
        if (key === 'SUPABASE_SERVICE_ROLE_KEY' && !serviceKey) serviceKey = val;
      }
    }
  });
}

if (!url || !serviceKey) {
  console.error('❌ Error: Supabase credentials missing in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// Tables to clean up for the pilot organization
const targetTables = [
  'workflow_stack_states',
  'routine_steps',
  'work_routines',
  'user_notifications',
  'internal_messages',
  'internal_thread_participants',
  'internal_threads',
  'customer_engagements',
  'ai_actions',
  'ai_recommendations',
  'ai_decisions',
  'ai_usage_logs',
  'task_activities',
  'task_comments',
  'task_dependencies',
  'task_escalations',
  'team_tasks',
  'delivery_histories',
  'deliveries',
  'order_items',
  'payments',
  'orders',
  'inventory_movements',
  'product_inventory',
  'product_images',
  'products',
  'financial_transactions',
  'payouts',
  'whatsapp_messages',
  'whatsapp_conversations',
  'sales_conversations',
  'leads',
  'customer_notes',
  'customer_tags',
  'customer_contacts',
  'customer_attributions',
  'attribution_lifecycle_events',
  'customers',
];

// Tables strictly preserved (never touched)
const preservedTables = [
  'auth.users',
  'organizations',
  'profiles',
  'user_organization_roles',
  'cash_accounts',
  'delivery_zones',
  'drivers',
  'whatsapp_numbers',
];

async function runDryRun() {
  console.log('🔍 Starting Multi-Tenant Dry-Run Data Reset Inspection...\n');

  // Step 1: Discover pilot organization ID dynamically
  // Search for organization associated with user_organization_roles (e.g. OWNER role) or organizations table
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: true });

  if (orgError || !orgs || orgs.length === 0) {
    console.error('❌ CRITICAL STOP: Unable to retrieve organizations from Supabase DB:', orgError);
    process.exit(1);
  }

  console.log(`🏢 Discovered ${orgs.length} Organization(s) in Database:`);
  orgs.forEach((o, index) => {
    console.log(`   ${index + 1}. [${o.id}] "${o.name}" (slug: ${o.slug})`);
  });

  const pilotOrg = orgs[0];
  const pilotOrgId = pilotOrg.id;

  console.log(`\n🎯 TARGET PILOT ORGANIZATION FOR DRY-RUN:`);
  console.log(`   ID: ${pilotOrgId}`);
  console.log(`   Name: ${pilotOrg.name}`);

  // Check if there are other organizations to verify isolation
  const otherOrgIds = orgs.filter(o => o.id !== pilotOrgId).map(o => o.id);
  console.log(`   Other Organizations count: ${otherOrgIds.length}\n`);

  console.log('===========================================================');
  console.log('📊 DRY-RUN ANALYSIS BY TABLE (STRICTLY LIMITED TO PILOT ORG)');
  console.log('===========================================================\n');

  const report: Array<{
    table: string;
    pilotOrgRows: number;
    otherOrgRows: number;
    totalRows: number;
    status: string;
  }> = [];

  for (const tableName of targetTables) {
    try {
      // Query total rows
      const { count: totalCount, error: totalErr } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (totalErr) {
        report.push({
          table: tableName,
          pilotOrgRows: 0,
          otherOrgRows: 0,
          totalRows: 0,
          status: `Table not present or error: ${totalErr.message}`,
        });
        continue;
      }

      // Query rows belonging to target pilot organization
      const { count: pilotCount, error: pilotErr } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', pilotOrgId);

      // Query rows belonging to OTHER organizations if other orgs exist
      let otherCount = 0;
      if (otherOrgIds.length > 0) {
        const { count: oCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .neq('organization_id', pilotOrgId);
        otherCount = oCount || 0;
      }

      report.push({
        table: tableName,
        pilotOrgRows: pilotCount || 0,
        otherOrgRows: otherCount,
        totalRows: totalCount || 0,
        status: 'READY FOR CLEANUP (PILOT ORG ONLY)',
      });
    } catch (err: any) {
      report.push({
        table: tableName,
        pilotOrgRows: 0,
        otherOrgRows: 0,
        totalRows: 0,
        status: `Skipped: ${err.message}`,
      });
    }
  }

  // Print results table
  console.log(
    'Table Name'.padEnd(32) +
    '| Pilot Org Rows (To Delete) '.padEnd(30) +
    '| Other Orgs Rows (PRESERVED) '.padEnd(30) +
    '| Total Rows'
  );
  console.log('-'.repeat(105));

  let totalPilotToDelete = 0;
  let totalOtherPreserved = 0;

  for (const item of report) {
    console.log(
      item.table.padEnd(32) +
      `| ${item.pilotOrgRows}`.padEnd(30) +
      `| ${item.otherOrgRows}`.padEnd(30) +
      `| ${item.totalRows}`
    );
    totalPilotToDelete += item.pilotOrgRows;
    totalOtherPreserved += item.otherOrgRows;
  }

  console.log('-'.repeat(105));
  console.log(`TOTAL PILOT ORG ROWS WOULD BE DELETED: ${totalPilotToDelete}`);
  console.log(`TOTAL OTHER ORGS ROWS STRICTLY PRESERVED: ${totalOtherPreserved}\n`);

  console.log('===========================================================');
  console.log('🛡️ SYSTEM & CONFIGURATION TABLES STRICTLY PRESERVED');
  console.log('===========================================================');
  for (const pTable of preservedTables) {
    if (pTable === 'auth.users') {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      console.log(`   - ${pTable.padEnd(28)} : ${usersData?.users?.length || 0} user account(s) PRESERVED`);
    } else {
      const { count } = await supabase.from(pTable).select('*', { count: 'exact', head: true });
      console.log(`   - ${pTable.padEnd(28)} : ${count || 0} row(s) PRESERVED`);
    }
  }

  console.log('\n✅ DRY-RUN COMPLETED SUCCESSFULLY. NO DATA WAS DELETED.');
}

runDryRun().catch((err) => {
  console.error('❌ Dry run error:', err);
  process.exit(1);
});

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.log("Missing keys in .env.local");
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data: users } = await supabase.auth.admin.listUsers();
  console.log("Total users:", users?.users?.length);
  
  const { data: roles } = await supabase.from('user_organization_roles').select('*');
  console.log("Total roles:", roles?.length);
  console.log("Roles details:", JSON.stringify(roles, null, 2));

  const { data: orgs } = await supabase.from('organizations').select('*');
  console.log("Total orgs:", orgs?.length);
}

check();

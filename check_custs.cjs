const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data: custs, error } = await supabase.from('customers').select('*');
  console.log("Customers count:", custs ? custs.length : 0);
  console.log("Error:", error);
  if (custs && custs.length > 0) {
    console.log("Latest customers:", custs.slice(-2));
  }
}
check();

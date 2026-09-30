const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function fix() {
  const { data, error } = await supabase
    .from('user_organization_roles')
    .update({ deleted_at: null })
    .not('deleted_at', 'is', null);
  
  console.log("Restored deleted roles:", data, error);
}
fix();

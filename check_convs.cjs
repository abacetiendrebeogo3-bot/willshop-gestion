const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data: convs, error } = await supabase.from('conversations').select('*');
  console.log("Conversations count:", convs ? convs.length : 0);
  console.log("Error:", error);
  if (convs && convs.length > 0) {
    console.log("First conv org id:", convs[0].organization_id);
    console.log("First conv status:", convs[0].status);
  }
}
check();

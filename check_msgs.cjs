const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data: msgs, error } = await supabase.from('messages').select('*').limit(5).order('created_at', { ascending: false });
  console.log("Messages count:", msgs ? msgs.length : 0);
  console.log("Error:", error);
  if (msgs && msgs.length > 0) {
    console.log("Latest messages:", msgs);
  }
}
check();

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function getEnumValues() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'conversation_mode_enum' });
  if (error) {
    // try querying postgres directly if rpc doesn't exist
    const { data: dbData } = await supabase.from('conversations').select('conversation_mode').limit(1);
    console.log("Existing modes:", dbData);
  }
}
getEnumValues();

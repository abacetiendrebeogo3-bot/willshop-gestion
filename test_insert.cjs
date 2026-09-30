const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data: convs, error } = await supabase.from('conversations').insert({
    organization_id: '27f3fcc3-402b-4294-ae19-ee4e59ed4037', // from customer output
    customer_id: '17d0835c-3db9-4f50-a982-0e93650dac6a',
    whatsapp_number_id: '719dc788-b7c1-4c11-9a74-b5de3dc9d311', // I don't know the whatsapp_number_id, I'll pass null or fetch it
    channel: 'WHATSAPP',
    status: 'OPEN',
    conversation_mode: 'FOLLOWUP_ONLY',
    assigned_agent: 'SALES_AI',
    last_message_at: new Date().toISOString(),
    unread_count: 1,
    metadata: {}
  }).select();
  
  console.log("Error inserting conv:", error);
}

async function findNumberAndCheck() {
    const { data: nums } = await supabase.from('whatsapp_numbers').select('id').limit(1);
    const numId = nums ? nums[0].id : null;
    console.log("Num id:", numId);
    
    const { data: convs, error } = await supabase.from('conversations').insert({
        organization_id: '27f3fcc3-402b-4294-ae19-ee4e59ed4037',
        customer_id: '17d0835c-3db9-4f50-a982-0e93650dac6a',
        whatsapp_number_id: numId,
        channel: 'WHATSAPP',
        status: 'OPEN',
        conversation_mode: 'FOLLOWUP_ONLY',
        assigned_agent: 'SALES_AI',
        last_message_at: new Date().toISOString(),
        unread_count: 1,
        metadata: {}
    }).select();
    console.log("Error with real num:", error);
}

findNumberAndCheck();


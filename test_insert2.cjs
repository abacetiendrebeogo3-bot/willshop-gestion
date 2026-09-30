const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

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
        conversation_mode: 'AI_ACTIVE',
        assigned_agent: 'SALES_AI',
        last_message_at: new Date().toISOString(),
        unread_count: 1,
        metadata: {}
    }).select();
    console.log("Insert with AI_ACTIVE error:", error);
    if (!error) {
       console.log("Success! ID:", convs[0].id);
       // Now cleanup
       await supabase.from('conversations').delete().eq('id', convs[0].id);
    }
}

findNumberAndCheck();


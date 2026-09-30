const { Client } = require('pg');

async function run() {
  const connectionString = "postgresql://postgres.stbzctncpvgqdpybcrmg:M62402271a@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString });
  
  await client.connect();
  console.log("Connected.");
  
  try {
    await client.query("ALTER TYPE conversation_mode_enum ADD VALUE IF NOT EXISTS 'FOLLOWUP_ONLY';");
    console.log("Added FOLLOWUP_ONLY");
  } catch (e) { console.log(e.message); }
  
  try {
    await client.query("ALTER TYPE conversation_mode_enum ADD VALUE IF NOT EXISTS 'HUMAN_PRIMARY';");
    console.log("Added HUMAN_PRIMARY");
  } catch (e) { console.log(e.message); }

  await client.end();
}
run();

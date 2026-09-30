import { test } from 'node:test';
import assert from 'node:assert';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:yye3eU6dWz%24%2F%3FZw@db.stbzctncpvgqdpybcrmg.supabase.co:5432/postgres';

test('Concurrency: reserve_stock atomic lock with 2 simultaneous requests on stock=1', async () => {
  const client1 = new Client({ connectionString });
  const client2 = new Client({ connectionString });
  
  try {
    await client1.connect();
    await client2.connect();

    // 1. Setup
    const orgRes = await client1.query(`SELECT id FROM organizations LIMIT 1`);
    if (orgRes.rows.length === 0) {
      // Skip if no org found (local without seed)
      return;
    }
    const orgId = orgRes.rows[0].id;

    const sku = 'TEST-CONC-' + Date.now();
    const prodRes = await client1.query(`
      INSERT INTO products (organization_id, name, selling_price, status, sku) 
      VALUES ($1, 'Concurrency Test Product', 1000, 'ACTIVE', $2) RETURNING id
    `, [orgId, sku]);
    const productId = prodRes.rows[0].id;

    await client1.query(`
      INSERT INTO product_stock (organization_id, product_id, physical_stock, reserved_stock)
      VALUES ($1, $2, 1, 0)
    `, [orgId, productId]);

    // 2. Launch concurrent reservations
    const promise1 = client1.query('SELECT reserve_stock($1, $2) as success', [productId, 1]);
    const promise2 = client2.query('SELECT reserve_stock($1, $2) as success', [productId, 1]);

    const results = await Promise.allSettled([promise1, promise2]);
    
    const r1 = results[0].status === 'fulfilled' ? results[0].value.rows[0].success : false;
    const r2 = results[1].status === 'fulfilled' ? results[1].value.rows[0].success : false;

    // 3. Assertions
    // Either r1 succeeds and r2 fails, or r1 fails and r2 succeeds
    assert.ok(
      (r1 === true && r2 === false) || (r1 === false && r2 === true),
      'Only exactly one reservation must succeed for stock=1'
    );

    // Verify stock is now 0 available (physical 1, reserved 1)
    const stockRes = await client1.query(`
      SELECT physical_stock, reserved_stock, available_stock 
      FROM product_stock WHERE product_id = $1
    `, [productId]);
    
    assert.strictEqual(Number(stockRes.rows[0].reserved_stock), 1);

    // 4. Cleanup
    await client1.query(`DELETE FROM product_stock WHERE product_id = $1`, [productId]);
    await client1.query(`DELETE FROM products WHERE id = $1`, [productId]);

  } finally {
    await client1.end();
    await client2.end();
  }
});

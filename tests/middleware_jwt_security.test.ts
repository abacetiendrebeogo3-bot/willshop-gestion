import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stbzctncpvgqdpybcrmg.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake_service_key';

describe('Middleware Security JWT Tests', () => {
  it('should reject forged JWT with invalid signature and redirect to login', async () => {
    // Construct a valid header
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    // Construct a payload for a fake session in the future
    const payload = Buffer.from(JSON.stringify({
      role: 'authenticated',
      sub: 'fake-uuid-0000-0000-0000',
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64url');
    // Fake signature (forged)
    const signature = 'fake_invalid_signature_1234567890';
    
    const forgedToken = `${header}.${payload}.${signature}`;

    // Mock NextRequest targeting a protected route
    const req = new NextRequest('http://localhost:3000/sales/my-day');
    
    // Set the forged token in cookies as if the user tampered with it
    req.cookies.set('sb-stbzctncpvgqdpybcrmg-auth-token.0', forgedToken);
    
    // Execute middleware
    const res = await middleware(req);

    // The middleware should fail to verify the signature via Supabase SSR,
    // resulting in user = null, and then redirect to /login
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location')?.includes('/login'), 'Should redirect to login');
  });
});

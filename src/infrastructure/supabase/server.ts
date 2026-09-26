/**
 * WILLShop OS — Supabase Server Client Helper (Server Actions & Route Handlers)
 * Infrastructure Layer.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRequiredEnv } from '@/src/config/env';

export async function createServerSupabaseClient() {
  const cookieStore = cookies();
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        } catch {
          // Server Component read-only fallback
        }
      },
    },
  });
}

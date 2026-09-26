/**
 * Centralized environment variable accessor.
 * Handles Next.js client-side Webpack inlining for NEXT_PUBLIC_ variables
 * while ensuring required environment variables are present.
 */

export function getRequiredEnv(name: string): string {
  let value: string | undefined;

  // Next.js Webpack bundler requires static literal references for NEXT_PUBLIC_ variables on the client side
  if (name === 'NEXT_PUBLIC_SUPABASE_URL') {
    value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else if (name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else if (name === 'NEXT_PUBLIC_APP_URL') {
    value = process.env.NEXT_PUBLIC_APP_URL;
  } else {
    value = process.env[name];
  }

  if (!value || value.trim().length === 0) {
    console.error(`[Config Error] Required environment variable "${name}" is missing or empty.`);
    throw new Error(`[Config Error] Missing required environment variable: ${name}`);
  }

  return value.trim();
}

export function getOptionalEnv(name: string, fallback = ''): string {
  let value: string | undefined;

  if (name === 'NEXT_PUBLIC_SUPABASE_URL') {
    value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else if (name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else if (name === 'NEXT_PUBLIC_APP_URL') {
    value = process.env.NEXT_PUBLIC_APP_URL;
  } else {
    value = process.env[name];
  }

  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value.trim();
}

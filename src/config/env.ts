/**
 * Centralized environment variable accessor.
 * Throws explicit errors when required environment variables are missing,
 * preventing silent fallback failures or hardcoded credential leaks.
 */

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    console.error(`[Config Error] Required environment variable "${name}" is missing or empty.`);
    throw new Error(`[Config Error] Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function getOptionalEnv(name: string, fallback = ''): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

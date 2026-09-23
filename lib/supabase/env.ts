function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Next.js only inlines NEXT_PUBLIC_* vars into the client bundle when they
// are referenced as static `process.env.NEXT_PUBLIC_X` property accesses —
// a dynamic `process.env[name]` lookup is invisible to its build-time
// replacement and silently resolves to undefined in the browser.
export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL
);
export const SUPABASE_PUBLISHABLE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

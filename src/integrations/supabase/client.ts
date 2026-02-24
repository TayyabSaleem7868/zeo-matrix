import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// `import.meta.hot` is provided by Vite only in dev (HMR).
// Our repo's custom `vite-env.d.ts` doesn't include Vite's MODE/DEV/PROD typings.
if ((import.meta as unknown as { hot?: unknown }).hot) {
  // Helps debug config issues without breaking the app.
  console.log("[supabase] url:", SUPABASE_URL);
}

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "Supabase URL or Publishable Key is missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_PUBLISHABLE_KEY || "placeholder",
  {
    auth: {
      storage:
        typeof window !== "undefined" && typeof window.localStorage !== "undefined"
          ? window.localStorage
          : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
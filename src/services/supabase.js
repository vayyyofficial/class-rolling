import { createClient } from '@supabase/supabase-js';

// Production fallback values ensure the website functions on Netlify
// even if environment variables were not manually set in the Netlify dashboard.
const DEFAULT_SUPABASE_URL = 'https://mhsxrfuyizcmdcfhmruu.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_VsdBt4QmNKtPteLAhjXTlQ_YT7hov_z';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('http')
);

/**
 * Safely create the Supabase client without throwing uncaught exceptions
 * at module evaluation time.
 */
function createSafeSupabaseClient() {
  if (isSupabaseConfigured) {
    try {
      return createClient(supabaseUrl, supabaseKey, {
        auth: {
          // Disable Supabase email/password auth session persistence.
          // This app uses a custom frontend password-only session.
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } catch (err) {
      console.warn('[supabase] Initialization failed, using safe fallback client:', err);
    }
  }

  // Safe fallback mock client if Supabase is unavailable, preventing white blank screens
  const mockQuery = () => ({
    select: () => mockQuery(),
    insert: () => mockQuery(),
    update: () => mockQuery(),
    delete: () => mockQuery(),
    eq: () => mockQuery(),
    order: () => mockQuery(),
    limit: () => mockQuery(),
    single: async () => ({ data: null, error: new Error('Supabase client not initialized') }),
    then: (resolve) => resolve({ data: null, error: new Error('Supabase client not initialized') }),
  });

  return {
    from: () => mockQuery(),
    rpc: async () => ({ data: null, error: new Error('Supabase client not initialized') }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
  };
}

export const supabase = createSafeSupabaseClient();

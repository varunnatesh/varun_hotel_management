import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️  Missing Supabase environment variables.\n' +
    'Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'See .env.example for reference.\n' +
    'The app will run in demo/preview mode without a database.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken:    true,
    persistSession:      true,
    detectSessionInUrl:  true,
    storageKey:          'varun-hotel-auth',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  global: {
    headers: { 'x-app-name': 'varun-hotel-management' },
  },
});

// ─── Realtime Channel Helpers ─────────────────────────────────────────────────

/** Subscribe to live order updates */
export function subscribeToOrders(
  branchId: string,
  callback: (payload: Record<string, unknown>) => void,
) {
  return supabase
    .channel(`orders:${branchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` },
      callback,
    )
    .subscribe();
}

/** Subscribe to alerts */
export function subscribeToAlerts(
  branchId: string,
  callback: (payload: Record<string, unknown>) => void,
) {
  return supabase
    .channel(`alerts:${branchId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'alerts', filter: `branch_id=eq.${branchId}` },
      callback,
    )
    .subscribe();
}

/** Subscribe to material stock changes */
export function subscribeToMaterials(
  branchId: string,
  callback: (payload: Record<string, unknown>) => void,
) {
  return supabase
    .channel(`materials:${branchId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'materials', filter: `branch_id=eq.${branchId}` },
      callback,
    )
    .subscribe();
}

/** Subscribe to approval requests */
export function subscribeToApprovals(
  branchId: string,
  callback: (payload: Record<string, unknown>) => void,
) {
  return supabase
    .channel(`approvals:${branchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'approval_requests', filter: `branch_id=eq.${branchId}` },
      callback,
    )
    .subscribe();
}

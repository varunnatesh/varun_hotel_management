import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface LiveOrder {
  id:          string;
  table_no:    string | null;
  room_no:     string | null;
  status:      string;
  total_amount: number;
  created_at:  string;
  order_source: string;
  order_items: {
    id:         string;
    quantity:   number;
    unit_price: number;
    menu_items: { name: string } | null;
  }[];
}

export function useLiveOrders(limit = 50) {
  const [orders, setOrders]   = useState<LiveOrder[]>([]);
  const [isLoading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, table_no, room_no, status, total_amount, created_at, order_source,
        order_items (
          id, quantity, unit_price,
          menu_items ( name )
        )
      `)
      .not('status', 'in', '(served,paid,cancelled,billed)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) console.error('useLiveOrders error:', error.message);
    if (!error && data) setOrders(data as unknown as LiveOrder[]);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchOrders();

    // Realtime subscription
    channelRef.current = supabase
      .channel('live-orders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
      }, () => {
        fetchOrders(); // Re-fetch on any change
      })
      .subscribe();

    // 3-second polling fallback (in case websocket drops)
    pollRef.current = setInterval(fetchOrders, 3000);

    return () => {
      channelRef.current?.unsubscribe();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchOrders]);

  return { orders, isLoading, refetch: fetchOrders };
}

// ─── All Orders (paginated) ───────────────────────────────────────────────────
export function useOrders(statusFilter?: string[]) {
  const [orders, setOrders]     = useState<LiveOrder[]>([]);
  const [isLoading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    let query = supabase
      .from('orders')
      .select(`
        id, table_no, room_no, status, total_amount, created_at, order_source,
        order_items (
          id, quantity, unit_price,
          menu_items ( name )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (statusFilter?.length) {
      query = query.in('status', statusFilter);
    }

    const { data, error } = await query;
    if (!error && data) setOrders(data as unknown as LiveOrder[]);
    setLoading(false);
  }, [statusFilter?.join(',')]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    // updated_at is auto-handled by DB trigger, no need to set manually
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    if (!error) fetchOrders();
    return { error };
  };

  return { orders, isLoading, refetch: fetchOrders, updateStatus };
}

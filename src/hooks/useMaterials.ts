import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Material {
  id:              string;
  name:            string;
  unit:            string;
  current_stock:   number;
  min_stock_level: number;
  avg_daily_usage: number;
  cost_per_unit:   number;
  days_remaining?: number;
  stock_status?:   'critical' | 'low' | 'ok';
}

function calcDaysRemaining(stock: number, dailyUsage: number): number {
  if (dailyUsage <= 0) return 999;
  return Math.floor(stock / dailyUsage);
}

function getStockStatus(days: number, stock: number, min: number): Material['stock_status'] {
  if (stock <= 0 || days <= 1)     return 'critical';
  if (stock <= min || days <= 3)   return 'low';
  return 'ok';
}

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setLoading]   = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('materials')
      .select('*')
      .order('name');

    if (err) { setError(err.message); setLoading(false); return; }

    const enriched = (data ?? []).map((m: any) => {
      const days = calcDaysRemaining(Number(m.current_stock), Number(m.avg_daily_usage));
      return {
        ...m,
        current_stock:   Number(m.current_stock),
        min_stock_level: Number(m.min_stock_level),
        avg_daily_usage: Number(m.avg_daily_usage),
        cost_per_unit:   Number(m.cost_per_unit),
        days_remaining:  days,
        stock_status:    getStockStatus(days, Number(m.current_stock), Number(m.min_stock_level)),
      };
    });

    setMaterials(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const issueMaterial = async (
    materialId: string, quantity: number,
    issuedBy: string, receivedBy: string, notes?: string
  ) => {
    // Insert issue log
    const { error: issueErr } = await supabase.from('material_issues').insert({
      material_id: materialId, quantity,
      issued_by: issuedBy, notes: notes ?? '',
      date: new Date().toISOString().split('T')[0],
    });
    if (issueErr) return { error: issueErr.message };

    // Deduct stock
    const material = materials.find(m => m.id === materialId);
    if (material) {
      await supabase.from('materials').update({
        current_stock: material.current_stock - quantity,
        updated_at: new Date().toISOString(),
      }).eq('id', materialId);
    }

    await fetchMaterials();
    return { error: null };
  };

  const addPurchase = async (payload: {
    materialId: string; quantity: number; costPerUnit: number;
    supplierName: string; billNumber: string; purchasedBy: string;
  }) => {
    const { error: purchErr } = await supabase.from('material_purchases').insert({
      material_id: payload.materialId,
      quantity: payload.quantity,
      cost_per_unit: payload.costPerUnit,
      supplier_name: payload.supplierName,
      bill_number: payload.billNumber,
      purchased_by: payload.purchasedBy,
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
    });
    if (purchErr) return { error: purchErr.message };

    // Add to stock
    const material = materials.find(m => m.id === payload.materialId);
    if (material) {
      await supabase.from('materials').update({
        current_stock: material.current_stock + payload.quantity,
        updated_at: new Date().toISOString(),
      }).eq('id', payload.materialId);
    }

    await fetchMaterials();
    return { error: null };
  };

  const lowStock   = materials.filter(m => m.stock_status !== 'ok');
  const critical   = materials.filter(m => m.stock_status === 'critical');

  return { materials, lowStock, critical, isLoading, error, refetch: fetchMaterials, issueMaterial, addPurchase };
}

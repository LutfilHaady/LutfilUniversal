'use client';

import useSWR, { mutate } from 'swr';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { scanAlerts } from '@/lib/alerts/scan';
import type { AlertView, AlertSeverity } from '@/lib/alerts/types';

const VALID: AlertSeverity[] = ['critical', 'warning', 'info'];
function normSeverity(s: string): AlertSeverity {
  return (VALID as string[]).includes(s) ? (s as AlertSeverity) : 'info';
}

async function fetchAlerts(): Promise<AlertView[]> {
  // Best-effort generation; never block the read on scan errors.
  try {
    await scanAlerts();
  } catch (e) {
    console.error('[useAlerts] scan failed', e);
  }
  const { data, error } = await supabase
    .from('alerts')
    .select('id, severity, message, batch_id, created_at')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((a: any) => ({
    id: a.id,
    severity: normSeverity(a.severity),
    message: a.message,
    batchId: a.batch_id,
    createdAt: a.created_at,
  }));
}

export function useAlerts() {
  const { loading: authLoading, user } = useAuth();
  const { data, isLoading, error } = useSWR(authLoading ? null : 'alerts', fetchAlerts);

  async function dismiss(id: string) {
    await supabase.from('alerts').update({
      resolved_at:       new Date().toISOString(),
      resolved_by:       user?.id ?? null,
      resolution_source: 'manual',
    }).eq('id', id);
    await mutate('alerts');
  }

  return {
    alerts: data ?? [],
    loading: authLoading || isLoading,
    error: (error as Error | null)?.message ?? null,
    dismiss,
  };
}

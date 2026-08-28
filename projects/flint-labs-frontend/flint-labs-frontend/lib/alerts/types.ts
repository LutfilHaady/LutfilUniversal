export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertRule {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  severity: AlertSeverity;
  threshold: number | null;
}

// A live alert row as shown in the UI.
export interface AlertView {
  id: string;
  severity: AlertSeverity;
  message: string;
  batchId: string | null;
  createdAt: string; // ISO
}

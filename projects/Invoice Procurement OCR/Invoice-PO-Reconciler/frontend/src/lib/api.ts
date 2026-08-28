import type { ReconciliationResult, PresetOption } from "./types";

const API_BASE_URL = "http://localhost:8000";

export async function reconcileUpload(
  invoice: File,
  po: File
): Promise<ReconciliationResult> {
  const formData = new FormData();
  formData.append("invoice", invoice);
  formData.append("po", po);

  const response = await fetch(`${API_BASE_URL}/api/reconcile`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Reconciliation failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function reconcilePreset(
  presetId: string
): Promise<ReconciliationResult> {
  const response = await fetch(`${API_BASE_URL}/api/reconcile/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset_id: presetId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Preset reconciliation failed: ${response.status} - ${errorText}`
    );
  }

  return response.json();
}

export async function getPresets(): Promise<PresetOption[]> {
  const response = await fetch(`${API_BASE_URL}/api/presets`);

  if (!response.ok) {
    throw new Error(`Failed to fetch presets: ${response.status}`);
  }

  return response.json();
}

export async function healthCheck(): Promise<{
  status: string;
  ocr_engines: string[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

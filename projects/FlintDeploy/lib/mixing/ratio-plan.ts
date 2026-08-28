export interface RatioRow {
  material: string;
  amountKg: number;
}

export interface PlanRow {
  material: string;
  targetKg: number;
}

// Recipe ratios come in two shapes:
//  - standard Mixing recipes:  params.mixing_steps[]   with { material, amount_kg }
//  - simplified recipes:       params.simplified_ratios[] with { material, amount, unit }
// Both normalise to { material, amountKg } where amountKg is treated purely as a
// ratio weight (the unit on simplified rows is informational — back-solving uses
// the ratio only). mixing_steps wins when both are present (they are mutually
// exclusive in practice; this just makes the result deterministic).
export function toRatioRows(params: Record<string, unknown> | null | undefined): RatioRow[] {
  const steps = Array.isArray(params?.mixing_steps) ? (params!.mixing_steps as Record<string, unknown>[]) : [];
  const fromSteps = steps
    .map(s => ({ material: String(s.material ?? ''), amountKg: Number(s.amount_kg ?? 0) }))
    .filter(r => r.material !== '' && r.amountKg > 0);
  if (fromSteps.length > 0) return fromSteps;

  const simplified = Array.isArray(params?.simplified_ratios) ? (params!.simplified_ratios as Record<string, unknown>[]) : [];
  return simplified
    .map(s => ({ material: String(s.material ?? ''), amountKg: Number(s.amount ?? 0) }))
    .filter(r => r.material !== '' && r.amountKg > 0);
}

// Back-solve every material's target quantity from the actual amount of the
// anchor (first) material: targetKg_i = anchorAmount * ratio_i / ratio_anchor.
export function computePlan(rows: RatioRow[], anchorMaterial: string, anchorAmount: number): PlanRow[] {
  if (!(anchorAmount > 0)) return [];
  const anchor = rows.find(r => r.material === anchorMaterial);
  if (!anchor || !(anchor.amountKg > 0)) return [];
  return rows.map(r => ({
    material: r.material,
    targetKg: Math.round((anchorAmount * r.amountKg / anchor.amountKg) * 100) / 100,
  }));
}

export function buildMixingStepDisplayRef(
  batchId: string,
  label: string,
  stepNumber: number,
): string {
  return `${batchId} / ${label} · Step ${String(stepNumber).padStart(2, '0')}`;
}

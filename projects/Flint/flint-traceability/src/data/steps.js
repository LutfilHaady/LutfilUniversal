/** Fixed linear production order — single source of truth (indices 0..6) */
export const STEPS = [
  'Mixer',
  'Coating & Oven Drying',
  'Calendaring',
  'Slitting',
  'Cutting',
  'Die Cutting',
  'Assembly',
]

export function getStepName(index) {
  if (index < 0 || index >= STEPS.length) return '—'
  return STEPS[index]
}

export function getNextStepName(index) {
  if (index < 0 || index >= STEPS.length - 1) return null
  return STEPS[index + 1]
}

export const STEP_COUNT = STEPS.length

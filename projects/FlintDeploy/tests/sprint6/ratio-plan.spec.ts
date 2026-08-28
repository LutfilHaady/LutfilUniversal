import { test, expect } from '@playwright/test'
import { computePlan, toRatioRows } from '../../lib/mixing/ratio-plan'

test('computePlan back-solves quantities from the first material amount', () => {
  const rows = [
    { material: 'MTC1', amountKg: 2 },
    { material: 'MTDW', amountKg: 8 },
  ]
  const plan = computePlan(rows, 'MTC1', 5) // anchor 5kg of MTC1 (ratio 2)
  expect(plan).toEqual([
    { material: 'MTC1', targetKg: 5 },
    { material: 'MTDW', targetKg: 20 }, // 5 * 8/2
  ])
})

test('computePlan returns [] when anchor material is absent', () => {
  expect(computePlan([{ material: 'MTC1', amountKg: 2 }], 'MTXX', 5)).toEqual([])
})

test('computePlan returns [] for non-positive anchor amount', () => {
  expect(computePlan([{ material: 'MTC1', amountKg: 2 }], 'MTC1', 0)).toEqual([])
})

test('toRatioRows parses recipe params.mixing_steps', () => {
  const rows = toRatioRows({ mixing_steps: [
    { material: 'MTC1', amount_kg: 2 },
    { material: '', amount_kg: 3 },      // dropped (no material)
    { material: 'MTDW', amount_kg: 0 },  // dropped (zero)
  ] })
  expect(rows).toEqual([{ material: 'MTC1', amountKg: 2 }])
})

test('toRatioRows parses the teammate simplified_ratios shape', () => {
  // Simplified recipes store { simplified_ratios: [{ material, amount, unit }] }
  const rows = toRatioRows({ simplified_ratios: [
    { material: 'Water', amount: 8, unit: 'kg' },
    { material: 'Cathode C1', amount: 2, unit: 'kg' },
    { material: '', amount: 1, unit: 'kg' },        // dropped (no material)
    { material: 'Binder', amount: 0, unit: 'parts' }, // dropped (zero)
  ] })
  expect(rows).toEqual([
    { material: 'Water', amountKg: 8 },
    { material: 'Cathode C1', amountKg: 2 },
  ])
})

test('toRatioRows prefers mixing_steps when both shapes are present', () => {
  const rows = toRatioRows({
    mixing_steps: [{ material: 'MTC1', amount_kg: 2 }],
    simplified_ratios: [{ material: 'Water', amount: 9, unit: 'kg' }],
  })
  expect(rows).toEqual([{ material: 'MTC1', amountKg: 2 }])
})

test('computePlan works end-to-end with a simplified recipe', () => {
  const rows = toRatioRows({ simplified_ratios: [
    { material: 'Water', amount: 8, unit: 'kg' },
    { material: 'Cathode C1', amount: 2, unit: 'kg' },
  ] })
  // operator pours 2kg of Cathode C1 (ratio 2) → Water = 2 * 8/2 = 8
  expect(computePlan(rows, 'Cathode C1', 2)).toEqual([
    { material: 'Water', targetKg: 8 },
    { material: 'Cathode C1', targetKg: 2 },
  ])
})

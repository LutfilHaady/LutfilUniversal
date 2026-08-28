// ── Domain-split barrel ──────────────────────────────────────────────
// All existing `import ... from '@/lib/data'` imports continue to resolve here.
//
// When wiring a page to Supabase, import from the specific domain file
// instead of this barrel — that keeps your PR scoped to one file and
// avoids merge conflicts with teammates working in parallel:
//
//   import { SubBatch, CATEGORIES } from '@/lib/data/batches'
//   import { MixingStep }           from '@/lib/data/mixing'
//   import { Recipe }               from '@/lib/data/recipes'
//   import { Lot }                  from '@/lib/data/lots'
//   import { BatchStatus }          from '@/lib/data/status'
//   import { YIELD_TREND }          from '@/lib/data/dashboard'

export * from './data/status';
export * from './data/batches';
export * from './data/mixing';
export * from './data/recipes';
export * from './data/lots';
export * from './data/dashboard';

// The threshold table as typed data (REN-01). Generated or edited only by the spike (scripts/spike, plan 03-10);
// tests validate schema and invariants, never timings.
import type { TierTable } from './tiers'
import tierTableJson from './tier-table.json'

export const TIER_TABLE: TierTable = tierTableJson as unknown as TierTable

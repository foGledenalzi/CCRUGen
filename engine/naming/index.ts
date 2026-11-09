// Naming barrel (plan 07-05): every public name of engine/naming, re-exported through engine/index.ts. Values and types are listed
// separately (`export { ... }` vs `export type { ... }`) so a type-only importer never pulls the naming runtime into its bundle.

export { PRNG_ALGO, cyrb128, sfc32 } from './prng'

export { FEISTEL_ROUNDS, FEISTEL_KEY_DISCARD, feistelRoundKeys, feistelPermutation } from './feistel'

export { STYLE_IDS, DEFAULT_STYLE, isStyleId, SYLLABLE_BANKS } from './banks'
export type { StyleId, SyllableBank } from './banks'

export { GENERATOR_ID, DEFAULT_SEED, GENERATOR_MAX_DEPTH, createGenerator, generateSounds } from './generate'
export type { SoundGenerator } from './generate'

export {
  SOUND_MAX_LENGTH,
  NAME_MAX_LENGTH,
  SEED_MAX_LENGTH,
  toNfc,
  splitGraphemes,
  graphemeCount,
  validateSound,
  validateName,
  normalizeSeed,
  upperFirst,
} from './text'
export type { TextProblem, TextCheck } from './text'

export { EUPHONY_VERSION, smoothName, smoothingInert } from './euphony'

export { JOIN_ORDERS, isJoinOrder } from './types'
export type {
  JoinOrder,
  NamingSource,
  Smoothing,
  NamingMeta,
  Naming,
  NamingPreset,
  NameState,
  NameResolver,
  CreateNamingOptions,
} from './types'

export { deriveName, createNaming, createNameResolver } from './derive'

// Plan 07-08: the versioned file format and its one validator (export, import and the per-base storage slot).
export {
  SCHEMA_ID,
  SCHEMA_PREFIX,
  NAMING_IMPORT_MAX_BYTES,
  NAMING_MAX_OVERRIDES,
  META_MAX_LENGTH,
  ISSUES_MAX,
  UNKNOWN_KEYS_MAX,
  serializeNaming,
} from './schema'
export type { SeedRecord } from './schema'

export { validateNamingJson } from './validate'
export type { NamingIssue, NamingImport, ValidateNamingOptions } from './validate'

// Plan 07-10: name collisions (the certificate for generated tables, the resumable scan for the rest).
export {
  COLLISION_GROUPS_MAX,
  COLLISION_GROUP_MESHES_MAX,
  COLLISION_SCAN_MAX_N,
  provablyUnique,
  canCertify,
  createCollisionJob,
  findCollisions,
} from './collisions'
export type { CollisionGroup, CollisionReport, CollisionJob } from './collisions'

export {
  editSound,
  pasteSounds,
  toggleLock,
  setSeed,
  setStyle,
  setJoin,
  setSmoothing,
  setSource,
  setOverride,
  resetOverride,
} from './edit'

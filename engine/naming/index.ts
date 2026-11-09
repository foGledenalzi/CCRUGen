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

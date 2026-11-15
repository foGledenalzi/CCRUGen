// The Names panel (Phase 7, plan 17; D-01, D-02, D-04, D-06, D-09, D-11, D-13, D-14, NAM-01, NAM-04, 07-UI-SPEC "Names Panel
// Contract"): the global controls above the zone list, in the UI-SPEC order, in the four states the base alone decides (ready,
// pending, seed-only, preview). The panel body mounts only while the panel is open, so the prerendered page stays small (research
// Pitfall 13), but the persistent sr-only live carrier is always mounted, so the first announcement is reliable even while the panel
// is collapsed. Every visible sentence comes from the copy module (app/lib/namingCopy.ts) and every limit from data. The zone list
// (block 12) and the collision report (block 9) are mounted here by plans 07-19 and 07-20; the panel is mounted in the viewer by
// plan 07-21. Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  JOIN_ORDERS,
  NAMING_IMPORT_MAX_BYTES,
  SEED_MAX_LENGTH,
  STYLE_IDS,
  netSpanOf,
  normalizeSeed,
  serializeNaming,
  smoothingInert,
  validateNamingJson,
  type JoinOrder,
  type Naming,
  type NamingImport,
  type NamingPreset,
  type SeedRecord,
  type StyleId,
} from '../../../engine/index'
import { netSpanLabel } from '../../lib/demonBrowser'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../lib/labelScheme'
import {
  NAMES_COPY,
  exportSeedOnly,
  exportSuccess,
  generated,
  importError,
  importSeedOnly,
  importSuccess,
  invalidEntries,
  joinStatus,
  noticeBody,
  pendingLine,
  regenerated,
  rerolled,
  savedLine,
  seedError,
  seedOnlySentence,
  smoothingStatus,
  summaryLine,
  unknownKeysSuffix,
  type ImportCopyContext,
} from '../../lib/namingCopy'
import { NAMES_PREVIEW_ROWS, NAMES_SCROLL_INSET_PX, REROLL_SEED_LENGTH } from '../../lib/namingLimits'
import type { NamesPanelState } from '../../lib/namingSession'
import { CyberButton } from '../ui/CyberButton'
import { CyberCheckbox } from '../ui/CyberCheckbox'
import { CyberRadio } from '../ui/CyberRadio'
import { NumogramViewContext } from '../numogram/ViewContext'
import { CollisionReport } from './CollisionReport'
import { useNaming, type NamingContextValue } from './NamingContext'
import { ZoneList, useObservedHeight } from './ZoneList'

// ----- shared classes (Typography: 8px eyebrows, 10px body; Spacing: 24px targets, 8px between blocks) -----

const EYEBROW = 'block text-[8px] uppercase tracking-[0.3em] text-gray-400'
const HELPER = 'text-[10px] leading-[1.4] text-gray-400'
const RADIO_ROW = 'flex flex-wrap gap-x-3 gap-y-1'
const BUTTON_ROW = 'flex flex-wrap gap-2'
const TARGET = 'min-h-[24px]'
const ACCENT_UNDERLINE = 'inset 0 -1px 0 rgba(16,255,80,0.4)'

// ----- pure helpers (exported for the tests; no DOM) -----

/**
 * A new short seed for Reroll: two 32-bit words from the platform source as lowercase base-36 text, each padded to its full width so the
 * length never depends on the values, cut to REROLL_SEED_LENGTH. UI code only; the engine generator stays deterministic.
 */
export function rerollSeed(random: (words: Uint32Array) => Uint32Array = words => crypto.getRandomValues(words)): string {
  const words = random(new Uint32Array(2))
  let text = ''
  for (const word of words) text += word.toString(36).padStart(7, '0')
  return text.slice(0, REROLL_SEED_LENGTH)
}

/** What committing the seed field does: nothing for the seed the naming already has, a refusal for an invalid one, else the new seed. */
export type SeedCommit =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'commit'; readonly seed: string }

export function seedCommitOf(draft: string, current: string): SeedCommit {
  const seed = normalizeSeed(draft)
  if (seed === null) return { kind: 'invalid' }
  return seed === current ? { kind: 'unchanged' } : { kind: 'commit', seed }
}

/** What a key in the seed field means: commit (Enter), revert (Escape), or nothing. */
export type SeedKeyIntent = 'commit' | 'revert' | null

/**
 * The meaning of a key pressed in the seed field. A key an input method is composing with means nothing (WR-07): a visitor typing
 * Chinese, Japanese or Korean confirms a candidate with Enter and cancels one with Escape, and neither may commit or discard the
 * half-composed seed. isComposing covers Chromium and Firefox, keyCode 229 covers Safari, which ends the composition before the keydown.
 */
export function seedKeyIntent(key: string, native: { readonly isComposing?: boolean; readonly keyCode?: number }): SeedKeyIntent {
  if (native.isComposing === true || native.keyCode === 229) return null
  if (key === 'Enter') return 'commit'
  if (key === 'Escape') return 'revert'
  return null
}

/**
 * The demons the preview table shows: the pinned one first when it is a demon of this base, then the lowest mesh numbers, up to `rows`
 * in all. Walks at most `rows` numbers, so it is cheap at every base.
 */
export function previewMeshes(base: number, pinnedMesh: number | null, rows: number): readonly number[] {
  const total = (base * (base - 1)) / 2
  const out: number[] = []
  if (pinnedMesh !== null && Number.isInteger(pinnedMesh) && pinnedMesh >= 0 && pinnedMesh < total) out.push(pinnedMesh)
  for (let mesh = 0; mesh < total && out.length < rows; mesh++) {
    if (!out.includes(mesh)) out.push(mesh)
  }
  return out
}

// ----- export and import (NAM-03): one serializer, one validator, all or nothing -----

/** The fixed name of the downloaded file: it carries only the base (no user text), so it can never be a path or a script. */
export function exportFileName(base: number): string {
  return `ccrug-names-base${base}.json`
}

/** The temporary anchor of a download; an HTMLAnchorElement satisfies it. */
export interface AnchorLike {
  href: string
  download: string
  click(): void
  remove(): void
}

/** The browser machinery of a download, injected so the order of its steps can be tested without a DOM. */
export interface DownloadEnv {
  makeUrl(blob: Blob): string
  revokeUrl(url: string): void
  makeAnchor(): AnchorLike
  /** Runs `fn` after the click has been handled (a timer in the browser). */
  defer(fn: () => void): void
}

/** The real environment: an object URL, a hidden anchor appended to the body, and a zero-delay timer. Every member reads the browser lazily. */
export function browserDownloadEnv(): DownloadEnv {
  return {
    makeUrl: blob => URL.createObjectURL(blob),
    revokeUrl: url => URL.revokeObjectURL(url),
    makeAnchor: () => {
      const anchor = document.createElement('a')
      anchor.rel = 'noopener'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      return anchor
    },
    defer: fn => {
      window.setTimeout(fn, 0)
    },
  }
}

/** Downloads `text` as one JSON file through a Blob and a temporary anchor (no network); the object URL is revoked after the click. */
export function downloadJson(text: string, fileName: string, env: DownloadEnv = browserDownloadEnv()): void {
  const url = env.makeUrl(new Blob([text], { type: 'application/json' }))
  const anchor = env.makeAnchor()
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  anchor.remove()
  env.defer(() => env.revokeUrl(url))
}

/**
 * Exports the naming (pretty-printed, the form people read) under its fixed file name and returns the status sentence. Above the ceiling
 * the naming has no table, so the file carries the seed, style, join order and smoothing flag only and the sentence says so.
 */
export function exportNaming(naming: Naming, base: number, env: DownloadEnv = browserDownloadEnv()): string {
  downloadJson(serializeNaming(naming, { pretty: true }), exportFileName(base), env)
  return naming.sounds === null ? exportSeedOnly(base) : exportSuccess(base)
}

/** Import changes the working naming, so it is offered only where editing is: not while previewing a link and not while a base is building. */
export function importAllowed(state: NamesPanelState): boolean {
  return state === 'ready' || state === 'seed-only'
}

/** What an import attempt shows: a success or an error sentence, and for a wrong-base file that carries one, the seed it could offer. */
export interface ImportOutcome {
  readonly kind: 'success' | 'error'
  readonly text: string
  readonly offerSeed: SeedRecord | null
}

/**
 * The sentence for one validator result. A success counts the sounds and the renamed demons (a seed-only naming has its own line) and
 * lists the keys this version ignored. A refusal that ends the read by itself, or a wrong base, gets its own sentence; anything else
 * is a list of refused entries. Only a wrong-base refusal can offer a seed.
 */
export function importOutcome(result: NamingImport, ctx: ImportCopyContext): ImportOutcome {
  if (result.ok) {
    const { naming } = result
    const line =
      naming.sounds === null ? importSeedOnly(ctx.base) : importSuccess(ctx.base, naming.sounds.length, naming.overrides.size)
    return { kind: 'success', text: line + unknownKeysSuffix(result.unknownKeys, result.unknownKeyCount), offerSeed: null }
  }
  const first = result.issues[0]
  if (first !== undefined) {
    switch (first.kind) {
      case 'not-json':
      case 'too-large':
      case 'unknown-version':
      case 'not-names-file':
      case 'seed-only-base':
        return { kind: 'error', text: importError(first, ctx), offerSeed: null }
      case 'wrong-base':
        return { kind: 'error', text: importError(first, ctx), offerSeed: result.offerSeed }
      default:
        break
    }
  }
  return { kind: 'error', text: invalidEntries(result.issues, result.issueCount, ctx), offerSeed: null }
}

/** What the import reader needs of a chosen file: its size and its text (a File satisfies it). */
export interface FileLike {
  readonly size: number
  text(): Promise<string>
}

/** What the import reader needs of the app: the base, the ceiling, the CCRU preset and the label helpers of the copy. */
export interface ImportFileEnv {
  readonly base: number
  readonly interactiveMaxN: number
  readonly preset: NamingPreset | null
  readonly copy: ImportCopyContext
}

/** The naming to apply (null when the file was refused) and the sentence to show. */
export interface ImportRead {
  readonly naming: Naming | null
  readonly outcome: ImportOutcome
}

const refused = (text: string): ImportRead => ({ naming: null, outcome: { kind: 'error', text, offerSeed: null } })

/**
 * Reads a chosen file as untrusted data (T-07-05b, T-07-04b): its size is checked before anything is read, its text goes through the
 * one validator, and the result is all or nothing. Never throws; a file the browser cannot read is the `unreadable` refusal.
 */
export async function readImportFile(file: FileLike, env: ImportFileEnv): Promise<ImportRead> {
  if (file.size > NAMING_IMPORT_MAX_BYTES) return refused(importError({ kind: 'too-large', maxBytes: NAMING_IMPORT_MAX_BYTES }))
  let text: string
  try {
    text = await file.text()
  } catch {
    return refused(importError({ kind: 'unreadable' }))
  }
  const result = validateNamingJson(text, { base: env.base, interactiveMaxN: env.interactiveMaxN, preset: env.preset })
  return { naming: result.ok ? result.naming : null, outcome: importOutcome(result, env.copy) }
}

// ----- the header tag -----

/** The one tag the collapsed header shows: `unsaved preview`, else `edits not in links`, else nothing (UI-SPEC "Header tag"). */
export function NamesHeaderTag(): JSX.Element | null {
  const naming = useNaming()
  if (naming === null) return null
  const kind = naming.state === 'preview' ? 'preview' : naming.uncarried ? 'edits' : null
  if (kind === null) return null
  return (
    <span
      data-post-baseline=""
      data-names-header-tag={kind}
      className="text-[8px] uppercase tracking-[0.12em] text-gray-400"
    >
      {kind === 'preview' ? NAMES_COPY.tagPreview : NAMES_COPY.tagEdits}
    </span>
  )
}

// ----- the panel -----

export interface NamesPanelProps {
  /** True while the panel body is open; the live carrier stays mounted either way. */
  open: boolean
  /** The `maxBodyHeight` handed to CyberPanel; the scroller is NAMES_SCROLL_INSET_PX shorter so the panel wrapper never scrolls. */
  bodyMax: number
  /** The pinned demon's mesh number, shown first in the preview table. */
  pinnedMesh: number | null
  /** The pinned zone, for the zone list's pin link (plan 07-19). */
  pinnedZone: number | null
}

export function NamesPanel({ open, bodyMax, pinnedMesh, pinnedZone }: NamesPanelProps): JSX.Element | null {
  const naming = useNaming()
  if (naming === null) return null
  return (
    <div data-post-baseline="" data-names-panel="" data-names-state={naming.state} data-names-base={naming.base}>
      {/* Persistent sr-only live carrier (Pitfall 13): it exists before its text changes, also while the panel is collapsed. */}
      <div role="status" aria-live="polite" className="sr-only" data-names-live="">
        {naming.announcement}
      </div>
      {/* Keyed by the displayed base: a base switch starts the body afresh (scroll at the top, no status, no draft). */}
      {open && <NamesBody key={naming.base} nc={naming} open={open} bodyMax={bodyMax} pinnedMesh={pinnedMesh} pinnedZone={pinnedZone} />}
    </div>
  )
}

interface RadioGroupProps<T extends string> {
  readonly eyebrow: string
  readonly ariaLabel: string
  readonly name: string
  readonly dataKey: string
  readonly options: readonly T[]
  readonly labels: Readonly<Record<T, string>>
  readonly value: T
  readonly disabled: boolean
  readonly onSelect: (value: T) => void
  /** The visible description of the selected option, when the group has one. */
  readonly description?: { readonly id: string; readonly text: string; readonly props: Readonly<Record<string, string>> }
}

/** An eyebrow, then a wrapping row of radios, then the visible description of the selected option. */
function RadioGroup<T extends string>(props: RadioGroupProps<T>): JSX.Element {
  const { eyebrow, ariaLabel, name, dataKey, options, labels, value, disabled, onSelect, description } = props
  return (
    <div>
      <span className={EYEBROW}>{eyebrow}</span>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-describedby={description?.id}
        aria-disabled={disabled ? 'true' : undefined}
        className={RADIO_ROW}
      >
        {options.map(option => (
          <CyberRadio
            key={option}
            name={name}
            label={labels[option]}
            checked={value === option}
            disabled={disabled}
            onChange={() => onSelect(option)}
            className={TARGET}
            dataAttrs={{ [dataKey]: option }}
          />
        ))}
      </div>
      {description !== undefined && (
        <p id={description.id} {...description.props} className={HELPER}>
          {description.text}
        </p>
      )}
    </div>
  )
}

export type StatusKind = 'success' | 'error' | 'info'

/**
 * What a shown status does when the naming revision changes. The render that first shows a status adopts the revision it shows (the
 * action and its status are batched into that render); any later revision, from this panel or from anywhere else, clears it.
 */
export function statusFate(statusRev: number | null, rev: number): 'adopt' | 'keep' | 'clear' {
  if (statusRev === null) return 'adopt'
  return statusRev === rev ? 'keep' : 'clear'
}

/** The panel-local status line of block 10: the latest result, with the buttons that belong to it. */
export interface NamesStatus {
  readonly text: string
  readonly kind: StatusKind
  /** True for a replace-all result: the inline `Undo this change` button shows. */
  readonly undo: boolean
  /** A wrong-base file's seed record: the `Use its seed here` button shows. */
  readonly offerSeed: SeedRecord | null
}

interface NamesStatusSlotProps {
  readonly status: NamesStatus | null
  readonly onUndo: () => void
  readonly onUseSeed: (record: SeedRecord) => void
}

/** The status line (plain text, no role: the carrier announces), then `Use its seed here` and `Undo this change` each on their own line. */
export function NamesStatusSlot({ status, onUndo, onUseSeed }: NamesStatusSlotProps): JSX.Element | null {
  if (status === null) return null
  const offer = status.offerSeed
  return (
    <div className="space-y-1">
      <p
        data-names-status=""
        data-kind={status.kind}
        className={status.kind === 'error' ? 'text-[10px] leading-[1.4] text-[#f87171]' : 'text-[10px] leading-[1.4] text-gray-300'}
      >
        {status.text}
      </p>
      {offer !== null && (
        <div>
          <CyberButton size="sm" className={TARGET} onClick={() => onUseSeed(offer)} dataAttrs={{ 'data-names-use-seed': '' }}>
            {NAMES_COPY.useSeed}
          </CyberButton>
        </div>
      )}
      {status.undo && (
        <div>
          <CyberButton size="sm" className={TARGET} onClick={onUndo} dataAttrs={{ 'data-names-undo': '' }}>
            {NAMES_COPY.undoChange}
          </CyberButton>
        </div>
      )}
    </div>
  )
}

interface NamesBodyProps {
  readonly nc: NamingContextValue
  /** Always true while the body is mounted; handed on so the collision check runs only while the panel is open. */
  readonly open: boolean
  readonly bodyMax: number
  readonly pinnedMesh: number | null
  readonly pinnedZone: number | null
}

function NamesBody({ nc, open, bodyMax, pinnedMesh, pinnedZone }: NamesBodyProps): JSX.Element {
  const n: Naming = nc.naming
  const { base, state, preset } = nc
  const view = useContext(NumogramViewContext)
  const ids = useId()
  const styleDescriptionId = `${ids}-style`
  const joinDescriptionId = `${ids}-join`
  const seedErrorId = `${ids}-seed-error`
  const scrollRef = useRef<HTMLDivElement>(null)
  const [controlsRef, controlsHeight] = useObservedHeight<HTMLDivElement>()

  // The latest context value for callbacks that run after a timer (the deferred seed blur).
  const ncRef = useRef(nc)
  useEffect(() => {
    ncRef.current = nc
  })

  // States: pending (a base switch is building) and preview (an unsaved link) disable every editing control; seed-only keeps the
  // generator controls and drops the per-zone ones. Source is shown only where the environment has a preset for the base.
  const locked = state === 'preview' || state === 'pending'
  const seedOnly = state === 'seed-only'
  const showSource = !seedOnly && preset !== null && preset.base === base
  const showSummary = state === 'ready' || state === 'preview'

  // ----- the seed field: a draft with a dirty flag, committed on Enter or blur -----
  const [draft, setDraft] = useState(n.seed)
  const [dirty, setDirty] = useState(false)
  const [seedProblem, setSeedProblem] = useState(false)
  const seedRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef(draft)
  const dirtyRef = useRef(dirty)
  const blurTimer = useRef<number | null>(null)
  useEffect(() => {
    draftRef.current = draft
    dirtyRef.current = dirty
  })
  // An external change (an undo, a keep, a style change that kept the seed) re-syncs the field, but never over what the visitor is typing.
  useEffect(() => {
    if (!dirty) setDraft(n.seed)
  }, [n.seed, dirty])
  useEffect(
    () => () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
    },
    [],
  )

  // After Keep or Back the notice, and the button that had focus, unmount: focus moves to the seed field (UI-SPEC "Shared link").
  const [focusSeed, setFocusSeed] = useState(false)
  useEffect(() => {
    if (!focusSeed || state === 'preview') return
    seedRef.current?.focus()
    setFocusSeed(false)
  }, [focusSeed, state])

  // ----- the status slot of block 10 and the carrier -----
  // One status line (plain text, no role) for the latest result; the same text goes through the persistent sr-only carrier. It stays
  // until the next naming action, a base change (the body is keyed by base) or the panel collapsing (the body unmounts). `statusRev`
  // is the naming revision the status was produced at: a later revision, from this panel or from anywhere else, clears it.
  const [status, setStatus] = useState<NamesStatus | null>(null)
  const [statusRev, setStatusRev] = useState<number | null>(null)
  function say(text: string, kind: StatusKind, undo: boolean, offerSeed: SeedRecord | null = null): void {
    setStatus({ text, kind, undo, offerSeed })
    setStatusRev(null)
    ncRef.current.announce(text)
  }
  useEffect(() => {
    if (status === null) return
    const fate = statusFate(statusRev, nc.rev)
    if (fate === 'adopt') setStatusRev(nc.rev)
    else if (fate === 'clear') {
      setStatus(null)
      setStatusRev(null)
    }
  }, [status, statusRev, nc.rev])

  // ----- handlers -----
  function commitSeed(): void {
    if (!dirtyRef.current) return
    const current = ncRef.current
    const result = seedCommitOf(draftRef.current, current.naming.seed)
    if (result.kind === 'invalid') {
      setSeedProblem(true)
      current.announce(seedError())
      return
    }
    setSeedProblem(false)
    setDirty(false)
    if (result.kind === 'commit' && current.apply({ type: 'seed', seed: result.seed })) {
      say(generated(current.base, result.seed), 'success', true)
    }
  }

  function onSeedChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setDraft(e.target.value)
    setDirty(true)
    setSeedProblem(false)
  }

  function onSeedKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    const intent = seedKeyIntent(e.key, e.nativeEvent)
    if (intent === 'commit') {
      e.preventDefault()
      commitSeed()
    } else if (intent === 'revert') {
      setDirty(false)
      setSeedProblem(false)
      setDraft(ncRef.current.naming.seed)
    }
  }

  // Deferred like BasePicker's blur: look at where focus went after the click's own default action has run.
  function onSeedBlur(): void {
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
    blurTimer.current = window.setTimeout(() => {
      blurTimer.current = null
      if (document.activeElement === seedRef.current) return
      commitSeed()
    }, 0)
  }

  function onReroll(): void {
    const seed = rerollSeed()
    if (!nc.apply({ type: 'reroll', seed })) return
    setDirty(false)
    setSeedProblem(false)
    const locks = n.locks.size
    say(n.sounds === null ? generated(base, seed) : rerolled(base - locks, locks), 'success', true)
  }

  function onSource(source: 'generated' | 'ccru'): void {
    if (!nc.apply({ type: 'source', source })) return
    say(source === 'ccru' ? NAMES_COPY.loadedCcru : generated(base, n.seed), 'success', true)
  }

  function onStyle(style: StyleId): void {
    if (!nc.apply({ type: 'style', style })) return
    const locks = n.locks.size
    say(n.sounds === null ? generated(base, n.seed) : regenerated(base - locks, style, locks), 'success', true)
  }

  function onJoin(join: JoinOrder): void {
    if (!nc.apply({ type: 'join', join })) return
    say(joinStatus(join), 'info', false)
  }

  function onSmoothing(): void {
    const smoothing = n.smoothing === 1 ? 0 : 1
    if (!nc.apply({ type: 'smoothing', smoothing })) return
    say(smoothingStatus(smoothing === 1), 'info', false)
  }

  function onKeep(): void {
    nc.keep()
    setFocusSeed(true)
    say(NAMES_COPY.kept, 'success', true)
  }

  function onRevert(): void {
    nc.revert()
    setFocusSeed(true)
    say(NAMES_COPY.backToSaved, 'info', false)
  }

  // ----- export and import (block 10) -----
  const fileRef = useRef<HTMLInputElement>(null)

  function onExport(): void {
    say(exportNaming(n, base), 'success', false)
  }

  function importCopyContext(): ImportCopyContext {
    return {
      base,
      zoneLabel,
      netSpan: mesh => {
        const [a, b] = netSpanOf(mesh)
        return netSpanLabel(a, b, zoneLabel)
      },
    }
  }

  // The file is untrusted data: its size is checked first, its text goes through the one validator, nothing is half-applied.
  async function importFile(file: File, input: HTMLInputElement): Promise<void> {
    const start = ncRef.current
    const copy = importCopyContext()
    let read: ImportRead
    try {
      read = await readImportFile(file, { base: start.base, interactiveMaxN: start.interactiveMaxN, preset: start.preset, copy })
    } finally {
      input.value = ''
    }
    // the base or the state moved on while the file was being read (a base switch finished, a link opened a preview): drop it
    const now = ncRef.current
    if (now.base !== start.base || !importAllowed(now.state)) return
    if (read.naming === null) {
      say(read.outcome.text, 'error', false, read.outcome.offerSeed)
      return
    }
    if (!now.apply({ type: 'import', naming: read.naming })) return
    say(read.outcome.text, 'success', true)
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>): void {
    const input = e.currentTarget
    const file = input.files?.[0]
    if (file === undefined) return
    void importFile(file, input)
  }

  function onUseSeed(record: SeedRecord): void {
    if (!nc.apply({ type: 'use-seed', record })) return
    say(generated(base, record.seed), 'success', true)
  }

  // The inline Undo is the app's own undo, limited to a naming change (WR-05): when the newest history entry is something else it does
  // nothing, so the status that offered it (now stale, the names changed before something else did) goes either way.
  function onUndo(): void {
    nc.undo()
    setStatus(null)
    setStatusRev(null)
  }

  // ----- derived display data -----
  // Smoothing is inert when no join of these sounds changes: the table when there is one, else the style that never makes clusters.
  const inert = useMemo(() => (n.sounds === null ? n.style !== 'harsh' : smoothingInert(n.sounds)), [n.sounds, n.style])
  const zoneLabel = (zone: number): string => (view !== null ? view.zoneLabel(zone) : formatZoneLabel(zone, base, DEFAULT_LABEL_SCHEME))
  const savedKey = state === 'preview' ? 'preview' : seedOnly ? 'seed-only' : nc.saved
  const savedText =
    savedKey === 'saved'
      ? savedLine(base)
      : savedKey === 'failed'
        ? NAMES_COPY.savedFailed
        : savedKey === 'preview'
          ? NAMES_COPY.savedPreview
          : savedKey === 'seed-only'
            ? NAMES_COPY.savedSeedOnly
            : NAMES_COPY.savedNone

  return (
    <div
      ref={scrollRef}
      data-names-scroll=""
      className="space-y-2 px-3 pb-2.5"
      style={{
        maxHeight: bodyMax - NAMES_SCROLL_INSET_PX,
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y',
      }}
    >
      <div ref={controlsRef} data-names-controls="" className="space-y-2">
        {/* block 1: the unsaved-preview notice */}
        {state === 'preview' && (
          <div
            data-names-preview-notice=""
            className="space-y-1.5 p-2"
            style={{ border: '1px solid rgba(16,255,80,0.35)', background: 'rgba(16,255,80,0.04)' }}
          >
            <span className={EYEBROW}>{NAMES_COPY.noticeLabel}</span>
            <p className={HELPER}>{noticeBody(base)}</p>
            <div className="flex flex-col gap-1">
              <CyberButton size="sm" className={`w-full ${TARGET}`} onClick={onKeep} dataAttrs={{ 'data-names-keep': '' }}>
                {NAMES_COPY.keep}
              </CyberButton>
              <CyberButton size="sm" className={`w-full ${TARGET}`} onClick={onRevert} dataAttrs={{ 'data-names-revert': '' }}>
                {NAMES_COPY.revert}
              </CyberButton>
            </div>
          </div>
        )}

        {/* block 2: source, at the base that has a CCRU preset */}
        {showSource && (
          <RadioGroup
            eyebrow={NAMES_COPY.sourceEyebrow}
            ariaLabel={NAMES_COPY.sourceGroupAria}
            name="ccrug-names-source"
            dataKey="data-names-source"
            options={['ccru', 'generated'] as const}
            labels={{ ccru: NAMES_COPY.sourceCcru, generated: NAMES_COPY.sourceGenerated }}
            value={n.source}
            disabled={locked}
            onSelect={onSource}
          />
        )}

        {/* block 3: seed */}
        <div>
          <span className={EYEBROW}>{NAMES_COPY.seedEyebrow}</span>
          <span className={seedProblem ? 'ui-terminal-field ui-terminal-field--invalid' : 'ui-terminal-field'}>
            <input
              ref={seedRef}
              data-names-seed=""
              aria-label={NAMES_COPY.seedEyebrow}
              aria-invalid={seedProblem ? 'true' : undefined}
              aria-describedby={seedProblem ? seedErrorId : undefined}
              aria-disabled={locked ? 'true' : undefined}
              readOnly={locked}
              value={draft}
              maxLength={SEED_MAX_LENGTH}
              dir="auto"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="ui-terminal-input w-full px-0 py-1 text-[14px] text-gray-100"
              onChange={onSeedChange}
              onKeyDown={onSeedKeyDown}
              onBlur={onSeedBlur}
            />
          </span>
          {seedProblem && (
            <p id={seedErrorId} data-names-seed-error="" className="mt-1 text-[10px] leading-[1.4] text-[#f87171]">
              {seedError()}
            </p>
          )}
          <div className={`${BUTTON_ROW} mt-1`}>
            <CyberButton size="sm" className={TARGET} disabled={locked} onClick={onReroll} dataAttrs={{ 'data-names-reroll': '' }}>
              {NAMES_COPY.reroll}
            </CyberButton>
          </div>
          {!showSource && <p className={`${HELPER} mt-1`}>{NAMES_COPY.ccruHint}</p>}
          {seedOnly && (
            <p data-names-seed-only="" className={`${HELPER} mt-1`}>
              {seedOnlySentence()}
            </p>
          )}
        </div>

        {/* block 4: style */}
        <RadioGroup
          eyebrow={NAMES_COPY.styleEyebrow}
          ariaLabel={NAMES_COPY.styleGroupAria}
          name="ccrug-names-style"
          dataKey="data-names-style"
          options={STYLE_IDS}
          labels={NAMES_COPY.styleLabels}
          value={n.style}
          disabled={locked}
          onSelect={onStyle}
          description={{
            id: styleDescriptionId,
            text: NAMES_COPY.styleDescriptions[n.style],
            props: { 'data-names-style-description': '' },
          }}
        />

        {/* block 5: join order */}
        <RadioGroup
          eyebrow={NAMES_COPY.joinEyebrow}
          ariaLabel={NAMES_COPY.joinGroupAria}
          name="ccrug-names-join"
          dataKey="data-names-join"
          options={JOIN_ORDERS}
          labels={NAMES_COPY.joinLabels}
          value={n.join}
          disabled={locked}
          onSelect={onJoin}
          description={{
            id: joinDescriptionId,
            text: NAMES_COPY.joinDescriptions[n.join],
            props: { 'data-names-join-description': '' },
          }}
        />

        {/* block 6: smoothing */}
        <div className="space-y-1">
          <CyberCheckbox
            checked={n.smoothing === 1}
            label={NAMES_COPY.smoothingLabel}
            disabled={locked}
            onChange={onSmoothing}
            className={TARGET}
            dataAttrs={{ 'data-names-smoothing': '' }}
          />
          <p className={HELPER}>{NAMES_COPY.smoothingHelper}</p>
          {inert && (
            <p data-names-smoothing-note="" className={HELPER}>
              {NAMES_COPY.smoothingInert}
            </p>
          )}
        </div>

        {/* block 7: the raw and smoothed names of a few demons, side by side */}
        <div>
          <span className={EYEBROW}>{NAMES_COPY.previewEyebrow}</span>
          <table
            data-names-preview=""
            aria-label="Name preview"
            className="w-full text-left"
            style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}
          >
            <colgroup>
              <col style={{ width: 56 }} />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="py-0.5 text-[8px] font-normal uppercase tracking-[0.12em] text-gray-400">
                  {NAMES_COPY.previewHeaderAb}
                </th>
                <th
                  scope="col"
                  data-col="raw"
                  aria-current={n.smoothing === 0 ? 'true' : undefined}
                  className="py-0.5 text-[8px] font-normal uppercase tracking-[0.12em] text-gray-400"
                  style={n.smoothing === 0 ? { boxShadow: ACCENT_UNDERLINE } : undefined}
                >
                  {NAMES_COPY.previewHeaderRaw}
                </th>
                <th
                  scope="col"
                  data-col="smoothed"
                  aria-current={n.smoothing === 1 ? 'true' : undefined}
                  className="py-0.5 text-[8px] font-normal uppercase tracking-[0.12em] text-gray-400"
                  style={n.smoothing === 1 ? { boxShadow: ACCENT_UNDERLINE } : undefined}
                >
                  {NAMES_COPY.previewHeaderSmoothed}
                </th>
              </tr>
            </thead>
            <tbody>
              {previewMeshes(base, pinnedMesh, NAMES_PREVIEW_ROWS).map(mesh => {
                const [a, b] = netSpanOf(mesh)
                const raw = nc.resolver.ruleNameOf(a, b, 0)
                const smoothed = nc.resolver.ruleNameOf(a, b, 1)
                return (
                  <tr key={mesh} data-names-preview-row={mesh} className="h-6">
                    <td data-names-preview-cell="" className="truncate text-[10px] text-gray-400" title={netSpanLabel(a, b, zoneLabel)}>
                      {netSpanLabel(a, b, zoneLabel)}
                    </td>
                    <td
                      data-names-preview-cell=""
                      className={n.smoothing === 0 ? 'truncate text-[10px] text-gray-100' : 'truncate text-[10px] text-gray-400'}
                      style={{ unicodeBidi: 'plaintext' }}
                      title={raw}
                    >
                      {raw}
                    </td>
                    <td
                      data-names-preview-cell=""
                      className={n.smoothing === 1 ? 'truncate text-[10px] text-gray-100' : 'truncate text-[10px] text-gray-400'}
                      style={{ unicodeBidi: 'plaintext' }}
                      title={smoothed}
                    >
                      {smoothed}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {n.source === 'ccru' && (
            <p data-names-preview-caption="" className={`${HELPER} mt-1`}>
              {NAMES_COPY.previewCaption}
            </p>
          )}
        </div>

        {/* block 8: summary, and the share note while edits exist that a link cannot carry */}
        {showSummary && (
          <div className="space-y-1">
            <p data-names-summary="" className={HELPER}>
              {summaryLine(n.locks.size, n.overrides.size)}
            </p>
            {nc.uncarried && (
              <p data-names-share-note="" className={HELPER}>
                {NAMES_COPY.shareNote}
              </p>
            )}
          </div>
        )}

        {/* block 9: the collision report (plan 07-20), where there is a naming to check: ready and preview */}
        {showSummary && <CollisionReport open={open} />}

        {/* block 10: import and export, one status slot with the inline Undo */}
        <div className="space-y-1">
          <div className={BUTTON_ROW}>
            <CyberButton size="sm" className={TARGET} onClick={onExport} dataAttrs={{ 'data-names-export': '' }}>
              {NAMES_COPY.exportNames}
            </CyberButton>
            <CyberButton
              size="sm"
              className={TARGET}
              disabled={!importAllowed(state)}
              onClick={() => fileRef.current?.click()}
              dataAttrs={{ 'data-names-import': '' }}
            >
              {NAMES_COPY.importNames}
            </CyberButton>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              data-names-import-input=""
              hidden
              tabIndex={-1}
              onChange={onFileChosen}
            />
          </div>
          <NamesStatusSlot status={status} onUndo={onUndo} onUseSeed={onUseSeed} />
        </div>

        {/* block 11: the autosave line */}
        <p
          data-names-saved={savedKey}
          className={savedKey === 'failed' ? 'text-[10px] leading-[1.4] text-[#f87171]' : HELPER}
        >
          {savedText}
        </p>
      </div>

      {/* block 12: the zone list, editable while ready and read only while previewing; the pending line stands in while a base builds */}
      {(state === 'ready' || state === 'preview') && (
        <ZoneList scrollEl={() => scrollRef.current} scrollMargin={controlsHeight} pinnedZone={pinnedZone} />
      )}
      {state === 'pending' && (
        <p data-names-pending="" className={HELPER}>
          {pendingLine(nc.pendingBase ?? base)}
        </p>
      )}
    </div>
  )
}

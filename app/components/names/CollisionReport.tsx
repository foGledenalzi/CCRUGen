'use client'

// The collision report (Phase 7, plan 20; D-12, NAM-03, 07-UI-SPEC "Collision Report", 07-RESEARCH Pattern 5, T-07-06d, T-07-11b,
// T-07-10e): block 9 of the Names panel. Two demons that end up with the same name are REPORTED, never repaired: a count line, a
// list of the repeated names (at most one page at a time), and for each name up to four jump buttons that open the demon name editor
// inline under that line, so the visitor can rename by hand. The answer comes from the engine: a generated table is certified at
// once, any other table up to the data limit is scanned on the main thread in short cancellable slices (app/lib/collisionSchedule.ts),
// and a table above the limit is not checked. A newer naming cancels the running job and a stale result is never reported (a
// generation counter), and "Checking..." shows only after the grace period of the other pending states. A jump never pins the demon,
// so the panel stack below Selection never moves under the pointer. Everything the visitor typed stays a React text node or an
// attribute string. Original CCRUG code (MIT, NOTICE section 1).
import React, { useContext, useEffect, useRef, useState } from 'react'
import {
  createCollisionJob,
  netSpanOf,
  type CollisionGroup,
  type CollisionReport as CollisionData,
  type Naming,
  type NameState,
} from '../../../engine/index'
import { PENDING_GRACE_MS } from '../../lib/canvas/diagramModel'
import { browserSchedule, collisionPlan, runSlicedJob } from '../../lib/collisionSchedule'
import { netSpanLabel } from '../../lib/demonBrowser'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../lib/labelScheme'
import { NAMES_COPY, collisionsAnnounceSome, collisionsNotChecked, collisionsSome, jumpAriaLabel, moreJumps, showingNames } from '../../lib/namingCopy'
import { COLLISION_JUMPS_SHOWN, COLLISION_LINES_STEP, COLLISION_SLICE_MS, collisionScanLimit } from '../../lib/namingLimits'
import type { NamesPanelState } from '../../lib/namingSession'
import { NumogramViewContext } from '../numogram/ViewContext'
import { CyberButton } from '../ui/CyberButton'
import { DemonNameEditor } from './DemonNameEditor'
import { useNaming, type NamingContextValue } from './NamingContext'

// ----- shared classes (Typography: 8px eyebrow, 10px body; counts gray-100, never red; Spacing: 24px targets) -----

const EYEBROW = 'block text-[8px] uppercase tracking-[0.3em] text-gray-400'
const HELPER = 'text-[10px] leading-[1.4] text-gray-400'
const STRONG = 'text-[10px] leading-[1.4] text-gray-100'
const TARGET = 'min-h-[24px]'

const TAGS: Readonly<Record<NameState, string>> = Object.freeze({
  generated: NAMES_COPY.tagGenerated,
  preset: NAMES_COPY.tagCcru,
  overridden: NAMES_COPY.tagOverridden,
})

// ----- pure decisions (exported for the tests; no DOM) -----

/** What the block shows: nothing answered yet, the checking line, a skipped check, or an answer. */
export type CollisionPhase = 'pending' | 'checking' | 'done' | 'skip'

/** The last answer and the naming it answers for; a null report means the check was skipped (above the limit). */
export interface ShownReport {
  readonly naming: Naming
  readonly report: CollisionData | null
}

/** Checking wins (the last answer is hidden while a newer one is computed), then no answer yet, then skipped, then done. */
export function phaseOf(shown: ShownReport | null, checking: boolean): CollisionPhase {
  if (checking) return 'checking'
  if (shown === null) return 'pending'
  return shown.report === null ? 'skip' : 'done'
}

/** The jump buttons of one repeated name: its lowest demons up to the cap, and how many more carry the name (from the exact size). */
export function jumpsOf(group: CollisionGroup): { readonly meshes: readonly number[]; readonly more: number } {
  const meshes = group.meshes.slice(0, COLLISION_JUMPS_SHOWN)
  return { meshes, more: group.size - meshes.length }
}

/** How many lines the list shows after `pages` pages: a page of the data step at a time, never more than the list holds. */
export function linesShown(pages: number, listLength: number): number {
  return Math.min(listLength, pages * COLLISION_LINES_STEP)
}

/** What a jump does: open the editor where editing is allowed, only say so while previewing (the naming is not the visitor's yet). */
export type JumpOutcome = 'edit' | 'hint' | 'none'

export function jumpOutcome(state: NamesPanelState): JumpOutcome {
  if (state === 'ready') return 'edit'
  if (state === 'preview') return 'hint'
  return 'none'
}

/**
 * The sentence the live carrier says when the number of repeated names changes (UI-SPEC "Announcements": `{g} repeated names.` or
 * `No repeated names.`): nothing for the first answer and nothing when the number did not change.
 */
export function collisionAnnouncement(previous: number | null, groups: number): string | null {
  if (previous === null || previous === groups) return null
  return groups === 0 ? NAMES_COPY.collisionsAnnounceNone : collisionsAnnounceSome(groups)
}

// ----- presentation -----

export interface CollisionReportViewProps {
  readonly phase: CollisionPhase
  /** The scan limit, for the "Not checked above" sentence. */
  readonly limit: number
  readonly report: CollisionData | null
  readonly expanded: boolean
  /** Pages of the list shown (the data step lines each). */
  readonly pages: number
  /** The demon whose inline editor is open, if any. */
  readonly editing: number | null
  /** The demon a jump was refused for while previewing, if any: the hint shows under its line. */
  readonly hint: number | null
  readonly zoneLabel: (zone: number) => string
  /** The name the demon has now (the jump button's accessible name says it). */
  readonly nameOf: (a: number, b: number) => string
  readonly rootRef?: React.Ref<HTMLDivElement>
  readonly onToggle: () => void
  readonly onMore: () => void
  readonly onJump: (mesh: number) => void
  readonly onEditorDone: (mesh: number) => void
}

/** The heading of an inline editor: which demon it is (net-span in the active scheme) and where its name comes from. */
function EditorTitle({ mesh, zoneLabel }: { readonly mesh: number; readonly zoneLabel: (zone: number) => string }): JSX.Element | null {
  const naming = useNaming()
  if (naming === null) return null
  const [a, b] = netSpanOf(mesh)
  return (
    <p data-collision-editor-title="" className={HELPER}>
      <span className="text-gray-100">{netSpanLabel(a, b, zoneLabel)}</span> {TAGS[naming.resolver.stateOf(a, b)]}
    </p>
  )
}

/** The markup of the block in every phase, with no state of its own (the container below owns the job, the list and the focus). */
export function CollisionReportView(props: CollisionReportViewProps): JSX.Element {
  const { phase, limit, report, expanded, pages, editing, hint, zoneLabel, nameOf } = props
  const answer = phase === 'done' ? report : null
  const groups = answer === null ? null : answer.groups
  const state = answer === null ? phase : answer.groups === 0 ? 'none' : 'some'
  const lines = answer === null ? [] : answer.list.slice(0, linesShown(pages, answer.list.length))

  return (
    <div
      ref={props.rootRef}
      data-post-baseline=""
      data-names-collisions=""
      data-state={state}
      data-count={groups ?? undefined}
      data-demons={answer === null ? undefined : answer.demons}
      aria-busy={phase === 'checking' ? 'true' : undefined}
      tabIndex={-1}
      className="space-y-1"
    >
      <span className={EYEBROW}>{NAMES_COPY.collisionsEyebrow}</span>

      {phase === 'checking' && (
        <p data-names-collisions-line="" className={HELPER}>
          {NAMES_COPY.collisionsChecking}
        </p>
      )}
      {phase === 'skip' && (
        <p data-names-collisions-line="" className={HELPER}>
          {collisionsNotChecked(limit)}
        </p>
      )}
      {answer !== null && answer.groups === 0 && (
        <p data-names-collisions-line="" className={HELPER}>
          {NAMES_COPY.collisionsNone}
        </p>
      )}

      {answer !== null && answer.groups > 0 && (
        <>
          <p data-names-collisions-line="" className={STRONG}>
            {collisionsSome(answer.groups, answer.demons)}
          </p>
          <div>
            <CyberButton size="sm" className={TARGET} ariaExpanded={expanded} onClick={props.onToggle} dataAttrs={{ 'data-collision-toggle': '' }}>
              {expanded ? NAMES_COPY.hideCollisions : NAMES_COPY.showCollisions}
            </CyberButton>
          </div>

          {expanded && (
            <>
              <ul role="list" data-names-collisions-list="" className="space-y-1.5">
                {lines.map(group => {
                  const { meshes, more } = jumpsOf(group)
                  const editorHere = editing !== null && group.meshes.includes(editing)
                  const hintHere = hint !== null && group.meshes.includes(hint)
                  return (
                    <li key={group.meshes[0]} data-collision-name={group.name} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          data-collision-name-text=""
                          className={`${STRONG} [overflow-wrap:anywhere]`}
                          style={{ unicodeBidi: 'plaintext' }}
                        >
                          {group.name}
                        </span>
                        {meshes.map(mesh => {
                          const [a, b] = netSpanOf(mesh)
                          return (
                            <CyberButton
                              key={mesh}
                              size="sm"
                              className={TARGET}
                              ariaLabel={jumpAriaLabel(zoneLabel(a), zoneLabel(b), nameOf(a, b))}
                              onClick={() => props.onJump(mesh)}
                              dataAttrs={{ 'data-collision-jump': String(mesh) }}
                            >
                              {netSpanLabel(a, b, zoneLabel)}
                            </CyberButton>
                          )
                        })}
                        {more > 0 && (
                          <span data-collision-extra="" className={HELPER}>
                            {moreJumps(more)}
                          </span>
                        )}
                      </div>
                      {editorHere && editing !== null && (
                        <div className="space-y-0.5">
                          <EditorTitle mesh={editing} zoneLabel={zoneLabel} />
                          <InlineEditor mesh={editing} onDone={props.onEditorDone} />
                        </div>
                      )}
                      {hintHere && (
                        <p data-names-collisions-status="" className={HELPER}>
                          {NAMES_COPY.previewJump}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
              {lines.length < answer.groups && (
                <p data-collision-showing="" className={HELPER}>
                  {showingNames(lines.length, answer.groups)}
                </p>
              )}
              {lines.length < answer.list.length && (
                <div>
                  <CyberButton size="sm" className={TARGET} onClick={props.onMore} dataAttrs={{ 'data-collision-more': '' }}>
                    {NAMES_COPY.showMoreNames}
                  </CyberButton>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

/** The demon name editor opened on one demon, in edit mode, bound to that demon (it never writes to another one). */
function InlineEditor({ mesh, onDone }: { readonly mesh: number; readonly onDone: (mesh: number) => void }): JSX.Element {
  const [a, b] = netSpanOf(mesh)
  return <DemonNameEditor key={mesh} a={a} b={b} context="collision" autoEdit onDone={() => onDone(mesh)} />
}

// ----- the component -----

export interface CollisionReportProps {
  /** True while the panel body is open: the check runs only while the block can be seen. */
  open: boolean
  /** A report to show before any job has run (tests render it on the server, where no effect runs). */
  initialReport?: CollisionData | null
}

interface BodyProps extends CollisionReportProps {
  readonly nc: NamingContextValue
}

/** The demon whose editor just closed and the name its line had, so focus can find its way back when the line changed. */
interface FocusReturn {
  readonly mesh: number
  readonly name: string | null
}

/**
 * Puts focus back after an editor closed: on that demon's own jump button; when the rename took the demon out of its group, on the
 * first jump button of the line that kept the name (the next demon to fix); when no such line is left, on the toggle, else on the
 * block itself (it takes programmatic focus), so focus is never dropped to the page.
 */
function focusAfterEditor(root: HTMLElement | null, back: FocusReturn): void {
  if (root === null) return
  let sibling: HTMLElement | null = null
  if (back.name !== null) {
    for (const line of root.querySelectorAll<HTMLElement>('[data-collision-name]')) {
      if (line.getAttribute('data-collision-name') === back.name) {
        sibling = line.querySelector<HTMLElement>('[data-collision-jump]')
        break
      }
    }
  }
  const target =
    root.querySelector<HTMLElement>(`[data-collision-jump="${back.mesh}"]`) ??
    sibling ??
    root.querySelector<HTMLElement>('[data-collision-toggle]') ??
    root
  target.focus()
}

function CollisionBody({ nc, open, initialReport = null }: BodyProps): JSX.Element {
  const { naming, preset, base, resolver, state } = nc
  const view = useContext(NumogramViewContext)
  const limit = collisionScanLimit()
  const rootRef = useRef<HTMLDivElement>(null)
  // Bumped by every new job and every cleanup: only the job of the current generation may report (T-07-11b).
  const genRef = useRef(0)
  const ncRef = useRef(nc)
  const lastGroups = useRef<number | null>(initialReport === null ? null : initialReport.groups)
  const focusBack = useRef<FocusReturn | null>(null)

  const [shown, setShown] = useState<ShownReport | null>(() => (initialReport === null ? null : { naming, report: initialReport }))
  const [checking, setChecking] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [pages, setPages] = useState(1)
  const [editing, setEditing] = useState<number | null>(null)
  const [hint, setHint] = useState<number | null>(null)
  const [focusTick, setFocusTick] = useState(0)

  useEffect(() => {
    ncRef.current = nc
  })

  // One job per naming while the panel is open. The cleanup cancels the running job, so a newer naming, a base switch or the panel
  // collapsing never lets an older answer through. "Checking..." shows only when the answer takes longer than the grace period.
  useEffect(() => {
    if (!open) return
    const gen = ++genRef.current
    // the cleanup retires this generation through a helper: a counter is meant to be read at cleanup time, not copied at setup time
    const retire = (): void => {
      genRef.current++
    }
    setEditing(null)
    setHint(null)
    if (collisionPlan(naming, preset, limit) === 'skip') {
      lastGroups.current = null
      setChecking(false)
      setShown({ naming, report: null })
      return retire
    }
    const grace = window.setTimeout(() => {
      if (genRef.current === gen) setChecking(true)
    }, PENDING_GRACE_MS)
    const run = runSlicedJob(
      createCollisionJob(naming, preset),
      { schedule: browserSchedule, now: () => performance.now(), sliceMs: COLLISION_SLICE_MS },
      report => {
        if (genRef.current !== gen) return
        window.clearTimeout(grace)
        setChecking(false)
        setShown({ naming, report })
        const said = collisionAnnouncement(lastGroups.current, report.groups)
        lastGroups.current = report.groups
        if (said !== null) ncRef.current.announce(said)
      },
    )
    return () => {
      retire()
      run.cancel()
      window.clearTimeout(grace)
    }
  }, [naming, preset, base, open, limit])

  // Leaving the preview state clears its hint.
  useEffect(() => {
    if (state !== 'preview') setHint(null)
  }, [state])

  // A freshly opened editor is scrolled into the panel's scroller (instant) and never moves anything else.
  useEffect(() => {
    if (editing === null) return
    rootRef.current?.querySelector('[data-demon-name-editor]')?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [editing])

  // After an editor closed, focus returns to its jump button, once the answer for the naming it left behind is in.
  useEffect(() => {
    const back = focusBack.current
    if (back === null || editing !== null) return
    if (shown === null || shown.naming !== naming) return
    focusBack.current = null
    focusAfterEditor(rootRef.current, back)
  }, [focusTick, editing, shown, naming])

  function onToggle(): void {
    if (expanded) setEditing(null)
    setHint(null)
    setExpanded(value => !value)
  }

  function onJump(mesh: number): void {
    const outcome = jumpOutcome(ncRef.current.state)
    if (outcome === 'hint') {
      setEditing(null)
      setHint(mesh)
      ncRef.current.announce(NAMES_COPY.previewJump)
    } else if (outcome === 'edit') {
      setHint(null)
      setEditing(mesh)
    }
  }

  function onEditorDone(mesh: number): void {
    const line = shown === null || shown.report === null ? undefined : shown.report.list.find(group => group.meshes.includes(mesh))
    setEditing(null)
    focusBack.current = { mesh, name: line === undefined ? null : line.name }
    setFocusTick(tick => tick + 1)
  }

  const zoneLabel = (zone: number): string => (view !== null ? view.zoneLabel(zone) : formatZoneLabel(zone, base, DEFAULT_LABEL_SCHEME))

  return (
    <CollisionReportView
      phase={phaseOf(shown, checking)}
      limit={limit}
      report={shown === null ? null : shown.report}
      expanded={expanded}
      pages={pages}
      editing={editing}
      hint={state === 'preview' ? hint : null}
      zoneLabel={zoneLabel}
      nameOf={(a, b) => resolver.nameOf(a, b)}
      rootRef={rootRef}
      onToggle={onToggle}
      onMore={() => setPages(value => value + 1)}
      onJump={onJump}
      onEditorDone={onEditorDone}
    />
  )
}

/**
 * Block 9 of the Names panel. Renders nothing outside a NamingContext, and only in the two states that have a naming to check (ready
 * and preview; a seed-only naming has no table and a building base has no naming yet).
 */
export function CollisionReport({ open, initialReport }: CollisionReportProps): JSX.Element | null {
  const nc = useNaming()
  if (nc === null || (nc.state !== 'ready' && nc.state !== 'preview')) return null
  return <CollisionBody nc={nc} open={open} initialReport={initialReport} />
}

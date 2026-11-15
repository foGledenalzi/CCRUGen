// The editable, virtualized zone list of the Names panel (Phase 7, plan 19; D-02, D-07, NAM-01, 07-UI-SPEC "Zone List", T-07-03f,
// T-07-02d, T-07-17e): one fixed-height row per zone with its sound field and lock toggle, inside the panel's single scroller, so it
// works at the interactive ceiling with a few dozen rows mounted. A sound commits on Enter or blur and locks its zone (the engine
// does that), an invalid draft stays with a red underline and one list message, a paste of two or more tokens fills the rows below
// all or nothing, one Tab stop with arrow, page and Ctrl+Home/End keys, a Go to zone field, a scroll to the pinned zone once per pin
// and to the changed row after an undo. Every decision is a pure function of app/lib/zoneListModel.ts; this file is the wiring.
// Typed and pasted text is only ever a React text node or an input value. Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useContext, useEffect, useId, useRef, useState } from 'react'
import * as virtual from '@tanstack/react-virtual'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../lib/labelScheme'
import { NAMES_COPY, lockAria, noZone, pasteRefused, pasted, pastedPartial, zoneAria, zoneIssue } from '../../lib/namingCopy'
import { SOUND_FIELD_MAX_INPUT, ZONE_LIST_OVERSCAN, ZONE_ROW_HEIGHT_PX } from '../../lib/namingLimits'
import {
  EMPTY_LIST_STATE,
  GOTO_MAX_LENGTH,
  ZONE_FOCUS_RETRY_FRAMES,
  ZONE_HEADER_HEIGHT_PX,
  hasRowEdit,
  listMessageOf,
  nextRowIndex,
  pinScrollTarget,
  planPaste,
  refuseRow,
  resolveGoTo,
  restoredScrollTarget,
  settleRow,
  settleRows,
  soundCommitOf,
  splitPaste,
  tabStopZone,
  typeInto,
  withFocusedRow,
  withNote,
  type ListState,
} from '../../lib/zoneListModel'
import { LockIcon } from '../numogram/NumogramIcons'
import { NumogramViewContext } from '../numogram/ViewContext'
import { useNaming, type NamingContextValue } from './NamingContext'

// ----- shared look (Typography: 8px eyebrows, 10px body, 14px fields; the accent row token is the Phase 5 selected row) -----

const EYEBROW = 'block text-[8px] uppercase tracking-[0.3em] text-gray-400'
const HELPER = 'text-[10px] leading-[1.4] text-gray-400'
const LIST_ARIA_LABEL = 'Zone sounds'
const LABEL_WIDTH_PX = 32
const LOCK_SIZE_PX = 24
const ROW_GAP_PX = 4
const ACCENT_ROW = { background: 'rgba(16,255,80,0.08)', boxShadow: 'inset 0 -1px 0 rgba(16,255,80,0.4)' } as const
const LOCK_ON_COLOR = '#10ff50'
const LOCK_OFF_COLOR = '#6b7280'
const HEADER_BACKGROUND = 'rgba(8,8,15,0.97)'

// ----- measuring -----

/**
 * A ref for an element and its height in whole pixels, kept current by a ResizeObserver (read once at mount where there is none).
 * The panel measures the controls above the list with it, and the list measures its own go to block.
 */
export function useObservedHeight<T extends HTMLElement>(): readonly [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    const read = (): void => setHeight(Math.round(el.getBoundingClientRect().height))
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, height]
}

// ----- one row (presentational) -----

export type RowControl = 'sound' | 'lock'

/** What a row calls back: the zone is always the row's own. */
export interface ZoneRowHandlers {
  onFocus(zone: number): void
  onChange(zone: number, text: string): void
  onKeyDown(e: React.KeyboardEvent<HTMLElement>, zone: number, control: RowControl): void
  onBlur(zone: number): void
  onPaste(e: React.ClipboardEvent<HTMLInputElement>, zone: number): void
  onLock(zone: number): void
}

export interface ZoneRowViewProps {
  readonly zone: number
  /** The number of zones: the size of the set the row is a position in. */
  readonly base: number
  /** The zone as every other panel shows it. */
  readonly label: string
  /** What the field shows: the draft while one exists, else the stored sound. */
  readonly value: string
  readonly locked: boolean
  readonly pinned: boolean
  readonly invalid: boolean
  /** The id of the list message while this row's refusal is what it says. */
  readonly describedBy: string | undefined
  readonly readOnly: boolean
  /** True for the one row whose controls are in the Tab order. */
  readonly tabStop: boolean
  /** Offset (px) from the top of the rows area. */
  readonly top: number
  readonly handlers: ZoneRowHandlers
}

/** The markup of one row: label, sound field, lock. It has no state: the list owns the drafts, the focus and the actions. */
export function ZoneRowView(props: ZoneRowViewProps): JSX.Element {
  const { zone, base, label, value, locked, pinned, invalid, describedBy, readOnly, tabStop, top, handlers: h } = props
  const tabIndex = tabStop ? 0 : -1
  const fieldClass = invalid
    ? 'ui-terminal-field ui-terminal-field--quiet ui-terminal-field--invalid min-w-0 flex-1'
    : 'ui-terminal-field ui-terminal-field--quiet min-w-0 flex-1'
  return (
    <div
      role="listitem"
      data-names-row={zone}
      data-locked={locked ? 'true' : 'false'}
      data-pinned={pinned ? 'true' : undefined}
      aria-posinset={zone + 1}
      aria-setsize={base}
      className={pinned ? 'flex items-center' : 'flex items-center hover:bg-white/[0.03]'}
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: '100%',
        height: ZONE_ROW_HEIGHT_PX,
        columnGap: ROW_GAP_PX,
        ...(pinned ? ACCENT_ROW : {}),
      }}
    >
      <span className="shrink-0 truncate text-[10px] text-gray-400" style={{ width: LABEL_WIDTH_PX }}>
        {label}
      </span>
      <span className={fieldClass}>
        <input
          data-names-sound={zone}
          aria-label={zoneAria(label)}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={invalid ? describedBy : undefined}
          dir="auto"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          maxLength={SOUND_FIELD_MAX_INPUT}
          readOnly={readOnly}
          tabIndex={tabIndex}
          value={value}
          className="ui-terminal-input w-full px-0 py-0.5 text-[14px] leading-5 text-gray-100"
          onFocus={() => h.onFocus(zone)}
          onChange={e => h.onChange(zone, e.target.value)}
          onKeyDown={e => h.onKeyDown(e, zone, 'sound')}
          onBlur={() => h.onBlur(zone)}
          onPaste={e => h.onPaste(e, zone)}
        />
      </span>
      <button
        type="button"
        data-names-lock={zone}
        aria-pressed={locked}
        aria-label={lockAria(label)}
        title={NAMES_COPY.lockTitle}
        disabled={readOnly}
        tabIndex={tabIndex}
        className="flex h-6 w-6 min-h-[24px] min-w-[24px] shrink-0 items-center justify-center focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-[#10ff50]"
        style={locked ? ACCENT_ROW : undefined}
        onFocus={() => h.onFocus(zone)}
        onKeyDown={e => h.onKeyDown(e, zone, 'lock')}
        onClick={() => h.onLock(zone)}
      >
        <LockIcon clr={locked ? LOCK_ON_COLOR : LOCK_OFF_COLOR} locked={locked} />
      </button>
    </div>
  )
}

// ----- the list -----

export interface ZoneListProps {
  /** The panel's one scroller: the list is windowed against it, never against a scroll region of its own. */
  readonly scrollEl: () => HTMLElement | null
  /** The measured height of the controls above the list (an estimate until the list measures its own top). */
  readonly scrollMargin: number
  /** The pinned zone of the diagram, or null. */
  readonly pinnedZone: number | null
}

interface BodyProps extends ZoneListProps {
  readonly nc: NamingContextValue
  readonly sounds: readonly string[]
}

/**
 * The zone list for the working naming. Renders nothing without a naming provider, for a naming with no table (a seed-only base) and
 * in any state but ready (editable) and preview (read only); the pending line of the panel stands in for it while a base builds.
 */
export function ZoneList(props: ZoneListProps): JSX.Element | null {
  const nc = useNaming()
  if (nc === null || nc.naming.sounds === null) return null
  if (nc.state !== 'ready' && nc.state !== 'preview') return null
  return <ZoneListBody {...props} nc={nc} sounds={nc.naming.sounds} />
}

function ZoneListBody({ nc, sounds, scrollEl, scrollMargin, pinnedZone }: BodyProps): JSX.Element {
  const base = nc.base
  const locks = nc.naming.locks
  const view = useContext(NumogramViewContext)
  // A view of another base (a switch in flight) is never asked for this base's zones.
  const zoneLabel = (zone: number): string =>
    view !== null && view.base === base ? view.zoneLabel(zone) : formatZoneLabel(zone, base, DEFAULT_LABEL_SCHEME)
  const editable = nc.state === 'ready'
  const messageId = `${useId()}-message`

  const listRef = useRef<HTMLDivElement>(null)
  const [topRef, topHeight] = useObservedHeight<HTMLDivElement>()
  const [measured, setMeasured] = useState<number | null>(null)
  const [active, setActive] = useState(0)
  const [gotoText, setGotoText] = useState('')

  // The list state is read synchronously by the handlers (an Enter and the blur that follows it must not both commit one draft), so
  // every change goes through `update`, which keeps the ref and the rendered state in step.
  const [state, setState] = useState<ListState>(EMPTY_LIST_STATE)
  const stateRef = useRef(state)
  function update(next: ListState): void {
    stateRef.current = next
    setState(next)
  }

  // The row with a focused control (null while focus is outside the list). It is rendered whatever the scroll does (WR-06): a focused
  // field that scrolling unmounted would drop the focus to the page, where the global shortcuts are live, and leave its draft behind.
  const [focusedZone, setFocusedZone] = useState<number | null>(null)

  // The margin the windowing rule needs: where the first row sits in the scroller's content. The list measures it from the layout
  // (exact, whatever gaps and wrapped lines the controls above have); the controls height only stands in until the first measure.
  // The rows are the window's own plus the focused one (rows position themselves, so a gap in the range renders correctly).
  const virtualizer = virtual.useVirtualizer({
    count: base,
    getScrollElement: scrollEl,
    estimateSize: () => ZONE_ROW_HEIGHT_PX,
    overscan: ZONE_LIST_OVERSCAN,
    rangeExtractor: range => withFocusedRow(virtual.defaultRangeExtractor(range), focusedZone, range.count),
    scrollMargin: (measured ?? scrollMargin) + ZONE_HEADER_HEIGHT_PX,
    scrollPaddingStart: ZONE_HEADER_HEIGHT_PX,
  })
  const rowsOffset = (measured ?? scrollMargin) + ZONE_HEADER_HEIGHT_PX

  // Re-measured when the controls above change height (the panel's observer) and when this list's own top block does.
  useEffect(() => {
    const scroller = scrollEl()
    const list = listRef.current
    if (scroller === null || list === null) return
    const top = list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    setMeasured(Math.round(top))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollMargin, topHeight])

  // ----- scrolling and focus (instant, never animated) -----
  const frameRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  // The row a keyboard move is still travelling to (its focus waits for the row to be rendered), so a second key pressed before the
  // first has landed (key repeat) continues from where the first is going instead of from the row that still has focus.
  const pendingZone = useRef<number | null>(null)

  // A row outside the rendered window is scrolled in first; the control is then focused as soon as the row exists.
  function focusRow(zone: number, control: RowControl, tries = 0): void {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-names-${control}="${zone}"]`) ?? null
    if (el !== null) {
      frameRef.current = null
      pendingZone.current = null
      el.focus({ preventScroll: true })
      return
    }
    if (tries >= ZONE_FOCUS_RETRY_FRAMES) {
      pendingZone.current = null
      return
    }
    frameRef.current = requestAnimationFrame(() => focusRow(zone, control, tries + 1))
  }

  function moveTo(zone: number, control: RowControl): void {
    pendingZone.current = zone
    setActive(zone)
    virtualizer.scrollToIndex(zone, { align: 'auto' })
    focusRow(zone, control)
  }

  // A pinned zone is scrolled to the middle once per pin, after the first measure so the margin is right; focus never moves.
  const scrolledPin = useRef<number | null>(null)
  useEffect(() => {
    if (pinnedZone === null) {
      scrolledPin.current = null
      return
    }
    if (measured === null) return
    const target = pinScrollTarget(pinnedZone, scrolledPin.current, base)
    if (target === null) return
    scrolledPin.current = target
    virtualizer.scrollToIndex(target, { align: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedZone, measured, base])

  // An undo or redo that changed one row scrolls it into view without moving focus; a restore this list has seen is not scrolled again.
  const seenTick = useRef(nc.restored.tick)
  useEffect(() => {
    const target = restoredScrollTarget(nc.restored, seenTick.current)
    seenTick.current = nc.restored.tick
    if (target !== null) virtualizer.scrollToIndex(target, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nc.restored.tick])

  // ----- committing, reverting, pasting, locking -----

  /** Enter and blur. True when the row is fine to leave (nothing typed, or the draft was applied or was no change); false for an invalid draft, which stays. */
  function commitRow(zone: number): boolean {
    const decision = soundCommitOf(stateRef.current.drafts.get(zone), sounds[zone] as string)
    switch (decision.kind) {
      case 'none':
        return true
      case 'invalid': {
        update(refuseRow(stateRef.current, zone, decision.reason))
        nc.announce(zoneIssue(zoneLabel(zone), decision.reason))
        return false
      }
      case 'unchanged':
        update(settleRow(stateRef.current, zone))
        return true
      case 'commit':
        update(settleRow(stateRef.current, zone))
        nc.apply({ type: 'sound', zone, sound: decision.text })
        return true
    }
  }

  /** Escape: the field goes back to the stored sound and the message clears. True when there was something to undo. */
  function revertRow(zone: number): boolean {
    const s = stateRef.current
    if (!hasRowEdit(s, zone) && s.note === null) return false
    update(settleRow(s, zone))
    return true
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, zone: number): void {
    if (!editable) return
    const tokens = splitPaste(e.clipboardData.getData('text'))
    // one token is the same as typing: the browser pastes it into the field (cut at the field's own limit) and the commit validates it
    if (tokens.length < 2) return
    e.preventDefault()
    const plan = planPaste(tokens, zone, base)
    if (!plan.ok) {
      const text = pasteRefused(zoneLabel(plan.zone), plan.reason)
      update(withNote(stateRef.current, text))
      nc.announce(text)
      return
    }
    update(settleRows(stateRef.current, zone, plan.used))
    if (!nc.apply({ type: 'paste', zone, sounds: plan.sounds })) return
    nc.announce(
      plan.unused === 0
        ? pasted(tokens.length, zoneLabel(zone))
        : pastedPartial(tokens.length, plan.used, zoneLabel(zone), plan.unused),
    )
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>, zone: number, control: RowControl): void {
    const native = e.nativeEvent
    // an input method composing text owns Enter, Escape and the arrows
    if (native.isComposing || native.keyCode === 229) return
    if (control === 'sound') {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitRow(zone)
        return
      }
      if (e.key === 'Escape') {
        if (revertRow(zone)) {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }
    }
    // Shift and Alt keep their text meaning; Ctrl and Cmd are only for Home and End (plain Home and End move the caret)
    if (e.altKey || e.shiftKey) return
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key !== 'Home' && e.key !== 'End') return
    const from = pendingZone.current ?? zone
    const target = nextRowIndex(from, e.key, ctrl, base)
    if (target === null) return
    e.preventDefault()
    // a valid draft is committed first; an invalid one keeps focus and its message
    if (!commitRow(zone)) return
    if (target !== from) moveTo(target, control)
  }

  const handlers: ZoneRowHandlers = {
    onFocus: zone => {
      setActive(zone)
      setFocusedZone(zone)
    },
    onChange: (zone, text) => update(typeInto(stateRef.current, zone, text, sounds[zone] as string)),
    onKeyDown,
    onBlur: zone => {
      commitRow(zone)
    },
    onPaste,
    onLock: zone => {
      if (editable) nc.apply({ type: 'lock', zone })
    },
  }

  // Focus leaving every control of the list ends the focused row (after the row's own blur has committed its draft: that handler runs
  // first, then this one bubbles); focus moving to another control of the list is that control's own onFocus.
  function onListBlur(e: React.FocusEvent<HTMLElement>): void {
    const next = e.relatedTarget
    if (next instanceof Node && listRef.current?.contains(next)) return
    setFocusedZone(null)
  }

  // ----- Go to zone -----

  function onGotoChange(text: string): void {
    setGotoText(text)
    update(withNote(stateRef.current, null))
  }

  function onGotoKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
    if (e.key !== 'Enter') return
    e.preventDefault()
    const zone = resolveGoTo(gotoText, base, zoneLabel)
    if (zone === null) {
      const text = noZone(gotoText.trim(), base)
      update(withNote(stateRef.current, text))
      nc.announce(text)
      return
    }
    update(withNote(stateRef.current, null))
    setActive(zone)
    // the row goes to the top of the scroller, just below the sticky header, and its field takes focus
    virtualizer.scrollToIndex(zone, { align: 'start' })
    focusRow(zone, 'sound')
  }

  // ----- render -----

  const items = virtualizer.getVirtualItems()
  const stop = tabStopZone(
    active,
    items.map(item => item.index),
  )
  const message = listMessageOf(state.note, state.messageZone, state.problems, zoneLabel)

  return (
    <div data-names-zones="" className="space-y-1">
      <div ref={topRef} className="space-y-1">
        <div>
          <span aria-hidden="true" className={EYEBROW}>
            {NAMES_COPY.gotoAria}
          </span>
          <span className="ui-terminal-field ui-terminal-field--quiet">
            <input
              data-names-goto=""
              aria-label={NAMES_COPY.gotoAria}
              placeholder={NAMES_COPY.gotoPlaceholder}
              maxLength={GOTO_MAX_LENGTH}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={gotoText}
              className="ui-terminal-input w-full px-0 py-1 text-[14px] text-gray-100"
              onChange={e => onGotoChange(e.target.value)}
              onKeyDown={onGotoKeyDown}
            />
          </span>
        </div>
        <p className={HELPER}>{NAMES_COPY.listHelperLock}</p>
        <p className={HELPER}>{NAMES_COPY.listHelperPaste}</p>
        <p id={messageId} data-names-list-message="" className="text-[10px] leading-[1.4] text-[#f87171]">
          {message}
        </p>
      </div>
      <div ref={listRef} role="list" aria-label={LIST_ARIA_LABEL} data-names-list="" onBlur={onListBlur}>
        <div
          aria-hidden="true"
          data-names-list-header=""
          className="sticky top-0 z-[1] flex items-center text-[8px] uppercase tracking-[0.12em] text-gray-400"
          style={{ height: ZONE_HEADER_HEIGHT_PX, columnGap: ROW_GAP_PX, background: HEADER_BACKGROUND }}
        >
          <span className="shrink-0" style={{ width: LABEL_WIDTH_PX }}>
            {NAMES_COPY.zoneHeader}
          </span>
          <span className="min-w-0 flex-1">{NAMES_COPY.soundHeader}</span>
          <span className="shrink-0 whitespace-nowrap text-center" style={{ width: LOCK_SIZE_PX }}>
            {NAMES_COPY.lockHeader}
          </span>
        </div>
        <div data-names-rows="" style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {items.map(item => {
            const zone = item.index
            const invalid = state.problems.has(zone)
            return (
              <ZoneRowView
                key={item.key}
                zone={zone}
                base={base}
                label={zoneLabel(zone)}
                value={state.drafts.get(zone) ?? (sounds[zone] as string)}
                locked={locks.has(zone)}
                pinned={zone === pinnedZone}
                invalid={invalid}
                describedBy={invalid && state.note === null ? messageId : undefined}
                readOnly={!editable}
                tabStop={zone === stop}
                top={item.start - rowsOffset}
                handlers={handlers}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

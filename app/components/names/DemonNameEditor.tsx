'use client'

// The demon name editor (Phase 7, plan 07-16; 07-UI-SPEC "The demon name editor", D-02, NAM-02, T-07-03e, T-07-17b, T-07-10c).
// One component with one contract, mounted in DemonInfo (the Selection detail and the Demons overlay detail) and, in plan 07-20,
// inline in the collision list. It reads the NamingContext (a null context renders nothing), shows where the name comes from
// (generated, CCRU name, overridden), offers Rename demon and, only for an overridden demon, a reset, edits the name in a validated
// field, is disabled while the naming is a preview or a base is building, and is not offered above the interactive ceiling.
// Everything the visitor types stays a React text node or an input value. Original CCRUG code (MIT, NOTICE section 1).
import React, { useContext, useEffect, useId, useRef, useState } from 'react'
import { NAME_MAX_LENGTH, meshOf, toNfc, validateName, type NameState } from '../../../engine/index'
import { netSpanLabel } from '../../lib/demonBrowser'
import { DEFAULT_LABEL_SCHEME, formatZoneLabel } from '../../lib/labelScheme'
import { NAMES_COPY, backTo, demonIssue, nameFieldAria, renamed, renamingUnavailable } from '../../lib/namingCopy'
import type { NamesPanelState } from '../../lib/namingSession'
import { NumogramViewContext, type NumogramViewContextValue } from '../numogram/ViewContext'
import { CyberButton } from '../ui/CyberButton'
import { useNaming, type NamingContextValue } from './NamingContext'

// ----- shared classes (Typography: 8px eyebrow, 10px body; Spacing: 24px targets, 4px between the buttons) -----

const LABEL = 'text-[8px] uppercase tracking-[0.3em] text-gray-400'
const TAG = 'text-[10px] text-gray-400'
const HELPER = 'text-[10px] leading-[1.4] text-gray-400'
const BUTTON_ROW = 'flex flex-wrap gap-1'
const TARGET = 'min-h-[24px]'

/**
 * [default] Code units the name field accepts, so an absurd paste is cut before validation names the real problem. A name is at most
 * NAME_MAX_LENGTH user-perceived characters and one character can take several code units (a base letter with its marks), so the cap
 * leaves room for NAME_FIELD_UNITS_PER_CHARACTER units each.
 */
const NAME_FIELD_UNITS_PER_CHARACTER = 8
const NAME_FIELD_MAX_INPUT = NAME_MAX_LENGTH * NAME_FIELD_UNITS_PER_CHARACTER

const TAGS: Readonly<Record<NameState, string>> = Object.freeze({
  generated: NAMES_COPY.tagGenerated,
  preset: NAMES_COPY.tagCcru,
  overridden: NAMES_COPY.tagOverridden,
})

// ----- pure helpers (exported for the tests; no DOM) -----

/** Where the editor is mounted: the Selection detail, the Demons overlay detail, or inline in the collision list. */
export type EditorContext = 'selection' | 'overlay' | 'collision'

/** What the editor offers: nothing above the ceiling, a disabled copy while a preview or a base switch holds the naming, else everything. */
export type EditorAvailability = 'unavailable' | 'locked' | 'open'

/**
 * Above the interactive ceiling an override could be neither saved nor exported (D-11), so renaming is not offered; the seed-only
 * state is that ceiling by the base alone. In `preview` (an unsaved link) and `pending` (a worker switch is building the naming) the
 * buttons stay but are disabled, so nothing is lost silently (T-07-17b).
 */
export function editorAvailability(state: NamesPanelState, base: number, interactiveMaxN: number): EditorAvailability {
  if (base > interactiveMaxN || state === 'seed-only') return 'unavailable'
  if (state === 'preview' || state === 'pending') return 'locked'
  return 'open'
}

/** An open edit: the demon it was opened on (its mesh number), the draft text and the refusal shown under the field, if any. */
export interface EditState {
  readonly mesh: number
  readonly draft: string
  readonly message: string | null
}

/** The edit, only while it targets the displayed demon: an edit never writes to a demon other than the one it was opened on. */
export function activeEdit(edit: EditState | null, mesh: number): EditState | null {
  return edit !== null && edit.mesh === mesh ? edit : null
}

/** What saving a draft does: a refusal with the sentence for under the field, or the validated text. */
export type CommitResult =
  | { readonly ok: true; readonly text: string; readonly unchanged: boolean }
  | { readonly ok: false; readonly message: string }

/**
 * The draft against the name rules (letters and marks of any script, no spaces or digits, 1 to NAME_MAX_LENGTH characters, NFC). A
 * refusal carries the sentence `{netSpan}: {reason}`; an accepted draft carries the trimmed NFC text and whether it equals the name
 * the demon shows now (nothing to save then). The engine checks the same rules again when the override is applied (T-07-03e).
 */
export function commitName(draft: string, current: string, netSpan: string): CommitResult {
  const check = validateName(draft)
  if (!check.ok) return { ok: false, message: demonIssue(netSpan, check.reason) }
  return { ok: true, text: check.text, unchanged: check.text === toNfc(current) }
}

/** The key a field of the editor acts on: Enter in the text field saves, Escape anywhere cancels; nothing during an IME composition. */
export type EditKeyAction = 'save' | 'cancel' | null

export function editKeyAction(key: string, composing: boolean, onInput: boolean): EditKeyAction {
  if (composing) return null
  if (key === 'Escape') return 'cancel'
  if (key === 'Enter' && onInput) return 'save'
  return null
}

/** The label of the reset button: none unless the demon is overridden, the CCRU label when a preset name stands under the override. */
export function resetLabelOf(state: NameState, presetName: string | null): string | null {
  if (state !== 'overridden') return null
  return presetName !== null ? NAMES_COPY.resetCcru : NAMES_COPY.resetGenerated
}

// ----- presentation -----

export interface DemonNameEditorViewProps {
  readonly context: EditorContext
  readonly nameState: NameState
  readonly mode: 'read' | 'edit' | 'unavailable'
  /** Preview or pending: the buttons of the read mode are disabled and the root says so. */
  readonly locked: boolean
  readonly tag: string
  /** The reset button's label, or null for no reset button. */
  readonly resetLabel: string | null
  readonly fieldAria: string
  readonly draft: string
  readonly message: string | null
  readonly messageId: string
  readonly rootRef?: React.Ref<HTMLDivElement>
  readonly inputRef?: React.Ref<HTMLInputElement>
  readonly onRename: () => void
  readonly onReset: () => void
  readonly onSave: () => void
  readonly onCancel: () => void
  readonly onDraft: (text: string) => void
  readonly onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

/** The markup of the editor in each mode, with no state of its own (the container below owns the draft, the focus and the actions). */
export function DemonNameEditorView(props: DemonNameEditorViewProps): JSX.Element {
  const { context, nameState, mode, locked, tag, resetLabel, fieldAria, draft, message, messageId } = props
  const invalid = message !== null
  return (
    <div
      ref={props.rootRef}
      data-post-baseline=""
      data-demon-name-editor=""
      data-demon-name-context={context}
      data-demon-name-state={nameState}
      aria-disabled={mode === 'read' && locked ? 'true' : undefined}
      onKeyDown={mode === 'edit' ? props.onKeyDown : undefined}
      className="space-y-1 pt-1"
    >
      {mode === 'unavailable' && <p className={HELPER}>{renamingUnavailable()}</p>}

      {mode === 'read' && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={LABEL}>{NAMES_COPY.editorLabel}</span>
            <span className={TAG}>{tag}</span>
          </div>
          <div className={BUTTON_ROW}>
            <CyberButton size="sm" className={TARGET} disabled={locked} onClick={props.onRename} dataAttrs={{ 'data-demon-rename': '' }}>
              {NAMES_COPY.rename}
            </CyberButton>
            {resetLabel !== null && (
              <CyberButton size="sm" className={TARGET} disabled={locked} onClick={props.onReset} dataAttrs={{ 'data-demon-name-reset': '' }}>
                {resetLabel}
              </CyberButton>
            )}
          </div>
        </>
      )}

      {mode === 'edit' && (
        <div>
          <span className={`ui-terminal-field block w-full${invalid ? ' ui-terminal-field--invalid' : ''}`}>
            <input
              ref={props.inputRef}
              data-demon-name-input=""
              aria-label={fieldAria}
              aria-invalid={invalid ? 'true' : undefined}
              aria-describedby={invalid ? messageId : undefined}
              dir="auto"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              maxLength={NAME_FIELD_MAX_INPUT}
              value={draft}
              onChange={e => props.onDraft(e.target.value)}
              className="ui-terminal-input w-full px-0 py-1 text-sm text-gray-100"
            />
          </span>
          {invalid && (
            <p id={messageId} data-demon-name-message="" className="mt-1 text-[10px] leading-[1.4] text-[#f87171]">
              {message}
            </p>
          )}
          <div className={`mt-1 ${BUTTON_ROW}`}>
            <CyberButton size="sm" className={TARGET} onClick={props.onSave} dataAttrs={{ 'data-demon-name-save': '' }}>
              {NAMES_COPY.saveName}
            </CyberButton>
            <CyberButton size="sm" className={TARGET} onClick={props.onCancel} dataAttrs={{ 'data-demon-name-cancel': '' }}>
              {NAMES_COPY.cancelRename}
            </CyberButton>
          </div>
        </div>
      )}
    </div>
  )
}

// ----- the component -----

export interface DemonNameEditorProps {
  /** The two zones of the demon, in either order. */
  readonly a: number
  readonly b: number
  readonly context: EditorContext
  /** Open in edit mode (the collision list opens the editor from its jump button). */
  readonly autoEdit?: boolean
  /** Told when an edit opens (true) and closes (false), so the Demons overlay can keep its detail pane on the demon being edited. */
  readonly onEditingChange?: (editing: boolean) => void
  /** Called after a save, a cancel or an Escape, so the owner can close an inline mount and move focus. */
  readonly onDone?: () => void
}

interface BodyProps extends DemonNameEditorProps {
  readonly naming: NamingContextValue
  readonly view: NumogramViewContextValue | null
}

function EditorBody({ a, b, context, autoEdit = false, onEditingChange, onDone, naming, view }: BodyProps): JSX.Element {
  const { base, resolver } = naming
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  const mesh = meshOf(a, b)
  const name = resolver.nameOf(a, b)
  const nameState = resolver.stateOf(a, b)
  const zoneLabel = (zone: number): string => (view !== null ? view.zoneLabel(zone) : formatZoneLabel(zone, base, DEFAULT_LABEL_SCHEME))
  const netSpan = netSpanLabel(hi, lo, zoneLabel)
  const availability = editorAvailability(naming.state, base, naming.interactiveMaxN)
  const ids = useId()
  const messageId = `${ids}-message`

  const [edit, setEdit] = useState<EditState | null>(() => (autoEdit ? { mesh, draft: name, message: null } : null))
  // An edit shows only while the editor is open for it and still on the demon it was opened on.
  const active = availability === 'open' ? activeEdit(edit, mesh) : null

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const changeRef = useRef(onEditingChange)
  const editingRef = useRef(false)
  const focusedFor = useRef<number | null>(null)
  const refocusRename = useRef(false)
  useEffect(() => {
    changeRef.current = onEditingChange
    editingRef.current = active !== null
  })

  // An editor that mounts open tells its owner; one that unmounts while open (a base switch, the overlay closing) tells it too, so the
  // owner never stays bound to a demon nobody is editing.
  useEffect(() => {
    if (autoEdit && availability === 'open') changeRef.current?.(true)
    return () => {
      if (editingRef.current) changeRef.current?.(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // An edit that stopped being showable (the naming became a preview, a base is building, or another demon is pinned) closes.
  useEffect(() => {
    if (edit !== null && active === null) {
      setEdit(null)
      changeRef.current?.(false)
    }
  }, [edit, active])

  // Entering edit mode puts the caret in the field with the whole name selected; leaving it (save, cancel, reset) returns focus to Rename.
  useEffect(() => {
    if (active === null) {
      focusedFor.current = null
      if (refocusRename.current) {
        refocusRename.current = false
        focusRename()
      }
      return
    }
    if (focusedFor.current === active.mesh) return
    focusedFor.current = active.mesh
    inputRef.current?.focus()
    inputRef.current?.select()
  })

  function focusRename(): void {
    rootRef.current?.querySelector<HTMLElement>('[data-demon-rename]')?.focus()
  }

  function open(): void {
    if (availability !== 'open') return
    setEdit({ mesh, draft: name, message: null })
    onEditingChange?.(true)
  }

  function close(): void {
    setEdit(null)
    refocusRename.current = context !== 'collision'
    onEditingChange?.(false)
    onDone?.()
  }

  function save(): void {
    if (active === null) return
    const result = commitName(active.draft, name, netSpan)
    if (!result.ok) {
      setEdit({ ...active, message: result.message })
      naming.announce(result.message)
      return
    }
    if (!result.unchanged && naming.apply({ type: 'override', mesh: active.mesh, name: result.text })) {
      naming.announce(renamed(zoneLabel(hi), zoneLabel(lo), result.text))
    }
    close()
  }

  function reset(): void {
    if (availability !== 'open') return
    // what the demon is called once its override is gone: the preset's name where one applies, else the rule's
    const after = resolver.presetNameOf(a, b) ?? resolver.ruleNameOf(a, b, naming.naming.smoothing)
    if (naming.apply({ type: 'reset-override', mesh })) naming.announce(backTo(zoneLabel(hi), zoneLabel(lo), after))
    // the reset button is about to unmount, so focus moves to the Rename button that stays
    focusRename()
  }

  function onDraft(text: string): void {
    if (active === null) return
    // a refusal already on show follows the draft, so it clears the moment the draft is fixed
    let message = active.message
    if (message !== null) {
      const again = commitName(text, name, netSpan)
      message = again.ok ? null : again.message
    }
    setEdit({ ...active, draft: text, message })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const composing = e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229
    const action = editKeyAction(e.key, composing, (e.target as HTMLElement).tagName === 'INPUT')
    if (action === null) return
    e.preventDefault()
    e.stopPropagation()
    if (action === 'save') save()
    else close()
  }

  return (
    <DemonNameEditorView
      context={context}
      nameState={nameState}
      mode={availability === 'unavailable' ? 'unavailable' : active !== null ? 'edit' : 'read'}
      locked={availability === 'locked'}
      tag={TAGS[nameState]}
      resetLabel={resetLabelOf(nameState, resolver.presetNameOf(a, b))}
      fieldAria={nameFieldAria(zoneLabel(hi), zoneLabel(lo))}
      draft={active !== null ? active.draft : ''}
      message={active !== null ? active.message : null}
      messageId={messageId}
      rootRef={rootRef}
      inputRef={inputRef}
      onRename={open}
      onReset={reset}
      onSave={save}
      onCancel={close}
      onDraft={onDraft}
      onKeyDown={onKeyDown}
    />
  )
}

/**
 * The demon name editor for the demon on zones a and b. Renders nothing outside a NamingContext provider (a render with no naming
 * shows the names it always showed), and nothing while the naming is for another base than the displayed one (a switch in flight;
 * asking a resolver for a zone outside its base raises a RangeError).
 */
export function DemonNameEditor(props: DemonNameEditorProps): JSX.Element | null {
  const naming = useNaming()
  const view = useContext(NumogramViewContext)
  if (naming === null) return null
  if (view !== null && view.base !== naming.base) return null
  return <EditorBody {...props} naming={naming} view={view} />
}

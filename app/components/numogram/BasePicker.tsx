// Header base picker (UI-01, D-01..D-07): the collapsed control's editable numeral is the most prominent element,
// with the live summary built in (D-02); the expanded dropdown holds the stepper/slider/chips, the packer toggle
// (todo 005) and the label-scheme controls (UI-03). Every root this component ever renders (the collapsed control,
// the portal dropdown) carries data-post-baseline so the frozen behaviour baseline ignores this new chrome. Not
// mounted anywhere yet — 04-12 wires it into the header. Original CCRUG code (MIT, NOTICE section 1).
'use client'

import React, { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Packer } from '../../../engine/index'
import {
  BASE_DEBOUNCE_MS,
  BASE_STEP,
  NOTABLE_BASES,
  SLIDER_MAX,
  SLIDER_MIN,
  evaluateCandidate,
  sliderPosition,
  stepBase,
  summaryLine,
  typeCountsLine,
} from '../../lib/basePicker'
import type { LabelScheme } from '../../lib/labelScheme'
import type { NumogramSummary } from '../../lib/numogramView'
import { CyberButton } from '../ui/CyberButton'
import { CyberRadio } from '../ui/CyberRadio'
import { LabelSchemeControls } from './LabelSchemeControls'

export interface BasePickerProps {
  base: number
  summary: NumogramSummary
  externalRefusal: string | null
  onCommitBase(base: number): void
  labelScheme: LabelScheme
  onLabelSchemeChange(scheme: LabelScheme): void
  packer: Packer
  onPackerChange(packer: Packer): void
  packerVisible: boolean
}

export function BasePicker(props: BasePickerProps): JSX.Element {
  const {
    base,
    summary,
    externalRefusal,
    onCommitBase,
    labelScheme,
    onLabelSchemeChange,
    packer,
    onPackerChange,
    packerVisible,
  } = props

  const [candidate, setCandidate] = useState(() => String(base))
  const [dirty, setDirty] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(() => externalRefusal)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const summaryId = useId()

  // Re-sync the visible text to the committed base whenever it changes elsewhere (URL nav, undo/redo, ...), but
  // never while the visitor is mid-edit (D-04: their keystrokes are never clobbered by an external update).
  React.useEffect(() => {
    if (!dirty) setCandidate(String(base))
  }, [base, dirty])

  // The 200 ms live-preview debounce (D-04): every keystroke/drag tick updates `candidate` immediately, but the
  // pure validator only runs — and only then commits — after the visitor pauses.
  React.useEffect(() => {
    if (!dirty) return undefined
    const id = window.setTimeout(() => evaluateNow(candidate), BASE_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, dirty])

  function evaluateNow(text: string): void {
    const result = evaluateCandidate(text, base)
    if (result.kind === 'ok') {
      setRefusal(null)
      setDirty(false)
      if (result.base !== base) onCommitBase(result.base)
    } else if (result.kind === 'refused') {
      setRefusal(result.message)
    }
  }

  /** Steppers and chips (D-05, D-07): commit immediately, no debounce wait. */
  function commitNow(n: number): void {
    setCandidate(String(n))
    setRefusal(null)
    setDirty(false)
    if (n !== base) onCommitBase(n)
  }

  function openDropdown(): void {
    const rect = rootRef.current?.getBoundingClientRect()
    if (rect) setPos({ left: rect.left, top: rect.bottom + 4 })
    setOpen(true)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setCandidate(e.target.value)
    setDirty(true)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') evaluateNow(candidate)
  }

  /** Escape anywhere in the expanded control (input, slider, chips, label controls) closes it (D-06). */
  function handleContainerKeyDown(e: React.KeyboardEvent): void {
    if (e.key !== 'Escape') return
    setOpen(false)
    setCandidate(String(base))
    setRefusal(null)
    setDirty(false)
  }

  /** Closes on focus leaving both the collapsed control and the portal dropdown. */
  function handleContainerBlur(e: React.FocusEvent): void {
    const next = e.relatedTarget as Node | null
    if (next && (rootRef.current?.contains(next) || dropdownRef.current?.contains(next))) return
    setOpen(false)
  }

  React.useEffect(() => {
    if (!open) return undefined
    function handleOutsideMouseDown(e: MouseEvent): void {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideMouseDown)
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown)
  }, [open])

  const dropdown =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={dropdownRef}
            data-post-baseline=""
            className="fixed z-[120] w-[340px] space-y-2 p-2 font-mono"
            style={{
              left: pos.left,
              top: pos.top,
              border: '1px solid rgba(16,255,80,0.35)',
              background: 'rgba(8,8,15,0.96)',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="Decrease base by 2"
                className="flex h-6 w-6 items-center justify-center border border-white/10 text-gray-300 hover:bg-white/[0.05]"
                onClick={() => commitNow(stepBase(base, -1))}
              >
                −
              </button>
              <output aria-live="polite" className="text-base font-semibold leading-none text-gray-100">
                {candidate}
              </output>
              <button
                type="button"
                aria-label="Increase base by 2"
                className="flex h-6 w-6 items-center justify-center border border-white/10 text-gray-300 hover:bg-white/[0.05]"
                onClick={() => commitNow(stepBase(base, 1))}
              >
                +
              </button>
            </div>

            <input
              type="range"
              aria-label="Base slider"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={BASE_STEP}
              value={sliderPosition(Number(candidate) || base)}
              className="w-full"
              style={{ accentColor: '#10ff50', height: 24 }}
              onChange={e => {
                setCandidate(e.target.value)
                setDirty(true)
              }}
            />

            <div className="flex gap-1 overflow-x-auto">
              {NOTABLE_BASES.map(b => (
                <CyberButton key={b} size="sm" active={b === base} onClick={() => commitNow(b)}>
                  {b}
                </CyberButton>
              ))}
            </div>

            <div className="text-[10px] text-gray-400">{typeCountsLine(summary)}</div>

            {packerVisible && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] uppercase tracking-[0.3em] text-gray-400">Layout:</span>
                <CyberRadio
                  name="ccrug-packer"
                  label="Spiral"
                  checked={packer === 'spiral'}
                  onChange={() => onPackerChange('spiral')}
                />
                <CyberRadio
                  name="ccrug-packer"
                  label="Shelf"
                  checked={packer === 'shelf'}
                  onChange={() => onPackerChange('shelf')}
                />
              </div>
            )}

            <LabelSchemeControls base={base} scheme={labelScheme} onChange={onLabelSchemeChange} />

            {refusal && (
              <p role="status" className="text-[10px] text-[#f87171]">
                {refusal}
              </p>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div onKeyDown={handleContainerKeyDown} onBlur={handleContainerBlur}>
      <div
        ref={rootRef}
        data-post-baseline=""
        className="relative flex min-w-0 items-center gap-2 px-2 py-1"
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,8,15,0.94)' }}
      >
        <input
          aria-label="Base"
          aria-describedby={summaryId}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          className="w-[5ch] min-h-[24px] bg-transparent text-base font-semibold leading-none text-gray-100 outline-none"
          style={{ caretColor: '#10ff50' }}
          value={candidate}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={openDropdown}
          onClick={openDropdown}
        />
        {refusal ? (
          <span id={summaryId} role="status" className="truncate text-[10px] text-[#f87171]">
            {refusal}
          </span>
        ) : (
          <span id={summaryId} className="truncate text-[10px] text-gray-400">
            {summaryLine(summary)}
          </span>
        )}
      </div>
      {dropdown}
    </div>
  )
}

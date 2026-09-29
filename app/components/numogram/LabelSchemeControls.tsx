// Zone label scheme controls (UI-03, D-08..D-12): Digits (the default)/Xeno/Custom radios, curated preset chips and
// a free-text alphabet with inline validation and glyph-coverage warnings, all as-you-type (D-12) — an invalid typed
// alphabet is never applied. Lives inside BasePicker.tsx's expanded dropdown. Original CCRUG code (MIT, NOTICE
// section 1).
'use client'

import React, { useMemo, useState } from 'react'
import { evaluateCustomAlphabet } from '../../lib/basePicker'
import { ALPHABET_PRESET_IDS, ALPHABET_PRESET_LABELS, presetChars, validateAlphabet } from '../../lib/customAlphabet'
import { createCanvasGlyphCanvas, glyphRisks, makeGlyphProbe } from '../../lib/glyphCoverage'
import { DEFAULT_LABEL_SCHEME, type LabelScheme } from '../../lib/labelScheme'
import { CyberButton } from '../ui/CyberButton'
import { CyberInput } from '../ui/CyberInput'
import { CyberRadio } from '../ui/CyberRadio'

export interface LabelSchemeControlsProps {
  base: number
  scheme: LabelScheme
  onChange(s: LabelScheme): void
}

/** The first N glyph-risk warnings shown at once — a hostile 1000+ character alphabet never floods the disclosure. */
const MAX_GLYPH_WARNINGS = 5

export function LabelSchemeControls({ base, scheme, onChange }: LabelSchemeControlsProps): JSX.Element {
  const [open, setOpen] = useState(() => scheme.mode === 'preset' || scheme.mode === 'custom')
  const [text, setText] = useState(() => (scheme.mode === 'custom' ? scheme.chars.join('') : ''))

  const probe = useMemo(
    () => makeGlyphProbe(typeof document === 'undefined' ? null : createCanvasGlyphCanvas(document)),
    [],
  )

  const customChecked = scheme.mode === 'preset' || scheme.mode === 'custom' || open
  const digitsChecked = !customChecked && scheme.mode === 'digits'
  const xenoChecked = !customChecked && scheme.mode === 'xeno'

  function selectDigits(): void {
    setOpen(false)
    onChange(DEFAULT_LABEL_SCHEME)
  }

  function selectXeno(): void {
    setOpen(false)
    onChange({ mode: 'xeno' })
  }

  function selectCustom(): void {
    setOpen(true)
  }

  function handleCustomTextChange(next: string): void {
    setText(next)
    const { chars, check } = evaluateCustomAlphabet(next, base)
    if (check.ok) onChange({ mode: 'custom', chars })
  }

  const { chars, check } = evaluateCustomAlphabet(text, base)
  const glyphWarnings = glyphRisks(chars, probe).slice(0, MAX_GLYPH_WARNINGS)

  let activePresetMessage: string | null = null
  if (scheme.mode === 'preset') {
    const presetCheck = validateAlphabet(presetChars(scheme.preset), base)
    if (!presetCheck.ok) activePresetMessage = presetCheck.message
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[8px] uppercase tracking-[0.3em] text-gray-400">Labels:</span>
        <CyberRadio name="ccrug-labels" label="Digits" checked={digitsChecked} onChange={selectDigits} />
        <CyberRadio name="ccrug-labels" label="Xeno" checked={xenoChecked} onChange={selectXeno} />
        <CyberRadio name="ccrug-labels" label="Custom" checked={customChecked} onChange={selectCustom} />
      </div>

      {customChecked && (
        <div className="mt-1 space-y-1 border-t border-white/[0.04] pt-1">
          <div className="flex gap-1 overflow-x-auto">
            {ALPHABET_PRESET_IDS.map(id => (
              <CyberButton
                key={id}
                size="sm"
                active={scheme.mode === 'preset' && scheme.preset === id}
                onClick={() => onChange({ mode: 'preset', preset: id })}
              >
                {ALPHABET_PRESET_LABELS[id]}
              </CyberButton>
            ))}
          </div>

          <CyberInput label="Custom characters" value={text} onChange={handleCustomTextChange} />

          {text === '' && scheme.mode !== 'preset' && scheme.mode !== 'custom' && (
            <>
              <p className="text-[10px] text-gray-300">No custom alphabet set</p>
              <p className="text-[10px] text-gray-400">
                Choose a preset above, or type your own characters below — you&apos;ll need at least {base} for the
                current base.
              </p>
            </>
          )}

          {text !== '' && !check.ok && <p className="text-[10px] text-[#f87171]">{check.message}</p>}

          {activePresetMessage && <p className="text-[10px] text-[#f87171]">{activePresetMessage}</p>}

          {glyphWarnings.map(ch => (
            <p key={ch} className="text-[10px] text-[#f87171]">
              &apos;{ch}&apos; may not render in your browser — try a different character.
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

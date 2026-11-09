'use client'

import React from 'react'

type CyberRadioProps = {
  checked: boolean
  label: string
  onChange: () => void
  name?: string
  disabled?: boolean
  /** Names-panel additions (Phase 7 plan 07-04): all default to undefined and emit nothing when absent, so every
   * existing call site renders the same DOM as before (tests/app/cyberControlsMarkup.test.ts pins this). */
  title?: string
  /** Appended to the label class only when given (a bare `${className}` would add a trailing space to every default). */
  className?: string
  /** Extra `data-*` attributes for the input; any key that does not start with `data-` is dropped (T-07-22). */
  dataAttrs?: Readonly<Record<string, string>>
}

/** Keeps only the entries whose key starts with `data-`, so a caller can never put an event handler, style or id on the element. */
function dataProps(attrs?: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {}
  if (!attrs) return out
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('data-')) out[key] = value
  }
  return out
}

export function CyberRadio({
  checked,
  label,
  onChange,
  name,
  disabled = false,
  title,
  className,
  dataAttrs,
}: CyberRadioProps) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 text-xs tracking-[0.12em] uppercase ${disabled ? 'opacity-50 cursor-not-allowed' : ''}${className ? ` ${className}` : ''}`}
      title={title}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
        {...dataProps(dataAttrs)}
      />
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border"
        style={{
          borderColor: checked ? 'rgba(16,255,80,0.7)' : 'rgba(107,114,128,0.7)',
          boxShadow: checked ? '0 0 8px rgba(16,255,80,0.3)' : 'none',
        }}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-[#10ff50]" />}
      </span>
      <span style={{ color: checked ? '#10ff50' : '#9ca3af' }}>{label}</span>
    </label>
  )
}


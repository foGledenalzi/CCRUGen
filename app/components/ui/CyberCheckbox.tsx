'use client'

import React from 'react'

type CyberCheckboxProps = {
  checked: boolean
  label: string
  onChange: () => void
  disabled?: boolean
  icon?: React.ReactNode
  accent?: string
  className?: string
  /** Extra `data-*` attributes for the input (Phase 7 plan 07-04); any key that does not start with `data-` is dropped
   * (T-07-22). Absent, it emits nothing, so every existing call site renders the same DOM as before. */
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

export function CyberCheckbox({
  checked,
  label,
  onChange,
  disabled = false,
  icon,
  accent = '#10ff50',
  className = '',
  dataAttrs,
}: CyberCheckboxProps) {
  const borderActive = checked ? accent : 'rgba(75,85,99,0.55)'
  const checkedBackground = `color-mix(in srgb, ${accent} 10%, rgba(10,14,20,0.9))`
  const textColor = checked ? accent : '#94a3b8'

  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.12em] ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={{
        border: `1px solid ${borderActive}`,
        background: checked ? checkedBackground : 'rgba(10,14,20,0.5)',
        clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)',
        transition: 'all 0.15s ease',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
        {...dataProps(dataAttrs)}
      />
      {icon && (
        <span
          className="inline-flex min-w-[16px] items-center justify-center text-[11px]"
          style={{ color: textColor }}
        >
          {icon}
        </span>
      )}
      <span style={{ color: textColor }}>{label}</span>
      <span
        className="ml-auto h-1.5 w-1.5 rounded-full"
        style={{
          border: `1px solid ${checked ? accent : '#4b5563'}`,
          background: checked ? accent : 'transparent',
          boxShadow: checked ? `0 0 6px ${accent}aa` : 'none',
        }}
      />
    </label>
  )
}

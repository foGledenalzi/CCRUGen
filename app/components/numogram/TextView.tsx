// The accessible text view (UI-07, D-14's fallback): a read-only monospace block with one copy button. Reused by
// BigBaseSummary and (04-11) mounted alongside the rich SVG diagram at every base. Original CCRUG code (MIT, NOTICE
// section 1).
'use client'

import React, { useState } from 'react'

export function TextView({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable: ignore, as the header share button does.
    }
  }

  return (
    <div data-post-baseline="" className="space-y-1.5 font-mono">
      <button
        type="button"
        className="px-1.5 py-1 text-[10px] uppercase tracking-[0.15em]"
        style={{
          color: copied ? '#10ff50' : '#6b7280',
          border: `1px solid ${copied ? 'rgba(16,255,80,0.35)' : 'rgba(107,114,128,0.35)'}`,
          background: copied ? 'rgba(16,255,80,0.08)' : 'rgba(107,114,128,0.06)',
          minHeight: 24,
        }}
        onClick={onCopy}
      >
        {copied ? 'Copied' : 'Copy numogram text'}
      </button>
      <pre
        tabIndex={0}
        aria-label="Numogram text"
        className="ui-terminal-input max-h-[52vh] overflow-auto whitespace-pre-wrap p-2 text-[10px] leading-relaxed text-gray-300"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {text}
      </pre>
    </div>
  )
}

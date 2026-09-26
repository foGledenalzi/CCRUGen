'use client'

import React from 'react'

type GlitchTextProps = {
  text: string
  color?: string
  className?: string
}

export function GlitchText({ text, color = '#10ff50', className = '' }: GlitchTextProps) {
  return (
    <span
      className={`font-bold uppercase tracking-[0.12em] text-xs ${className}`}
      style={{
        color,
        textShadow: `0 0 8px ${color}66, 0 0 20px ${color}22`,
      }}
    >
      {text}
    </span>
  )
}

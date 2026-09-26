'use client'

import React from 'react'

interface SectionFrameProps {
  title?: string
  color?: string
  children: React.ReactNode
}

export function SectionFrame({ title, color = '#10ff50', children }: SectionFrameProps) {
  return (
    <div className="pl-2 py-1">
      {title && (
        <div className="text-[7px] tracking-[0.2em] uppercase mb-1" style={{ color: `${color}88` }}>{title}</div>
      )}
      {children}
    </div>
  )
}

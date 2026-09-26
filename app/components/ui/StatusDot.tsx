'use client'

import React from 'react'

interface StatusDotProps {
  color: string
  className?: string
}

export function StatusDot({ color, className = '' }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-[5px] h-[5px] rounded-full flex-shrink-0 ${className}`}
      style={{ background: color }}
    />
  )
}

'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { HomeLink } from './HomeLink'

type CyberPageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  icon?: string
  className?: string
  titleHref?: string
  homeHref?: string
  homeLabel?: string
  showHomeLink?: boolean
  actions?: ReactNode
}

export function CyberPageHeader({
  title,
  description,
  icon,
  className = '',
  titleHref,
  homeHref = '/',
  homeLabel = 'Home',
  showHomeLink = true,
  actions,
}: CyberPageHeaderProps) {
  return (
    <header className={`flex items-stretch gap-2 ${className}`}>
      {showHomeLink && (
        <div
          className="flex shrink-0 items-center px-1.5"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(8,8,15,0.94)',
          }}
        >
          <HomeLink href={homeHref} label={homeLabel} boxed={false} />
        </div>
      )}
      {/*
        The brand block never collapses: min-w-[88px] is the logo (16) + gap (8) + the tracked "CCRUG" wordmark (about 37) + padding
        (20) + border (2) with a little room. Before this the block was min-w-0, so a long actions row squeezed it to 22 px, the logo
        shrank to nothing and the wordmark was clipped to "CC" behind the base picker. The description is the part that gives way.
      */}
      <div
        className="min-w-[88px] flex-1 px-2.5 py-1.5"
        style={{
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(8,8,15,0.94)',
        }}
      >
        {titleHref ? (
          <Link href={titleHref} className="flex items-center gap-2 min-w-0">
            {icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" className="w-4 h-4 shrink-0" />
            )}
            <span
              className="text-[9px] tracking-[0.28em] uppercase whitespace-nowrap"
              style={{ color: '#10ff50' }}
            >
              {title}
            </span>
            {description && (
              <span className="text-[9px] tracking-[0.06em] text-gray-500 truncate hidden sm:inline">
                {description}
              </span>
            )}
          </Link>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" className="w-4 h-4 shrink-0" />
            )}
            <span
              className="text-[9px] tracking-[0.28em] uppercase whitespace-nowrap"
              style={{ color: '#10ff50' }}
            >
              {title}
            </span>
            {description && (
              <span className="text-[9px] tracking-[0.06em] text-gray-500 truncate hidden sm:inline">
                {description}
              </span>
            )}
          </div>
        )}
      </div>
      {actions && (
        // min-w-0, not shrink-0: the actions row gives way (the base picker truncates its summary) instead of pushing past the header.
        <div
          className="flex min-w-0 items-center px-1.5"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(8,8,15,0.94)',
          }}
        >
          {actions}
        </div>
      )}
    </header>
  )
}

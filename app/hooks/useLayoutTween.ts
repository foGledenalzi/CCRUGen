// Base-generic layout tween (D-09): the same 600 ms easeInOutCubic interpolation useTween applied to the base-10
// tables, now for any LayoutTarget, plus frame width. animate = false (tier table forbids it, or reduced motion)
// makes every switch instant. Never interpolates between two bases (UI-08).
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Pos } from '../data/types'
import { TWEEN_DURATION } from '../lib/constants'
import { easeInOutCubic } from '../lib/easing'
import type { LayoutTarget } from '../lib/viewLayouts'
import { tweenPositions } from '../lib/viewLayouts'

export interface LayoutTween {
  readonly pos: Record<number, Pos>
  readonly ctr: Pos
  readonly svgWidth: number
  readonly svgHeight: number
  readonly tweening: boolean
  switchLayout(): void
  jumpToTarget(): void
}

/**
 * A base-generic version of useTween (D-09): interpolates a LayoutTarget's position record, centre, width and
 * height over TWEEN_DURATION ms with the same easing. `animate = false` (the tier table forbids tweening at this
 * base, or the user prefers reduced motion, wired in 04-11) makes `switchLayout()` behave like `jumpToTarget()`.
 * Never interpolates across two bases: a base change (`fromBaseRef.current !== target.base`) is always a hard jump,
 * since a tween spanning two bases would index zones that do not exist in one of them (T-04-26).
 */
export function useLayoutTween(target: LayoutTarget, animate: boolean): LayoutTween {
  const [tweenProgress, setTweenProgress] = useState(1)
  const [tweenId, setTweenId] = useState(0)

  const fromPosRef = useRef<Record<number, Pos>>(target.pos)
  const fromCtrRef = useRef<Pos>(target.ctr)
  const fromWidthRef = useRef(target.width)
  const fromHeightRef = useRef(target.height)
  const fromBaseRef = useRef(target.base)

  const currentPosRef = useRef<Record<number, Pos>>(target.pos)
  const currentCtrRef = useRef<Pos>(target.ctr)
  const currentWidthRef = useRef(target.width)
  const currentHeightRef = useRef(target.height)

  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (tweenId === 0) return
    const startTime = performance.now()
    const step = () => {
      const elapsed = performance.now() - startTime
      const t = Math.min(1, elapsed / TWEEN_DURATION)
      setTweenProgress(t)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [tweenId])

  const jumpedOrDone = tweenProgress >= 1 || fromBaseRef.current !== target.base

  const pos = useMemo(() => {
    if (jumpedOrDone) return target.pos
    return tweenPositions(fromPosRef.current, target.pos, target.base, easeInOutCubic(tweenProgress))
  }, [jumpedOrDone, target.pos, target.base, tweenProgress])

  const ctr = useMemo(() => {
    if (jumpedOrDone) return target.ctr
    const e = easeInOutCubic(tweenProgress)
    return {
      x: fromCtrRef.current.x + (target.ctr.x - fromCtrRef.current.x) * e,
      y: fromCtrRef.current.y + (target.ctr.y - fromCtrRef.current.y) * e,
    }
  }, [jumpedOrDone, target.ctr, tweenProgress])

  const svgWidth = jumpedOrDone
    ? target.width
    : fromWidthRef.current + (target.width - fromWidthRef.current) * easeInOutCubic(tweenProgress)

  const svgHeight = jumpedOrDone
    ? target.height
    : fromHeightRef.current + (target.height - fromHeightRef.current) * easeInOutCubic(tweenProgress)

  // Track the currently displayed state so switchLayout can capture it as the next tween's start.
  currentPosRef.current = pos
  currentCtrRef.current = ctr
  currentWidthRef.current = svgWidth
  currentHeightRef.current = svgHeight

  const jumpToTarget = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setTweenProgress(1)
  }, [])

  const switchLayout = useCallback(() => {
    if (!animate) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setTweenProgress(1)
      return
    }
    fromPosRef.current = { ...currentPosRef.current }
    fromCtrRef.current = { ...currentCtrRef.current }
    fromWidthRef.current = currentWidthRef.current
    fromHeightRef.current = currentHeightRef.current
    fromBaseRef.current = target.base
    setTweenProgress(0)
    setTweenId(id => id + 1)
  }, [animate, target.base])

  return { pos, ctr, svgWidth, svgHeight, tweening: tweenProgress < 1, switchLayout, jumpToTarget }
}

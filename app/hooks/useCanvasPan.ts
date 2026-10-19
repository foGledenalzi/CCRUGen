import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'

/**
 * `active` is true while the element behind `wrapRef` is mounted. The wheel listener binds to the element that exists when
 * the effect runs, so a caller whose wrapper unmounts and mounts anew (the SVG tier, replaced by the Canvas or headless tier
 * and back) passes its own "the wrapper is rendered" flag: flipping it rebinds the listener to the new element (Phase 6
 * review WR-03). The default keeps every other caller exactly as before.
 */
export function useCanvasZoom(wrapRef: RefObject<HTMLDivElement | null>, active = true) {
  const [zoom, setZoom] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 })
  const wheelGestureActiveRef = useRef(false)
  const wheelGestureTimerRef = useRef<number | null>(null)
  const clamp = useCallback((v: number, min: number, max: number) => Math.min(max, Math.max(min, v)), [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!active || !wrap) return

    const normalizeDeltaY = (e: WheelEvent): number => {
      // deltaMode: 0=pixel, 1=line, 2=page
      if (e.deltaMode === 1) return e.deltaY * 16
      if (e.deltaMode === 2) return e.deltaY * 120
      return e.deltaY
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      if (!wheelGestureActiveRef.current) {
        const rect = wrap.getBoundingClientRect()
        const ox = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100)
        const oy = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100)
        setZoomOrigin({ x: ox, y: oy })
        wheelGestureActiveRef.current = true
      }

      if (wheelGestureTimerRef.current !== null) {
        window.clearTimeout(wheelGestureTimerRef.current)
      }
      wheelGestureTimerRef.current = window.setTimeout(() => {
        wheelGestureActiveRef.current = false
        wheelGestureTimerRef.current = null
      }, 120)

      const deltaPx = normalizeDeltaY(e)
      const step = clamp(deltaPx, -100, 100)
      const factor = Math.exp(-step * 0.0015)
      setZoom(prev => clamp(prev * factor, 0.3, 5))
    }

    wrap.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      wrap.removeEventListener('wheel', handleWheel)
      if (wheelGestureTimerRef.current !== null) {
        window.clearTimeout(wheelGestureTimerRef.current)
        wheelGestureTimerRef.current = null
        // the timer that would have ended the gesture is gone: a rebind must not inherit a gesture that never ends
        wheelGestureActiveRef.current = false
      }
    }
  }, [wrapRef, clamp, active])

  const setZoomValue = useCallback((nextZoom: number) => {
    setZoom(clamp(nextZoom, 0.3, 5))
  }, [clamp])

  const setZoomOriginValue = useCallback((origin: { x: number; y: number }) => {
    setZoomOrigin({
      x: clamp(origin.x, 0, 100),
      y: clamp(origin.y, 0, 100),
    })
  }, [clamp])

  return { zoom, zoomOrigin, setZoom: setZoomValue, setZoomOrigin: setZoomOriginValue }
}

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { STACK_PANEL_IDS, type StackPanelId } from '../lib/panelStack'
import {
  activate,
  displayedPositions,
  dragEnd,
  dragMove,
  dragStart,
  initialDragState,
  type DragState,
  type Point,
} from '../lib/panelDrag'

function isStackPanelId(panel: string): panel is StackPanelId {
  return (STACK_PANEL_IDS as readonly string[]).includes(panel)
}

/**
 * Panel drag, stacking order and canvas pan. All panel logic lives in the pure reducers of app/lib/panelDrag.ts (this hook has no
 * jsdom test); the hook holds one DragState and the displayed positions follow `derived`, the live desktop stack from
 * app/lib/panelStack.ts (null until the panels have measured themselves, and on mobile, where the stored positions apply).
 */
export function usePanelDrag(derived: Readonly<Partial<Record<StackPanelId, Point>>> | null) {
  const [state, setState] = useState<DragState>(initialDragState)
  const positions = useMemo(() => displayedPositions(state, derived), [state, derived])
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 })
  // True between a header mouse down and the next mouse up, so a window mouse move with no drag costs no state update.
  const panelDragActiveRef = useRef(false)
  const canvasDragRef = useRef<{
    startX: number; startY: number; origX: number; origY: number
  } | null>(null)

  // Drag handler for panels + canvas
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (canvasDragRef.current) {
        const { startX, startY, origX, origY } = canvasDragRef.current
        setCanvasPan({ x: origX + (e.clientX - startX), y: origY + (e.clientY - startY) })
        return
      }
      if (!panelDragActiveRef.current) return
      setState(s => dragMove(s, e.clientX, e.clientY))
    }
    const handleMouseUp = () => {
      if (panelDragActiveRef.current) {
        panelDragActiveRef.current = false
        setState(dragEnd)
      }
      canvasDragRef.current = null
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // The drag is seeded from the DISPLAYED position: for a panel on the derived stack the stored position is not where it is drawn.
  const startDrag = useCallback((panel: string, e: React.MouseEvent) => {
    if (!isStackPanelId(panel)) return
    const { clientX, clientY } = e
    const seed = positions[panel]
    panelDragActiveRef.current = true
    setState(s => dragStart(s, panel, clientX, clientY, seed))
  }, [positions])

  const startCanvasDrag = useCallback((e: React.MouseEvent) => {
    canvasDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: canvasPan.x,
      origY: canvasPan.y,
    }
  }, [canvasPan])

  const activatePanel = useCallback((panel: string) => {
    if (!isStackPanelId(panel)) return
    setState(s => activate(s, panel))
  }, [])

  const setCanvasPanValue = useCallback((next: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    setCanvasPan(prev => typeof next === 'function' ? (next as (p: { x: number; y: number }) => { x: number; y: number })(prev) : next)
  }, [])

  return {
    positions,
    zIndexes: state.z,
    activatePanel,
    startDrag,
    canvasPan,
    setCanvasPan: setCanvasPanValue,
    startCanvasDrag,
  }
}

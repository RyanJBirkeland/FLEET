/**
 * useDrawerResize — drag-to-resize hook for right-anchored drawer panels.
 * Returns current width and a handleResizeStart handler for the resize handle.
 * Dragging left increases width (right-anchored convention).
 */
import { useState, useRef, useCallback, useEffect } from 'react'

interface UseDrawerResizeConfig {
  defaultWidth: number
  minWidth: number
  maxWidth: number
}

interface UseDrawerResizeResult {
  width: number
  handleResizeStart: (e: React.MouseEvent) => void
}

export function useDrawerResize({
  defaultWidth,
  minWidth,
  maxWidth
}: UseDrawerResizeConfig): UseDrawerResizeResult {
  const [width, setWidth] = useState(defaultWidth)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(defaultWidth)
  const widthRef = useRef(defaultWidth)
  widthRef.current = width
  // Must be a ref (not state/effect dep) to avoid stale closure on mid-drag unmount
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = widthRef.current
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: MouseEvent): void => {
        if (!dragging.current) return
        // Right-anchored drawers: dragging left (lower clientX) increases width
        const delta = startX.current - ev.clientX
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta))
        setWidth(next)
      }

      const onUp = (): void => {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        cleanupRef.current = null
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)

      cleanupRef.current = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    },
    [minWidth, maxWidth]
  )

  return { width, handleResizeStart }
}

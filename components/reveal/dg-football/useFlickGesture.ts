"use client"

/**
 * useFlickGesture — a single Pointer Events based drag system (no separate
 * mouse/touch code paths). Tracks an upward flick and reports the drag offset
 * via requestAnimationFrame for smooth, layout-thrash-free updates.
 *
 * The hook is presentation-only: it never decides the game result. It simply
 * reports how far the user dragged and fires onRelease so the parent can run
 * the (predetermined) launch animation.
 */

import { useCallback, useEffect, useRef, useState } from "react"

export interface FlickOffset {
  x: number
  y: number
}

interface UseFlickOptions {
  /** Whether dragging is currently permitted. */
  enabled: boolean
  /** Upward distance (px) required for a release to count as a launch. */
  threshold: number
  /** Horizontal movement is damped by this factor (0..1). */
  horizontalDamp?: number
  /** Called on pointer up. `launched` is true when the upward drag passed the
   *  threshold. `offset` is the final offset at release. */
  onRelease: (info: { launched: boolean; offset: FlickOffset }) => void
  /** Called once when a drag actually begins (first move past a few px). */
  onDragStart?: () => void
}

export interface FlickApi {
  /** Attach to the draggable element. */
  bind: {
    onPointerDown: (e: React.PointerEvent) => void
    style: React.CSSProperties
  }
  /** Current live offset (px). y is negative when dragging up. */
  offset: FlickOffset
  dragging: boolean
  /** How far up the user has dragged, clamped at 0 (px, positive number). */
  upDistance: number
  /** Reset the offset back to zero. */
  reset: () => void
}

export function useFlickGesture(options: UseFlickOptions): FlickApi {
  const { enabled, threshold, horizontalDamp = 0.4, onRelease, onDragStart } = options

  const [offset, setOffset] = useState<FlickOffset>({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const startRef = useRef<{ x: number; y: number } | null>(null)
  const latestRef = useRef<FlickOffset>({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const startedRef = useRef(false)
  const activePointerRef = useRef<number | null>(null)

  // Keep latest callbacks without resubscribing pointer handlers.
  const onReleaseRef = useRef(onRelease)
  const onDragStartRef = useRef(onDragStart)
  useEffect(() => {
    onReleaseRef.current = onRelease
    onDragStartRef.current = onDragStart
  })

  const flush = useCallback(() => {
    rafRef.current = null
    setOffset({ ...latestRef.current })
  }, [])

  const schedule = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  const reset = useCallback(() => {
    latestRef.current = { x: 0, y: 0 }
    startedRef.current = false
    setOffset({ x: 0, y: 0 })
    setDragging(false)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      // Only respond to the primary pointer.
      if (activePointerRef.current != null) return
      activePointerRef.current = e.pointerId
      startRef.current = { x: e.clientX, y: e.clientY }
      startedRef.current = false
      setDragging(true)
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        /* setPointerCapture can throw if the pointer is already released */
      }
    },
    [enabled],
  )

  // Global move/up listeners are attached only while a pointer is active.
  useEffect(() => {
    if (!dragging) return

    const handleMove = (e: PointerEvent) => {
      if (activePointerRef.current !== e.pointerId) return
      const start = startRef.current
      if (!start) return
      const rawX = e.clientX - start.x
      const rawY = e.clientY - start.y
      latestRef.current = { x: rawX * horizontalDamp, y: rawY }
      if (!startedRef.current && Math.hypot(rawX, rawY) > 4) {
        startedRef.current = true
        onDragStartRef.current?.()
      }
      schedule()
    }

    const finish = (e: PointerEvent) => {
      if (activePointerRef.current !== e.pointerId) return
      activePointerRef.current = null
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const finalOffset = { ...latestRef.current }
      const up = Math.max(0, -finalOffset.y)
      setDragging(false)
      startRef.current = null
      onReleaseRef.current({ launched: up >= threshold, offset: finalOffset })
    }

    window.addEventListener("pointermove", handleMove, { passive: false })
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
    }
  }, [dragging, horizontalDamp, schedule, threshold])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return {
    bind: {
      onPointerDown: handlePointerDown,
      style: { touchAction: "none" },
    },
    offset,
    dragging,
    upDistance: Math.max(0, -offset.y),
    reset,
  }
}

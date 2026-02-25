'use client'

import { useEffect } from 'react'

export function ScrollToTopOnMount() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual'
      }
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      } catch {
        window.scrollTo(0, 0)
      }
    }
  }, [])

  return null
}

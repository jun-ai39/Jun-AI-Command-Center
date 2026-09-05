import { useEffect, useState } from 'react'

import { fetchHealth } from '../api/health'
import type { HealthConnectionState } from '../types'

export function useHealthStatus(): HealthConnectionState {
  const [state, setState] = useState<HealthConnectionState>({
    phase: 'loading',
  })

  useEffect(() => {
    const controller = new AbortController()

    void fetchHealth({ signal: controller.signal })
      .then((health) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'online', health })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'offline' })
        }
      })

    return () => controller.abort()
  }, [])

  return state
}

import { useCallback, useEffect, useState } from 'react'

import { getLocalDateInputValue } from '../../work-reports/workReportForm'
import { fetchInspectionStatus } from '../api/inspectionStatus'
import type { InspectionStatusState } from '../types'

type InspectionStatusActions = {
  readonly targetDate: string
  readonly state: InspectionStatusState
  readonly reload: () => void
}

export function useInspectionStatus(refreshToken = 0): InspectionStatusActions {
  const targetDate = getLocalDateInputValue()
  const [state, setState] = useState<InspectionStatusState>({
    phase: 'loading',
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchInspectionStatus(targetDate, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'ready', data })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })
    return () => controller.abort()
  }, [refreshToken, reloadToken, targetDate])

  const reload = useCallback(() => {
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  return { targetDate, state, reload }
}

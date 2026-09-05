import { useCallback, useEffect, useState } from 'react'

import { fetchWorkReportAttentionSummary } from '../api/workReports'
import type { WorkReportAttentionSummaryState } from '../types'

type WorkReportAttentionSummaryActions = {
  readonly state: WorkReportAttentionSummaryState
  readonly reload: () => void
}

export function useWorkReportAttentionSummary(
  refreshToken: number,
): WorkReportAttentionSummaryActions {
  const [state, setState] = useState<WorkReportAttentionSummaryState>({
    phase: 'loading',
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchWorkReportAttentionSummary({ signal: controller.signal })
      .then((summary) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'ready', summary })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })

    return () => controller.abort()
  }, [refreshToken, reloadToken])

  const reload = useCallback(() => {
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  return { state, reload }
}

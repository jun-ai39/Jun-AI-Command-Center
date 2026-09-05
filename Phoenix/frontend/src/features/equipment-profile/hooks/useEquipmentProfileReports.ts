import { useCallback, useEffect, useState } from 'react'

import { fetchWorkReports } from '../../work-reports/api/workReports'
import type { EquipmentProfileReportsState } from '../types'

type EquipmentProfileReportsActions = {
  readonly state: EquipmentProfileReportsState
  readonly reload: () => void
}

export function useEquipmentProfileReports(
  equipmentId: string,
): EquipmentProfileReportsActions {
  const [state, setState] = useState<EquipmentProfileReportsState>({
    phase: 'loading',
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchWorkReports({
      limit: 5,
      offset: 0,
      equipmentId,
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setState({
            phase: 'ready',
            items: response.items,
            total: response.total,
          })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })

    return () => controller.abort()
  }, [equipmentId, reloadToken])

  const reload = useCallback(() => {
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  return { state, reload }
}

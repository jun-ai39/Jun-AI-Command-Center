import { useCallback, useEffect, useState } from 'react'

import {
  fetchActiveDepartments,
  fetchActiveEquipment,
} from '../../equipment-master/api/equipmentMaster'
import type { WorkReportEquipmentOptionsState } from '../types'

type WorkReportEquipmentOptionsActions = {
  readonly state: WorkReportEquipmentOptionsState
  readonly reload: () => void
}

export function useWorkReportEquipmentOptions(): WorkReportEquipmentOptionsActions {
  const [state, setState] = useState<WorkReportEquipmentOptionsState>({
    phase: 'loading',
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      fetchActiveDepartments({ signal: controller.signal }),
      fetchActiveEquipment({ signal: controller.signal }),
    ])
      .then(([departments, equipment]) => {
        if (controller.signal.aborted) {
          return
        }
        setState({
          phase: 'ready',
          departments: departments.items,
          equipment: equipment.items,
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })

    return () => controller.abort()
  }, [reloadToken])

  const reload = useCallback(() => {
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  return { state, reload }
}

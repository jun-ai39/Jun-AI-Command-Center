import { useCallback, useEffect, useState } from 'react'

import { fetchInspectionRecords } from '../../inspection-records/api/inspectionRecords'
import type { EquipmentProfileInspectionsState } from '../types'

type EquipmentProfileInspectionsActions = {
  readonly state: EquipmentProfileInspectionsState
  readonly reload: () => void
}

export function useEquipmentProfileInspections(
  equipmentId: string,
): EquipmentProfileInspectionsActions {
  const [state, setState] = useState<EquipmentProfileInspectionsState>({
    phase: 'loading',
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchInspectionRecords({
      equipmentId,
      limit: 5,
      offset: 0,
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

import { useCallback, useEffect, useState } from 'react'

import { fetchInspectionTemplateItems } from '../../inspection-templates/api/inspectionTemplates'
import type { EquipmentProfileGuidesState } from '../types'

type EquipmentProfileGuidesActions = {
  readonly state: EquipmentProfileGuidesState
  readonly reload: () => void
}

export function useEquipmentProfileGuides(
  equipmentId: string,
  refreshToken = 0,
): EquipmentProfileGuidesActions {
  const [state, setState] = useState<EquipmentProfileGuidesState>({
    phase: 'loading',
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchInspectionTemplateItems(equipmentId, {
      isActive: true,
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
  }, [equipmentId, refreshToken, reloadToken])

  const reload = useCallback(() => {
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  return { state, reload }
}

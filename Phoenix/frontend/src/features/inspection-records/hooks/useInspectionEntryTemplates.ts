import { useCallback, useEffect, useState } from 'react'

import { fetchInspectionTemplateItems } from '../../inspection-templates/api/inspectionTemplates'
import type { InspectionCycle } from '../../inspection-templates/types'
import type { InspectionEntryTemplateState } from '../types'

type InspectionEntryTemplateActions = {
  readonly state: InspectionEntryTemplateState
  readonly reload: () => void
}

export function useInspectionEntryTemplates(
  equipmentId: string,
  cycle: InspectionCycle,
  templateRefreshToken = 0,
): InspectionEntryTemplateActions {
  const [state, setState] = useState<InspectionEntryTemplateState>({
    phase: 'loading',
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchInspectionTemplateItems(equipmentId, {
      cycle,
      isActive: true,
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'ready', items: response.items })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })

    return () => controller.abort()
  }, [cycle, equipmentId, reloadToken, templateRefreshToken])

  const reload = useCallback(() => {
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  return { state, reload }
}

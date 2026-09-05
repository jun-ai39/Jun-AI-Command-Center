import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchTroubleshootingGuide,
  fetchTroubleshootingGuides,
} from '../api/troubleshooting'
import type {
  TroubleshootingGuideDetailState,
  TroubleshootingGuideListState,
} from '../types'

type EquipmentTroubleshootingActions = {
  readonly listState: TroubleshootingGuideListState
  readonly detailState: TroubleshootingGuideDetailState
  readonly reloadList: () => void
  readonly selectGuide: (guideId: string) => void
  readonly clearGuide: () => void
}

type EquipmentListResult = {
  readonly equipmentId: string
  readonly state: TroubleshootingGuideListState
}

type EquipmentDetailResult = {
  readonly equipmentId: string
  readonly state: TroubleshootingGuideDetailState
}

export function useEquipmentTroubleshooting(
  equipmentId: string,
): EquipmentTroubleshootingActions {
  const [listResult, setListResult] = useState<EquipmentListResult>({
    equipmentId,
    state: { phase: 'loading' },
  })
  const [detailResult, setDetailResult] = useState<EquipmentDetailResult>({
    equipmentId,
    state: { phase: 'idle' },
  })
  const [reloadToken, setReloadToken] = useState(0)
  const detailController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    detailController.current?.abort()
    detailController.current = null
    void fetchTroubleshootingGuides(equipmentId, {
      isActive: true,
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setListResult({
            equipmentId,
            state: {
              phase: 'ready',
              items: response.items,
              total: response.total,
            },
          })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setListResult({ equipmentId, state: { phase: 'error' } })
        }
      })

    return () => controller.abort()
  }, [equipmentId, reloadToken])

  useEffect(
    () => () => {
      detailController.current?.abort()
    },
    [],
  )

  const selectGuide = useCallback(
    (guideId: string) => {
      detailController.current?.abort()
      const controller = new AbortController()
      detailController.current = controller
      setDetailResult({
        equipmentId,
        state: { phase: 'loading', guideId },
      })
      void fetchTroubleshootingGuide(guideId, { signal: controller.signal })
        .then((guide) => {
          if (controller.signal.aborted) return
          if (guide.equipment_id !== equipmentId || !guide.is_active) {
            setDetailResult({
              equipmentId,
              state: { phase: 'error', guideId },
            })
            return
          }
          setDetailResult({
            equipmentId,
            state: { phase: 'ready', guide },
          })
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setDetailResult({
              equipmentId,
              state: { phase: 'error', guideId },
            })
          }
        })
    },
    [equipmentId],
  )

  const clearGuide = useCallback(() => {
    detailController.current?.abort()
    detailController.current = null
    setDetailResult({ equipmentId, state: { phase: 'idle' } })
  }, [equipmentId])

  const reloadList = useCallback(() => {
    clearGuide()
    setListResult({ equipmentId, state: { phase: 'loading' } })
    setReloadToken((current) => current + 1)
  }, [clearGuide, equipmentId])

  const listState: TroubleshootingGuideListState =
    listResult.equipmentId === equipmentId
      ? listResult.state
      : { phase: 'loading' }
  const detailState: TroubleshootingGuideDetailState =
    detailResult.equipmentId === equipmentId
      ? detailResult.state
      : { phase: 'idle' }

  return { listState, detailState, reloadList, selectGuide, clearGuide }
}

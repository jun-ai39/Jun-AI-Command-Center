import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchTroubleshootingGuide,
  fetchTroubleshootingGuideCatalog,
} from '../api/troubleshooting'
import type {
  TroubleshootingGuideDetailState,
  TroubleshootingGuideListState,
} from '../types'

type TroubleshootingGuideManagementActions = {
  readonly listState: TroubleshootingGuideListState
  readonly detailState: TroubleshootingGuideDetailState
  readonly reloadList: () => void
  readonly selectGuide: (guideId: string) => void
  readonly clearGuide: () => void
}

export function useTroubleshootingGuideManagement(): TroubleshootingGuideManagementActions {
  const [listState, setListState] = useState<TroubleshootingGuideListState>({
    phase: 'loading',
  })
  const [detailState, setDetailState] =
    useState<TroubleshootingGuideDetailState>({ phase: 'idle' })
  const [reloadToken, setReloadToken] = useState(0)
  const detailController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    detailController.current?.abort()
    detailController.current = null
    void fetchTroubleshootingGuideCatalog({ signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setListState({
            phase: 'ready',
            items: response.items,
            total: response.total,
          })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setListState({ phase: 'error' })
        }
      })

    return () => controller.abort()
  }, [reloadToken])

  useEffect(
    () => () => {
      detailController.current?.abort()
    },
    [],
  )

  const selectGuide = useCallback((guideId: string) => {
    detailController.current?.abort()
    const controller = new AbortController()
    detailController.current = controller
    setDetailState({ phase: 'loading', guideId })
    void fetchTroubleshootingGuide(guideId, { signal: controller.signal })
      .then((guide) => {
        if (!controller.signal.aborted) {
          setDetailState({ phase: 'ready', guide })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDetailState({ phase: 'error', guideId })
        }
      })
  }, [])

  const clearGuide = useCallback(() => {
    detailController.current?.abort()
    detailController.current = null
    setDetailState({ phase: 'idle' })
  }, [])

  const reloadList = useCallback(() => {
    clearGuide()
    setListState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [clearGuide])

  return { listState, detailState, reloadList, selectGuide, clearGuide }
}

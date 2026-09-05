import { useCallback, useEffect, useState } from 'react'

import {
  createEquipmentChangeHistory,
  EquipmentChangeHistoryApiError,
  fetchEquipmentChangeHistories,
} from '../../equipment-change-histories/api/equipmentChangeHistories'
import type {
  EquipmentChangeHistory,
  EquipmentChangeHistoryCreateInput,
  EquipmentChangeHistorySaveState,
} from '../../equipment-change-histories/types'
import type { EquipmentProfileChangeHistoriesState } from '../types'

type EquipmentProfileChangeHistoriesActions = {
  readonly state: EquipmentProfileChangeHistoriesState
  readonly saveState: EquipmentChangeHistorySaveState
  readonly reload: () => void
  readonly save: (
    input: EquipmentChangeHistoryCreateInput,
  ) => Promise<EquipmentChangeHistory | null>
  readonly resetSave: () => void
}

export function useEquipmentProfileChangeHistories(
  equipmentId: string,
): EquipmentProfileChangeHistoriesActions {
  const [state, setState] = useState<EquipmentProfileChangeHistoriesState>({
    phase: 'loading',
  })
  const [saveState, setSaveState] = useState<EquipmentChangeHistorySaveState>({
    phase: 'idle',
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchEquipmentChangeHistories({
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

  const save = useCallback(
    async (
      input: EquipmentChangeHistoryCreateInput,
    ): Promise<EquipmentChangeHistory | null> => {
      setSaveState({ phase: 'saving' })
      try {
        const history = await createEquipmentChangeHistory(input)
        setSaveState({ phase: 'saved', history })
        setState({ phase: 'loading' })
        setReloadToken((current) => current + 1)
        return history
      } catch (error) {
        setSaveState({
          phase: 'error',
          message:
            error instanceof EquipmentChangeHistoryApiError &&
            error.status === 422
              ? '設備または関連日報を確認してください。関連日報は同じ設備の日報だけを選べます。'
              : '改良・変更履歴を保存できませんでした。APIの接続状態を確認してください。',
        })
        return null
      }
    },
    [],
  )

  const resetSave = useCallback(() => {
    setSaveState({ phase: 'idle' })
  }, [])

  return { state, saveState, reload, save, resetSave }
}

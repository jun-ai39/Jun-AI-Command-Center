import { useCallback, useEffect, useState } from 'react'

import {
  createInspectionTemplateItem,
  fetchInspectionTemplateItems,
  InspectionTemplateApiError,
  updateInspectionTemplateGuide,
} from '../api/inspectionTemplates'
import type {
  InspectionTemplateCollectionState,
  InspectionTemplateCreateInput,
  InspectionTemplateGuideSaveState,
  InspectionTemplateGuideUpdateInput,
  InspectionTemplateItem,
  InspectionTemplateSaveState,
} from '../types'

type InspectionTemplateActions = {
  readonly state: InspectionTemplateCollectionState
  readonly saveState: InspectionTemplateSaveState
  readonly guideSaveState: InspectionTemplateGuideSaveState
  readonly reload: () => void
  readonly save: (
    input: InspectionTemplateCreateInput,
  ) => Promise<InspectionTemplateItem | null>
  readonly resetSave: () => void
  readonly updateGuide: (
    input: InspectionTemplateGuideUpdateInput,
  ) => Promise<InspectionTemplateItem | null>
  readonly resetGuideSave: () => void
}

const CYCLE_ORDER = { daily: 10, weekly: 20, monthly: 30 } as const
const MAX_LOADED_ITEMS = 100

function sortItems(
  items: readonly InspectionTemplateItem[],
): readonly InspectionTemplateItem[] {
  return [...items].sort(
    (left, right) =>
      CYCLE_ORDER[left.cycle] - CYCLE_ORDER[right.cycle] ||
      left.display_order - right.display_order ||
      left.name.localeCompare(right.name, 'ja'),
  )
}

export function useInspectionTemplates(
  equipmentId: string,
): InspectionTemplateActions {
  const [state, setState] = useState<InspectionTemplateCollectionState>({
    phase: 'loading',
  })
  const [saveState, setSaveState] = useState<InspectionTemplateSaveState>({
    phase: 'idle',
  })
  const [guideSaveState, setGuideSaveState] =
    useState<InspectionTemplateGuideSaveState>({ phase: 'idle' })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchInspectionTemplateItems(equipmentId, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setState({
            phase: 'ready',
            items: sortItems(response.items),
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
      input: InspectionTemplateCreateInput,
    ): Promise<InspectionTemplateItem | null> => {
      setSaveState({ phase: 'saving' })
      try {
        const item = await createInspectionTemplateItem(input)
        setState((current) => {
          if (current.phase !== 'ready') return current
          return {
            phase: 'ready',
            items: sortItems([...current.items, item]).slice(
              0,
              MAX_LOADED_ITEMS,
            ),
            total: current.total + 1,
          }
        })
        setSaveState({ phase: 'saved', item })
        return item
      } catch (error) {
        setSaveState({
          phase: 'error',
          message:
            error instanceof InspectionTemplateApiError && error.status === 409
              ? '同じ周期に同名の点検項目が登録されています。'
              : '保存できませんでした。APIの接続状態を確認してください。',
        })
        return null
      }
    },
    [],
  )

  const resetSave = useCallback(() => {
    setSaveState({ phase: 'idle' })
  }, [])

  const updateGuide = useCallback(
    async (
      input: InspectionTemplateGuideUpdateInput,
    ): Promise<InspectionTemplateItem | null> => {
      setGuideSaveState({ phase: 'saving', itemId: input.itemId })
      try {
        const item = await updateInspectionTemplateGuide(input)
        setState((current) => {
          if (current.phase !== 'ready') return current
          return {
            ...current,
            items: current.items.map((currentItem) =>
              currentItem.id === item.id ? item : currentItem,
            ),
          }
        })
        setGuideSaveState({ phase: 'saved', item })
        return item
      } catch (error) {
        setGuideSaveState({
          phase: 'error',
          itemId: input.itemId,
          message:
            error instanceof InspectionTemplateApiError && error.status === 404
              ? '対象の点検項目が見つかりません。一覧を再読み込みしてください。'
              : 'ガイドを保存できませんでした。APIの接続状態を確認してください。',
        })
        return null
      }
    },
    [],
  )

  const resetGuideSave = useCallback(() => {
    setGuideSaveState({ phase: 'idle' })
  }, [])

  return {
    state,
    saveState,
    guideSaveState,
    reload,
    save,
    resetSave,
    updateGuide,
    resetGuideSave,
  }
}

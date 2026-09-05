import { useCallback, useState } from 'react'

import {
  createTroubleshootingGuide,
  TroubleshootingApiError,
} from '../api/troubleshooting'
import type {
  TroubleshootingGuide,
  TroubleshootingGuideCreateInput,
  TroubleshootingGuideSaveState,
} from '../types'

type TroubleshootingGuideCreateActions = {
  readonly saveState: TroubleshootingGuideSaveState
  readonly saveGuide: (
    input: TroubleshootingGuideCreateInput,
  ) => Promise<TroubleshootingGuide | null>
  readonly resetSave: () => void
}

function describeSaveError(error: unknown): string {
  if (error instanceof TroubleshootingApiError && error.status === 422) {
    return '保存前検証を通過できませんでした。入力内容と分岐を確認してください。'
  }
  if (error instanceof TroubleshootingApiError && error.status === 409) {
    return 'ガイド情報が既存データと競合しました。もう一度保存してください。'
  }
  return 'ガイドを保存できませんでした。APIの接続状態を確認してください。'
}

export function useTroubleshootingGuideCreate(): TroubleshootingGuideCreateActions {
  const [saveState, setSaveState] = useState<TroubleshootingGuideSaveState>({
    phase: 'idle',
  })

  const saveGuide = useCallback(
    async (
      input: TroubleshootingGuideCreateInput,
    ): Promise<TroubleshootingGuide | null> => {
      setSaveState({ phase: 'saving' })
      try {
        const guide = await createTroubleshootingGuide(input)
        setSaveState({ phase: 'saved', guide })
        return guide
      } catch (error) {
        setSaveState({ phase: 'error', message: describeSaveError(error) })
        return null
      }
    },
    [],
  )

  const resetSave = useCallback(() => {
    setSaveState({ phase: 'idle' })
  }, [])

  return { saveState, saveGuide, resetSave }
}

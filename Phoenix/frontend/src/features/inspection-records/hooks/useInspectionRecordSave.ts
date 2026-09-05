import { useCallback, useState } from 'react'

import {
  createInspectionRecord,
  InspectionRecordApiError,
} from '../api/inspectionRecords'
import type {
  InspectionRecord,
  InspectionRecordCreateInput,
  InspectionRecordSaveState,
} from '../types'

type InspectionRecordSaveActions = {
  readonly saveState: InspectionRecordSaveState
  readonly save: (
    input: InspectionRecordCreateInput,
  ) => Promise<InspectionRecord | null>
  readonly reset: () => void
}

export function useInspectionRecordSave(): InspectionRecordSaveActions {
  const [saveState, setSaveState] = useState<InspectionRecordSaveState>({
    phase: 'idle',
  })

  const save = useCallback(
    async (
      input: InspectionRecordCreateInput,
    ): Promise<InspectionRecord | null> => {
      setSaveState({ phase: 'saving' })
      try {
        const record = await createInspectionRecord(input)
        setSaveState({ phase: 'saved', record })
        return record
      } catch (error) {
        setSaveState({
          phase: 'error',
          message:
            error instanceof InspectionRecordApiError && error.status === 409
              ? 'この設備・周期の点検記録は、対象期間にすでに保存されています。'
              : '点検記録を保存できませんでした。Phoenix APIの接続状態を確認して、もう一度保存してください。',
        })
        return null
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setSaveState({ phase: 'idle' })
  }, [])

  return { saveState, save, reset }
}

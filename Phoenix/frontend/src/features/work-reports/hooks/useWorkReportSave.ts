import { useCallback, useState } from 'react'

import { createWorkReport } from '../api/workReports'
import type {
  WorkReport,
  WorkReportConfirmation,
  WorkReportSaveState,
} from '../types'

type WorkReportSaveActions = {
  readonly saveState: WorkReportSaveState
  readonly saveWorkReport: (
    input: WorkReportConfirmation,
  ) => Promise<WorkReport | null>
  readonly resetWorkReportSave: () => void
}

export function useWorkReportSave(): WorkReportSaveActions {
  const [saveState, setSaveState] = useState<WorkReportSaveState>({
    phase: 'idle',
  })

  const saveWorkReport = useCallback(
    async (input: WorkReportConfirmation): Promise<WorkReport | null> => {
      setSaveState({ phase: 'saving' })
      try {
        const report = await createWorkReport(input)
        setSaveState({ phase: 'saved', report })
        return report
      } catch {
        setSaveState({
          phase: 'error',
          message:
            '日報を保存できませんでした。Phoenix APIの起動状態を確認して、もう一度保存してください。',
        })
        return null
      }
    },
    [],
  )

  const resetWorkReportSave = useCallback(() => {
    setSaveState({ phase: 'idle' })
  }, [])

  return { saveState, saveWorkReport, resetWorkReportSave }
}

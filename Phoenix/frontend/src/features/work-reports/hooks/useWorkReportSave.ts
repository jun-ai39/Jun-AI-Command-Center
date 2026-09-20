import { useCallback, useState } from 'react'

import { createWorkReport, WorkReportApiError } from '../api/workReports'
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
      } catch (error) {
        setSaveState({
          phase: 'error',
          message:
            error instanceof WorkReportApiError && error.status === 409
              ? 'この点検は既に日報へ引き継がれています。設備カルテを開き直し、引き継いだ日報を編集してください。'
              : input.sourceInspectionId &&
                  error instanceof WorkReportApiError &&
                  error.status === 422
                ? '元の異常点検と同じ設備を選んでください。点検記録や設備の状態も確認してください。'
                : '日報を保存できませんでした。Phoenix APIの起動状態を確認して、もう一度保存してください。',
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

import { useCallback, useState } from 'react'

import { updateWorkReport } from '../api/workReports'
import type {
  WorkReport,
  WorkReportConfirmation,
  WorkReportUpdateState,
} from '../types'

type WorkReportUpdateActions = {
  readonly updateState: WorkReportUpdateState
  readonly updateSavedWorkReport: (
    workReportId: string,
    input: WorkReportConfirmation,
  ) => Promise<WorkReport | null>
  readonly resetWorkReportUpdate: () => void
}

export function useWorkReportUpdate(): WorkReportUpdateActions {
  const [updateState, setUpdateState] = useState<WorkReportUpdateState>({
    phase: 'idle',
  })

  const updateSavedWorkReport = useCallback(
    async (
      workReportId: string,
      input: WorkReportConfirmation,
    ): Promise<WorkReport | null> => {
      setUpdateState({ phase: 'updating' })
      try {
        const report = await updateWorkReport(workReportId, input)
        setUpdateState({ phase: 'updated', report })
        return report
      } catch {
        setUpdateState({
          phase: 'error',
          message:
            '日報の変更を保存できませんでした。Phoenix APIの起動状態を確認して、もう一度保存してください。',
        })
        return null
      }
    },
    [],
  )

  const resetWorkReportUpdate = useCallback(() => {
    setUpdateState({ phase: 'idle' })
  }, [])

  return { updateState, updateSavedWorkReport, resetWorkReportUpdate }
}

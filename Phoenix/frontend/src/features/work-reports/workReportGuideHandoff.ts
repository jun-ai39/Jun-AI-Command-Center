import type { WorkReportFormValues, WorkReportGuideHandoffInput } from './types'
import {
  createDefaultWorkReportDraft,
  isWorkReportDraftEmpty,
} from './workReportDraft'

export function needsGuideHandoffConfirmation(
  currentValues: WorkReportFormValues,
  isCurrentReportSaved: boolean,
): boolean {
  return !isCurrentReportSaved && !isWorkReportDraftEmpty(currentValues)
}

export function createGuideHandoffDraft(
  input: WorkReportGuideHandoffInput,
  workDate?: string,
): WorkReportFormValues {
  return {
    ...createDefaultWorkReportDraft(workDate),
    departmentId: input.departmentId,
    equipmentId: input.equipmentId,
    phenomenon: input.phenomenon.trim(),
  }
}

import type { WorkReport } from '../work-reports/types'
import type { EquipmentChangeHistoryCreateInput } from './types'

export type EquipmentChangeHistoryFormValues = {
  readonly changedOn: string
  readonly improvementPoint: string
  readonly changeDetails: string
  readonly workReportId: string
}

export type EquipmentChangeHistoryFormValidation =
  | {
      readonly ok: true
      readonly value: EquipmentChangeHistoryCreateInput
    }
  | { readonly ok: false; readonly errors: readonly string[] }

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const candidate = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
  return (
    candidate.getUTCFullYear() === Number(match[1]) &&
    candidate.getUTCMonth() === Number(match[2]) - 1 &&
    candidate.getUTCDate() === Number(match[3])
  )
}

export function getLocalDateInputValue(now = new Date()): string {
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 10)
}

export function createEmptyEquipmentChangeHistoryForm(
  now = new Date(),
): EquipmentChangeHistoryFormValues {
  return {
    changedOn: getLocalDateInputValue(now),
    improvementPoint: '',
    changeDetails: '',
    workReportId: '',
  }
}

export function validateEquipmentChangeHistoryForm(
  values: EquipmentChangeHistoryFormValues,
  equipmentId: string,
  availableReports: readonly WorkReport[],
): EquipmentChangeHistoryFormValidation {
  const errors: string[] = []
  const improvementPoint = values.improvementPoint.trim()
  const changeDetails = values.changeDetails.trim()

  if (!isIsoDate(values.changedOn)) {
    errors.push('改良・変更日を正しく入力してください。')
  }
  if (!improvementPoint) {
    errors.push('改良ポイントを入力してください。')
  } else if (improvementPoint.length > 200) {
    errors.push('改良ポイントは200文字以内で入力してください。')
  }
  if (!changeDetails) {
    errors.push('変更内容を入力してください。')
  } else if (changeDetails.length > 2000) {
    errors.push('変更内容は2000文字以内で入力してください。')
  }

  if (values.workReportId) {
    const report = availableReports.find(
      (candidate) => candidate.id === values.workReportId,
    )
    if (!report || report.equipment_id !== equipmentId) {
      errors.push('関連日報は、この設備に表示中の日報から選択してください。')
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      equipmentId,
      changedOn: values.changedOn,
      improvementPoint,
      changeDetails,
      workReportId: values.workReportId || null,
    },
  }
}

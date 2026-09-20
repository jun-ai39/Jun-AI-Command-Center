import {
  WORK_REPORT_PROGRESS_OPTIONS,
  type WorkReportConfirmation,
  type WorkReportEquipmentOptionsState,
  type WorkReportFormValues,
  type WorkReportProgress,
} from './types'

type WorkReportValidationResult =
  | { readonly ok: true; readonly value: WorkReportConfirmation }
  | { readonly ok: false; readonly errors: readonly string[] }

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function getLocalDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateInput(value: string): boolean {
  const match = DATE_INPUT_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  )
}

function isWorkReportProgress(value: string): value is WorkReportProgress {
  return WORK_REPORT_PROGRESS_OPTIONS.some((option) => option.value === value)
}

export function validateWorkReport(
  values: WorkReportFormValues,
  equipmentOptionsState: WorkReportEquipmentOptionsState,
): WorkReportValidationResult {
  const errors: string[] = []
  const phenomenon = values.phenomenon.trim()
  const cause = values.cause.trim()
  const workContent = values.workContent.trim()
  const departments =
    equipmentOptionsState.phase === 'ready'
      ? equipmentOptionsState.departments
      : []
  const equipment =
    equipmentOptionsState.phase === 'ready'
      ? equipmentOptionsState.equipment
      : []
  const selectedDepartment = departments.find(
    (department) => department.id === values.departmentId,
  )
  const selectedEquipment = equipment.find(
    (item) => item.equipment_id === values.equipmentId,
  )

  if (!isValidDateInput(values.workDate)) {
    errors.push('作業日を正しく入力してください。')
  }
  if (!selectedDepartment) errors.push('部門を選択してください。')
  if (!selectedEquipment) {
    errors.push('設備を選択してください。')
  } else if (selectedEquipment.department_id !== values.departmentId) {
    errors.push('選択した部門に所属する設備を選択してください。')
  }
  if (!phenomenon) {
    errors.push('現象を入力してください。')
  } else if (phenomenon.length > 2000) {
    errors.push('現象は2,000文字以内で入力してください。')
  }
  if (cause.length > 2000) {
    errors.push('原因は2,000文字以内で入力してください。')
  }
  if (!workContent) {
    errors.push('作業内容を入力してください。')
  } else if (workContent.length > 2000) {
    errors.push('作業内容は2,000文字以内で入力してください。')
  }
  if (!isWorkReportProgress(values.progress)) {
    errors.push('進捗を選択してください。')
  }

  if (errors.length > 0 || !isWorkReportProgress(values.progress)) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      workDate: values.workDate,
      departmentId: values.departmentId,
      equipmentId: values.equipmentId,
      phenomenon,
      cause,
      workContent,
      progress: values.progress,
      ...(values.sourceInspectionId
        ? { sourceInspectionId: values.sourceInspectionId }
        : {}),
    },
  }
}

export function formatWorkReportDate(value: string): string {
  const match = DATE_INPUT_PATTERN.exec(value)
  if (!match) return value
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`
}

export function getWorkReportProgressLabel(
  progress: WorkReportProgress,
): string {
  return (
    WORK_REPORT_PROGRESS_OPTIONS.find((option) => option.value === progress)
      ?.label ?? progress
  )
}

import type { Department, Equipment } from '../equipment-master/types'

export const WORK_REPORT_PROGRESS_OPTIONS = [
  { value: 'completed', label: '完了' },
  { value: 'continued', label: '継続対応' },
  { value: 'follow_up', label: '経過確認' },
] as const

export const LEGACY_WORK_REPORT_CATEGORY_OPTIONS = [
  { value: 'inspection', label: '点検' },
  { value: 'maintenance', label: '整備・修理' },
  { value: 'trouble', label: '故障対応' },
  { value: 'improvement', label: '設備改善' },
  { value: 'other', label: 'その他' },
] as const

export type WorkReportProgress =
  (typeof WORK_REPORT_PROGRESS_OPTIONS)[number]['value']

export type WorkReportAttentionProgress = Extract<
  WorkReportProgress,
  'continued' | 'follow_up'
>

export type LegacyWorkReportCategory =
  (typeof LEGACY_WORK_REPORT_CATEGORY_OPTIONS)[number]['value']

export type WorkReportFormValues = {
  readonly workDate: string
  readonly departmentId: string
  readonly equipmentId: string
  readonly phenomenon: string
  readonly cause: string
  readonly workContent: string
  readonly progress: string
}

export type WorkReportGuideHandoffInput = {
  readonly departmentId: string
  readonly equipmentId: string
  readonly phenomenon: string
  readonly source?: 'guide' | 'inspection'
  readonly workDate?: string
  readonly workContent?: string
  readonly progress?: WorkReportProgress
}

export type WorkReportGuideHandoffRequest = WorkReportGuideHandoffInput & {
  readonly requestId: number
}

export type WorkReportConfirmation = {
  readonly workDate: string
  readonly departmentId: string
  readonly equipmentId: string
  readonly phenomenon: string
  readonly cause: string
  readonly workContent: string
  readonly progress: WorkReportProgress
}

export type WorkReport = {
  readonly id: string
  readonly work_date: string
  readonly department_id: string | null
  readonly equipment_id: string | null
  readonly department_name: string | null
  readonly equipment_name: string | null
  readonly equipment_number: string | null
  readonly phenomenon: string | null
  readonly cause: string | null
  readonly work_content: string
  readonly progress: WorkReportProgress
  readonly is_legacy: boolean
  readonly legacy_category: LegacyWorkReportCategory | null
  readonly legacy_work_hours: number | null
  readonly legacy_notes: string | null
  readonly created_at: string
  readonly updated_at: string
}

export type WorkReportSaveState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'saving' }
  | { readonly phase: 'saved'; readonly report: WorkReport }
  | { readonly phase: 'error'; readonly message: string }

export type WorkReportUpdateState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'updating' }
  | { readonly phase: 'updated'; readonly report: WorkReport }
  | { readonly phase: 'error'; readonly message: string }

export type WorkReportListResponse = {
  readonly items: readonly WorkReport[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

export type WorkReportSearchFilters = {
  readonly workDate: string | null
  readonly departmentId: string | null
  readonly workContentQuery: string | null
  readonly progress: WorkReportProgress | null
}

export type WorkReportCollectionState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly WorkReport[]
      readonly total: number
    }
  | { readonly phase: 'error' }

export type WorkReportAttentionSummary = {
  readonly continued_count: number
  readonly follow_up_count: number
  readonly attention_count: number
}

export type WorkReportAttentionSummaryState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly summary: WorkReportAttentionSummary
    }
  | { readonly phase: 'error' }

export type WorkReportEquipmentOptionsState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly departments: readonly Department[]
      readonly equipment: readonly Equipment[]
    }
  | { readonly phase: 'error' }

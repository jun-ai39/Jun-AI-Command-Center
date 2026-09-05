import type { InspectionCycle } from '../inspection-templates/types'

export type InspectionCompletionStatus = 'pending' | 'completed'

export type InspectionCycleStatusSummary = {
  readonly cycle: InspectionCycle
  readonly total: number
  readonly completed: number
  readonly pending: number
}

export type InspectionScheduleStatusItem = {
  readonly equipment_id: string
  readonly equipment_name: string
  readonly equipment_number: string | null
  readonly department_id: string
  readonly department_name: string
  readonly cycle: InspectionCycle
  readonly period_key: string
  readonly template_item_count: number
  readonly completion_status: InspectionCompletionStatus
  readonly inspection_record_id: string | null
  readonly inspection_date: string | null
  readonly overall_judgment: 'normal' | 'abnormal' | null
}

export type InspectionScheduleStatusResponse = {
  readonly target_date: string
  readonly cycle_summaries: readonly InspectionCycleStatusSummary[]
  readonly items: readonly InspectionScheduleStatusItem[]
}

export type InspectionStatusState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly data: InspectionScheduleStatusResponse
    }
  | { readonly phase: 'error' }

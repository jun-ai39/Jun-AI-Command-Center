import type { WorkReport } from '../work-reports/types'
import type {
  InspectionCycle,
  InspectionInputType,
  InspectionTemplateItem,
} from '../inspection-templates/types'

export type InspectionRecordEntrySelection = {
  readonly equipmentId: string
  readonly departmentName: string
  readonly equipmentName: string
  readonly equipmentNumber: string | null
  readonly cycle: InspectionCycle
}

export type InspectionStatusValue = 'normal' | 'abnormal'

export type InspectionJudgment = 'normal' | 'abnormal'

export type InspectionRecordItemInput = {
  readonly templateItemId: string
  readonly numberValue: number | null
  readonly statusValue: InspectionStatusValue | null
}

export type InspectionRecordCreateInput = {
  readonly inspectionDate: string
  readonly equipmentId: string
  readonly cycle: InspectionCycle
  readonly items: readonly InspectionRecordItemInput[]
}

export type InspectionRecordItem = {
  readonly id: string
  readonly template_item_id: string
  readonly name: string
  readonly input_type: InspectionInputType
  readonly number_value: number | null
  readonly status_value: InspectionStatusValue | null
  readonly unit: string | null
  readonly normal_min: number | null
  readonly normal_max: number | null
  readonly normal_state: string | null
  readonly judgment: InspectionJudgment
  readonly display_order: number
}

export type InspectionRecord = {
  readonly linked_work_report?: WorkReport | null
  readonly id: string
  readonly inspection_date: string
  readonly equipment_id: string
  readonly equipment_name: string
  readonly equipment_number: string | null
  readonly cycle: InspectionCycle
  readonly period_key: string
  readonly overall_judgment: InspectionJudgment
  readonly items: readonly InspectionRecordItem[]
  readonly created_at: string
  readonly updated_at: string
}

export type InspectionRecordListResponse = {
  readonly items: readonly InspectionRecord[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

export type InspectionEntryTemplateState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly InspectionTemplateItem[]
    }
  | { readonly phase: 'error' }

export type InspectionRecordSaveState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'saving' }
  | { readonly phase: 'saved'; readonly record: InspectionRecord }
  | { readonly phase: 'error'; readonly message: string }

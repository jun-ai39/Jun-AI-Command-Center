export type EquipmentChangeHistory = {
  readonly change_history_id: string
  readonly equipment_id: string
  readonly changed_on: string
  readonly improvement_point: string
  readonly change_details: string
  readonly work_report_id: string | null
  readonly created_at: string
  readonly updated_at: string
}

export type EquipmentChangeHistoryListResponse = {
  readonly items: readonly EquipmentChangeHistory[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

export type EquipmentChangeHistoryCreateInput = {
  readonly equipmentId: string
  readonly changedOn: string
  readonly improvementPoint: string
  readonly changeDetails: string
  readonly workReportId: string | null
}

export type EquipmentChangeHistorySaveState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'saving' }
  | {
      readonly phase: 'saved'
      readonly history: EquipmentChangeHistory
    }
  | { readonly phase: 'error'; readonly message: string }

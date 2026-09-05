export const INSPECTION_CYCLE_OPTIONS = [
  { value: 'daily', label: '毎日' },
  { value: 'weekly', label: '毎週' },
  { value: 'monthly', label: '毎月' },
] as const

export const INSPECTION_INPUT_TYPE_OPTIONS = [
  { value: 'number', label: '数値' },
  { value: 'status', label: '状態' },
] as const

export type InspectionCycle = (typeof INSPECTION_CYCLE_OPTIONS)[number]['value']

export type InspectionInputType =
  (typeof INSPECTION_INPUT_TYPE_OPTIONS)[number]['value']

export type InspectionTemplateItem = {
  readonly id: string
  readonly equipment_id: string
  readonly cycle: InspectionCycle
  readonly name: string
  readonly input_type: InspectionInputType
  readonly unit: string | null
  readonly normal_min: number | null
  readonly normal_max: number | null
  readonly normal_state: string | null
  readonly check_method: string | null
  readonly caution_note: string | null
  readonly display_order: number
  readonly is_active: boolean
  readonly created_at: string
  readonly updated_at: string
}

export type InspectionTemplateItemListResponse = {
  readonly items: readonly InspectionTemplateItem[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

export type InspectionTemplateCreateInput = {
  readonly equipmentId: string
  readonly cycle: InspectionCycle
  readonly name: string
  readonly inputType: InspectionInputType
  readonly unit: string
  readonly normalMin: number | null
  readonly normalMax: number | null
  readonly normalState: string
  readonly checkMethod: string
  readonly cautionNote: string
  readonly displayOrder: number
  readonly isActive: boolean
}

export type InspectionTemplateGuideUpdateInput = {
  readonly itemId: string
  readonly checkMethod: string
  readonly cautionNote: string
}

export type InspectionTemplateCollectionState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly InspectionTemplateItem[]
      readonly total: number
    }
  | { readonly phase: 'error' }

export type InspectionTemplateSaveState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'saving' }
  | { readonly phase: 'saved'; readonly item: InspectionTemplateItem }
  | { readonly phase: 'error'; readonly message: string }

export type InspectionTemplateGuideSaveState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'saving'; readonly itemId: string }
  | { readonly phase: 'saved'; readonly item: InspectionTemplateItem }
  | {
      readonly phase: 'error'
      readonly itemId: string
      readonly message: string
    }

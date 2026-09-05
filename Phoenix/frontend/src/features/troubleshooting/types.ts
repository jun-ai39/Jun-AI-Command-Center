export type TroubleshootingStepType = 'question' | 'complete' | 'handoff'

export type TroubleshootingAnswer = 'yes' | 'no' | 'unknown'

export type TroubleshootingGuideSummary = {
  readonly id: string
  readonly equipment_id: string
  readonly symptom: string
  readonly start_step_id: string
  readonly display_order: number
  readonly is_active: boolean
  readonly created_at: string
  readonly updated_at: string
}

export type TroubleshootingStep = {
  readonly step_id: string
  readonly step_type: TroubleshootingStepType
  readonly prompt: string
  readonly check_method: string | null
  readonly caution_note: string | null
}

export type TroubleshootingBranch = {
  readonly branch_id: string
  readonly from_step_id: string
  readonly answer: TroubleshootingAnswer
  readonly to_step_id: string
}

export type TroubleshootingGuide = TroubleshootingGuideSummary & {
  readonly steps: readonly TroubleshootingStep[]
  readonly branches: readonly TroubleshootingBranch[]
}

export type TroubleshootingStepCreateInput = {
  readonly step_id: string
  readonly step_type: TroubleshootingStepType
  readonly prompt: string
  readonly check_method: string | null
  readonly caution_note: string | null
}

export type TroubleshootingBranchCreateInput = {
  readonly from_step_id: string
  readonly answer: TroubleshootingAnswer
  readonly to_step_id: string
}

export type TroubleshootingGuideCreateInput = {
  readonly equipment_id: string
  readonly symptom: string
  readonly start_step_id: string
  readonly display_order: number
  readonly is_active: boolean
  readonly steps: readonly TroubleshootingStepCreateInput[]
  readonly branches: readonly TroubleshootingBranchCreateInput[]
}

export type TroubleshootingGuideListResponse = {
  readonly items: readonly TroubleshootingGuideSummary[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

export type TroubleshootingGuideListState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly TroubleshootingGuideSummary[]
      readonly total: number
    }
  | { readonly phase: 'error' }

export type TroubleshootingGuideDetailState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading'; readonly guideId: string }
  | { readonly phase: 'ready'; readonly guide: TroubleshootingGuide }
  | { readonly phase: 'error'; readonly guideId: string }

export type TroubleshootingGuideSaveState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'saving' }
  | { readonly phase: 'saved'; readonly guide: TroubleshootingGuide }
  | { readonly phase: 'error'; readonly message: string }

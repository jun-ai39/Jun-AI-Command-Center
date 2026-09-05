import type { EquipmentChangeHistory } from '../equipment-change-histories/types'
import type { InspectionRecord } from '../inspection-records/types'
import type { InspectionTemplateItem } from '../inspection-templates/types'
import type { WorkReport } from '../work-reports/types'

export type EquipmentProfileChangeHistoriesState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly EquipmentChangeHistory[]
      readonly total: number
    }
  | { readonly phase: 'error' }

export type EquipmentProfileReportsState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly WorkReport[]
      readonly total: number
    }
  | { readonly phase: 'error' }

export type EquipmentProfileInspectionsState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly InspectionRecord[]
      readonly total: number
    }
  | { readonly phase: 'error' }

export type EquipmentProfileGuidesState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly InspectionTemplateItem[]
      readonly total: number
    }
  | { readonly phase: 'error' }

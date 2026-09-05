import type {
  Department,
  Equipment,
  Manufacturer,
} from '../equipment-master/types'

export type EquipmentFinderData = {
  readonly departments: readonly Department[]
  readonly manufacturers: readonly Manufacturer[]
  readonly equipment: readonly Equipment[]
}

export type EquipmentFinderState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly data: EquipmentFinderData }
  | { readonly phase: 'error' }

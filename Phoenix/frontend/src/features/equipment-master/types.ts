export type Department = {
  readonly id: string
  readonly name: string
  readonly display_order: number
  readonly is_active: boolean
  readonly created_at: string
  readonly updated_at: string
}

export type Manufacturer = {
  readonly id: string
  readonly name: string
  readonly is_active: boolean
  readonly created_at: string
  readonly updated_at: string
}

export type Equipment = {
  readonly equipment_id: string
  readonly department_id: string
  readonly manufacturer_id: string
  readonly name: string
  readonly equipment_number: string | null
  readonly model_number: string | null
  readonly photo_path: string | null
  readonly is_active: boolean
  readonly created_at: string
  readonly updated_at: string
}

export type MasterListResponse<T> = {
  readonly items: readonly T[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

export type EquipmentMasterCollection = {
  readonly departments: readonly Department[]
  readonly departmentTotal: number
  readonly manufacturers: readonly Manufacturer[]
  readonly manufacturerTotal: number
  readonly equipment: readonly Equipment[]
  readonly equipmentTotal: number
}

export type EquipmentMasterState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly data: EquipmentMasterCollection }
  | { readonly phase: 'error' }

export type SaveState<T> =
  | { readonly phase: 'idle' }
  | { readonly phase: 'saving' }
  | { readonly phase: 'saved'; readonly item: T }
  | { readonly phase: 'error'; readonly message: string }

export type ManufacturerCreateInput = {
  readonly name: string
}

export type EquipmentCreateInput = {
  readonly departmentId: string
  readonly manufacturerId: string
  readonly name: string
  readonly equipmentNumber: string
  readonly modelNumber: string
}

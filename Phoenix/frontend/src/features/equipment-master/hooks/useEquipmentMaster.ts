import { useCallback, useEffect, useState } from 'react'

import {
  createEquipment as createEquipmentRequest,
  createManufacturer as createManufacturerRequest,
  EquipmentMasterApiError,
  fetchActiveEquipment,
  fetchDepartments,
  fetchManufacturers,
} from '../api/equipmentMaster'
import type {
  Department,
  Equipment,
  EquipmentCreateInput,
  EquipmentMasterState,
  Manufacturer,
  ManufacturerCreateInput,
  SaveState,
} from '../types'

type EquipmentMasterActions = {
  readonly state: EquipmentMasterState
  readonly manufacturerSaveState: SaveState<Manufacturer>
  readonly equipmentSaveState: SaveState<Equipment>
  readonly reload: () => void
  readonly saveManufacturer: (
    input: ManufacturerCreateInput,
  ) => Promise<Manufacturer | null>
  readonly saveEquipment: (
    input: EquipmentCreateInput,
  ) => Promise<Equipment | null>
  readonly resetManufacturerSave: () => void
  readonly resetEquipmentSave: () => void
}

function sortDepartments(items: readonly Department[]): readonly Department[] {
  return [...items].sort(
    (left, right) =>
      left.display_order - right.display_order ||
      left.name.localeCompare(right.name, 'ja'),
  )
}

function sortManufacturers(
  items: readonly Manufacturer[],
): readonly Manufacturer[] {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, 'ja'),
  )
}

function sortEquipment(items: readonly Equipment[]): readonly Equipment[] {
  return [...items].sort(
    (left, right) =>
      left.department_id.localeCompare(right.department_id) ||
      left.manufacturer_id.localeCompare(right.manufacturer_id) ||
      left.name.localeCompare(right.name, 'ja') ||
      (left.equipment_number ?? '').localeCompare(
        right.equipment_number ?? '',
        'ja',
      ),
  )
}

function describeSaveError(error: unknown, duplicateMessage: string): string {
  if (error instanceof EquipmentMasterApiError && error.status === 409) {
    return duplicateMessage
  }
  return '保存できませんでした。APIの接続状態を確認してください。'
}

export function useEquipmentMaster(): EquipmentMasterActions {
  const [state, setState] = useState<EquipmentMasterState>({ phase: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [manufacturerSaveState, setManufacturerSaveState] = useState<
    SaveState<Manufacturer>
  >({ phase: 'idle' })
  const [equipmentSaveState, setEquipmentSaveState] = useState<
    SaveState<Equipment>
  >({ phase: 'idle' })

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      fetchDepartments({ signal: controller.signal }),
      fetchManufacturers({ signal: controller.signal }),
      fetchActiveEquipment({ signal: controller.signal }),
    ])
      .then(([departments, manufacturers, equipment]) => {
        if (controller.signal.aborted) {
          return
        }
        setState({
          phase: 'ready',
          data: {
            departments: sortDepartments(departments.items),
            departmentTotal: departments.total,
            manufacturers: sortManufacturers(manufacturers.items),
            manufacturerTotal: manufacturers.total,
            equipment: sortEquipment(equipment.items),
            equipmentTotal: equipment.total,
          },
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })

    return () => controller.abort()
  }, [reloadToken])

  const reload = useCallback(() => {
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  const saveManufacturer = useCallback(
    async (input: ManufacturerCreateInput): Promise<Manufacturer | null> => {
      setManufacturerSaveState({ phase: 'saving' })
      try {
        const manufacturer = await createManufacturerRequest(input)
        setState((current) => {
          if (current.phase !== 'ready') {
            return current
          }
          return {
            phase: 'ready',
            data: {
              ...current.data,
              manufacturers: sortManufacturers([
                ...current.data.manufacturers,
                manufacturer,
              ]),
              manufacturerTotal: current.data.manufacturerTotal + 1,
            },
          }
        })
        setManufacturerSaveState({ phase: 'saved', item: manufacturer })
        return manufacturer
      } catch (error) {
        setManufacturerSaveState({
          phase: 'error',
          message: describeSaveError(
            error,
            '同じ名前のメーカーがすでに登録されています。',
          ),
        })
        return null
      }
    },
    [],
  )

  const saveEquipment = useCallback(
    async (input: EquipmentCreateInput): Promise<Equipment | null> => {
      setEquipmentSaveState({ phase: 'saving' })
      try {
        const equipmentItem = await createEquipmentRequest(input)
        setState((current) => {
          if (current.phase !== 'ready') {
            return current
          }
          return {
            phase: 'ready',
            data: {
              ...current.data,
              equipment: sortEquipment([
                ...current.data.equipment,
                equipmentItem,
              ]),
              equipmentTotal: current.data.equipmentTotal + 1,
            },
          }
        })
        setEquipmentSaveState({ phase: 'saved', item: equipmentItem })
        return equipmentItem
      } catch (error) {
        setEquipmentSaveState({
          phase: 'error',
          message: describeSaveError(
            error,
            '設備情報が既存データと競合しています。',
          ),
        })
        return null
      }
    },
    [],
  )

  const resetManufacturerSave = useCallback(() => {
    setManufacturerSaveState({ phase: 'idle' })
  }, [])

  const resetEquipmentSave = useCallback(() => {
    setEquipmentSaveState({ phase: 'idle' })
  }, [])

  return {
    state,
    manufacturerSaveState,
    equipmentSaveState,
    reload,
    saveManufacturer,
    saveEquipment,
    resetManufacturerSave,
    resetEquipmentSave,
  }
}

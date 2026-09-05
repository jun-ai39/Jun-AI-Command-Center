import { useCallback, useEffect, useState } from 'react'

import {
  fetchActiveDepartments,
  fetchActiveEquipment,
  fetchActiveManufacturers,
} from '../../equipment-master/api/equipmentMaster'
import type {
  Department,
  Equipment,
  Manufacturer,
} from '../../equipment-master/types'
import type { EquipmentFinderState } from '../types'

type EquipmentFinderActions = {
  readonly state: EquipmentFinderState
  readonly reload: () => void
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

export function useEquipmentFinder(): EquipmentFinderActions {
  const [state, setState] = useState<EquipmentFinderState>({ phase: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      fetchActiveDepartments({ signal: controller.signal }),
      fetchActiveManufacturers({ signal: controller.signal }),
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
            manufacturers: sortManufacturers(manufacturers.items),
            equipment: sortEquipment(equipment.items),
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

  return { state, reload }
}

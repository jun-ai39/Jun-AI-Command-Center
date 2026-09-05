import type {
  Department,
  Equipment,
  Manufacturer,
} from '../equipment-master/types'
import type { EquipmentFinderData } from './types'

export type EquipmentFinderManufacturerGroup = {
  readonly manufacturer: Manufacturer
  readonly equipment: readonly Equipment[]
}

export type EquipmentFinderDepartmentGroup = {
  readonly department: Department
  readonly manufacturerGroups: readonly EquipmentFinderManufacturerGroup[]
  readonly equipmentCount: number
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja').trim()
}

function compareEquipment(left: Equipment, right: Equipment): number {
  return (
    left.name.localeCompare(right.name, 'ja') ||
    (left.equipment_number ?? '').localeCompare(
      right.equipment_number ?? '',
      'ja',
    ) ||
    (left.model_number ?? '').localeCompare(right.model_number ?? '', 'ja')
  )
}

export function filterEquipmentForKeyword(
  data: EquipmentFinderData,
  keyword: string,
): readonly Equipment[] {
  const activeDepartmentIds = new Set(
    data.departments.filter((item) => item.is_active).map((item) => item.id),
  )
  const activeManufacturerById = new Map(
    data.manufacturers
      .filter((item) => item.is_active)
      .map((item) => [item.id, item]),
  )
  const terms = normalizeSearchText(keyword).split(/\s+/).filter(Boolean)

  return data.equipment
    .filter(
      (item) =>
        item.is_active &&
        activeDepartmentIds.has(item.department_id) &&
        activeManufacturerById.has(item.manufacturer_id),
    )
    .filter((item) => {
      if (terms.length === 0) {
        return true
      }
      const manufacturer = activeManufacturerById.get(item.manufacturer_id)
      const searchableText = normalizeSearchText(
        [
          item.name,
          item.equipment_number,
          item.model_number,
          manufacturer?.name,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' '),
      )
      return terms.every((term) => searchableText.includes(term))
    })
    .sort(compareEquipment)
}

export function buildEquipmentFinderGroups(
  data: EquipmentFinderData,
  matchingEquipment: readonly Equipment[],
): readonly EquipmentFinderDepartmentGroup[] {
  const manufacturerById = new Map(
    data.manufacturers
      .filter((item) => item.is_active)
      .map((item) => [item.id, item]),
  )

  return data.departments
    .filter((department) => department.is_active)
    .map((department) => {
      const departmentEquipment = matchingEquipment.filter(
        (item) => item.department_id === department.id,
      )
      const equipmentByManufacturer = new Map<string, Equipment[]>()
      departmentEquipment.forEach((item) => {
        if (!manufacturerById.has(item.manufacturer_id)) {
          return
        }
        const items = equipmentByManufacturer.get(item.manufacturer_id) ?? []
        items.push(item)
        equipmentByManufacturer.set(item.manufacturer_id, items)
      })
      const manufacturerGroups = [...equipmentByManufacturer.entries()]
        .map(([manufacturerId, equipment]) => ({
          manufacturer: manufacturerById.get(manufacturerId) as Manufacturer,
          equipment: [...equipment].sort(compareEquipment),
        }))
        .sort((left, right) =>
          left.manufacturer.name.localeCompare(right.manufacturer.name, 'ja'),
        )
      return {
        department,
        manufacturerGroups,
        equipmentCount: departmentEquipment.length,
      }
    })
    .filter((group) => group.equipmentCount > 0)
}

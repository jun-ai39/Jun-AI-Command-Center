import type { Equipment } from '../types'

export function getEquipmentDisplayName(item: Equipment): string {
  return item.equipment_number
    ? `${item.name} ${item.equipment_number}`
    : item.name
}

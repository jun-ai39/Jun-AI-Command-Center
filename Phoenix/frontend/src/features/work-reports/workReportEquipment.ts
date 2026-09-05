import type { Equipment } from '../equipment-master/types'
import type { WorkReportEquipmentOptionsState } from './types'

export function getEquipmentLabel(equipment: Equipment): string {
  return equipment.equipment_number
    ? `${equipment.name} ${equipment.equipment_number}`
    : equipment.name
}

export function getSelectedDepartmentName(
  state: WorkReportEquipmentOptionsState,
  departmentId: string,
): string {
  if (state.phase !== 'ready') {
    return '読み込み中'
  }
  return (
    state.departments.find((department) => department.id === departmentId)
      ?.name ?? '未選択'
  )
}

export function getSelectedEquipmentName(
  state: WorkReportEquipmentOptionsState,
  equipmentId: string,
): string {
  if (state.phase !== 'ready') {
    return '読み込み中'
  }
  const equipment = state.equipment.find(
    (item) => item.equipment_id === equipmentId,
  )
  return equipment ? getEquipmentLabel(equipment) : '未選択'
}

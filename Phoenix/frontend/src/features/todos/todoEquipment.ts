import type { WorkReportEquipmentOptionsState } from '../work-reports/types'
import { getEquipmentLabel } from '../work-reports/workReportEquipment'

export type TodoEquipmentSummary = {
  readonly label: string
  readonly status: 'linked' | 'loading' | 'unavailable'
}

export function getTodoEquipmentDepartmentId(
  state: WorkReportEquipmentOptionsState,
  equipmentId: string | null,
): string {
  if (state.phase !== 'ready' || !equipmentId) return ''
  return (
    state.equipment.find((item) => item.equipment_id === equipmentId)
      ?.department_id ?? ''
  )
}

export function getTodoEquipmentSummary(
  state: WorkReportEquipmentOptionsState,
  equipmentId: string | null,
): TodoEquipmentSummary | null {
  if (!equipmentId) return null
  if (state.phase === 'loading') {
    return { label: '設備情報を読み込んでいます', status: 'loading' }
  }
  if (state.phase === 'error') {
    return { label: '設備情報を表示できません', status: 'unavailable' }
  }

  const equipment = state.equipment.find(
    (item) => item.equipment_id === equipmentId,
  )
  if (!equipment) {
    return { label: '登録設備を確認できません', status: 'unavailable' }
  }
  const department = state.departments.find(
    (item) => item.id === equipment.department_id,
  )
  return {
    label: `${department?.name ?? '部門未登録'} / ${getEquipmentLabel(equipment)}`,
    status: 'linked',
  }
}

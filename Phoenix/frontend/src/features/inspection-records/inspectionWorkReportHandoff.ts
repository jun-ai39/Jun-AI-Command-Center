import type { Equipment } from '../equipment-master/types'
import {
  INSPECTION_CYCLE_OPTIONS,
  type InspectionCycle,
} from '../inspection-templates/types'
import type { WorkReportGuideHandoffInput } from '../work-reports/types'
import type { InspectionRecord } from './types'

function getCycleLabel(cycle: InspectionCycle): string {
  return (
    INSPECTION_CYCLE_OPTIONS.find((option) => option.value === cycle)?.label ??
    cycle
  )
}

export function createInspectionWorkReportHandoff({
  inspectionDate,
  equipment,
  cycle,
  record,
}: {
  readonly inspectionDate: string
  readonly equipment: Equipment
  readonly cycle: InspectionCycle
  readonly record: InspectionRecord
}): WorkReportGuideHandoffInput | null {
  if (record.overall_judgment !== 'abnormal') return null
  const abnormalItemNames = record.items
    .filter((item) => item.judgment === 'abnormal')
    .map((item) => item.name)
  if (abnormalItemNames.length === 0) return null

  return {
    source: 'inspection',
    sourceInspectionId: record.id,
    workDate: inspectionDate,
    departmentId: equipment.department_id,
    equipmentId: equipment.equipment_id,
    phenomenon: `${getCycleLabel(cycle)}点検で異常を確認：${abnormalItemNames.join('、')}`,
    workContent:
      '点検で異常を確認したため、設備の状態を確認し、必要な対応を引き継ぐ。',
    progress: 'continued',
  }
}

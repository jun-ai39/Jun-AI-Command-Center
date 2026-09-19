import type { Equipment } from '../../equipment-master/types'
import { createInspectionWorkReportHandoff } from '../../inspection-records/inspectionWorkReportHandoff'
import type { InspectionRecord } from '../../inspection-records/types'
import type { WorkReportGuideHandoffInput } from '../../work-reports/types'

export function InspectionHistoryHandoff({
  record,
  equipment,
  onStartWorkReport,
}: {
  readonly record: InspectionRecord
  readonly equipment: Equipment
  readonly onStartWorkReport?: (input: WorkReportGuideHandoffInput) => void
}) {
  if (!onStartWorkReport || record.equipment_id !== equipment.equipment_id) {
    return null
  }
  const input = createInspectionWorkReportHandoff({
    inspectionDate: record.inspection_date,
    cycle: record.cycle,
    equipment,
    record,
  })
  if (!input) return null

  return (
    <div className="equipment-profile-inspection-handoff">
      <p>
        この点検の日付・異常項目を日報の下書きへ反映します。自動では登録されません。登録済みの日報がある場合は、要対応・履歴から編集してください。
      </p>
      <button type="button" onClick={() => onStartWorkReport(input)}>
        作業日報へ引き継ぐ
      </button>
    </div>
  )
}

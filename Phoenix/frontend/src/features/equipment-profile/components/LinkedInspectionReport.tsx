import { useState } from 'react'
import { WorkReportEditPanel } from '../../work-reports/components/WorkReportEditPanel'
import { useWorkReportEquipmentOptions } from '../../work-reports/hooks/useWorkReportEquipmentOptions'
import type { WorkReport } from '../../work-reports/types'
import { getWorkReportProgressLabel } from '../../work-reports/workReportForm'

function LinkedReportEditor({
  report,
  onClose,
  onUpdated,
}: {
  readonly report: WorkReport
  readonly onClose: () => void
  readonly onUpdated: (report: WorkReport) => void
}) {
  const { state, reload } = useWorkReportEquipmentOptions()
  return (
    <WorkReportEditPanel
      report={report}
      onCancel={onClose}
      onUpdated={onUpdated}
      equipmentOptionsState={state}
      onReloadEquipmentOptions={reload}
    />
  )
}

export function LinkedInspectionReport({
  report,
  onUpdated,
}: {
  readonly report: WorkReport
  readonly onUpdated?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentReport, setCurrentReport] = useState(report)
  return (
    <div className="equipment-profile-inspection-handoff">
      <p role="status">
        引き継ぎ済み・{getWorkReportProgressLabel(currentReport.progress)}
      </p>
      {isOpen ? (
        <LinkedReportEditor
          report={currentReport}
          onClose={() => setIsOpen(false)}
          onUpdated={(updated) => {
            setCurrentReport(updated)
            setIsOpen(false)
            onUpdated?.()
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setCurrentReport(report)
            setIsOpen(true)
          }}
        >
          引き継いだ日報を開く
        </button>
      )}
    </div>
  )
}

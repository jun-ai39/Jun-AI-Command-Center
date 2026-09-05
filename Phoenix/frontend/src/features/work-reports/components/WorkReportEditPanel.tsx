import { useState, type FormEvent } from 'react'

import { useWorkReportUpdate } from '../hooks/useWorkReportUpdate'
import {
  WORK_REPORT_PROGRESS_OPTIONS,
  type WorkReport,
  type WorkReportConfirmation,
  type WorkReportEquipmentOptionsState,
  type WorkReportFormValues,
} from '../types'
import {
  formatWorkReportDate,
  getWorkReportProgressLabel,
  validateWorkReport,
} from '../workReportForm'
import {
  getSelectedDepartmentName,
  getSelectedEquipmentName,
} from '../workReportEquipment'
import { WorkReportEquipmentFields } from './WorkReportEquipmentFields'
import './WorkReportEditPanel.css'

type WorkReportEditPanelProps = {
  readonly report: WorkReport
  readonly onCancel: () => void
  readonly onUpdated: (report: WorkReport) => void
  readonly equipmentOptionsState: WorkReportEquipmentOptionsState
  readonly onReloadEquipmentOptions: () => void
}

function createEditValues(report: WorkReport): WorkReportFormValues {
  return {
    workDate: report.work_date,
    departmentId: report.department_id ?? '',
    equipmentId: report.equipment_id ?? '',
    phenomenon: report.phenomenon ?? '',
    cause: report.cause ?? '',
    workContent: report.work_content,
    progress: report.progress,
  }
}

export function WorkReportEditPanel({
  report,
  onCancel,
  onUpdated,
  equipmentOptionsState,
  onReloadEquipmentOptions,
}: WorkReportEditPanelProps) {
  const [values, setValues] = useState<WorkReportFormValues>(() =>
    createEditValues(report),
  )
  const [errors, setErrors] = useState<readonly string[]>([])
  const [confirmation, setConfirmation] =
    useState<WorkReportConfirmation | null>(null)
  const { updateState, updateSavedWorkReport, resetWorkReportUpdate } =
    useWorkReportUpdate()
  const isUpdating = updateState.phase === 'updating'

  function updateValues(nextValues: WorkReportFormValues) {
    setValues(nextValues)
    setErrors([])
    setConfirmation(null)
    resetWorkReportUpdate()
  }

  function updateValue(field: keyof WorkReportFormValues, value: string) {
    updateValues({ ...values, [field]: value })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateWorkReport(values, equipmentOptionsState)
    if (!validation.ok) {
      setErrors(validation.errors)
      setConfirmation(null)
      return
    }
    setErrors([])
    setConfirmation(validation.value)
    resetWorkReportUpdate()
  }

  async function handleUpdate() {
    if (!confirmation || isUpdating) return
    const updatedReport = await updateSavedWorkReport(report.id, confirmation)
    if (updatedReport) onUpdated(updatedReport)
  }

  return (
    <section
      className="work-report-edit-panel"
      aria-labelledby="work-report-edit-title"
    >
      <div className="work-report-edit-heading">
        <div>
          <p>EDIT SAVED REPORT / STEP 94</p>
          <h3 id="work-report-edit-title">
            {confirmation ? '変更内容の確認' : '保存済み日報を編集'}
          </h3>
        </div>
        <span>{confirmation ? '確認' : '7項目'}</span>
      </div>

      {report.is_legacy && !confirmation && (
        <p className="work-report-edit-guidance" role="status">
          旧形式の日報です。旧カテゴリ・作業時間・備考は保持したまま、現象と原因を追加して7項目形式へ更新します。
        </p>
      )}

      {confirmation ? (
        <div className="work-report-edit-review" aria-live="polite">
          <p className="work-report-edit-guidance">
            変更内容を確認し、問題がなければPhoenix DBへ保存します。
          </p>
          <dl>
            <div>
              <dt>日付</dt>
              <dd>{formatWorkReportDate(confirmation.workDate)}</dd>
            </div>
            <div>
              <dt>部門</dt>
              <dd>
                {getSelectedDepartmentName(
                  equipmentOptionsState,
                  confirmation.departmentId,
                )}
              </dd>
            </div>
            <div>
              <dt>設備</dt>
              <dd>
                {getSelectedEquipmentName(
                  equipmentOptionsState,
                  confirmation.equipmentId,
                )}
              </dd>
            </div>
            <div>
              <dt>進捗</dt>
              <dd>{getWorkReportProgressLabel(confirmation.progress)}</dd>
            </div>
            <div className="is-wide">
              <dt>現象</dt>
              <dd>{confirmation.phenomenon}</dd>
            </div>
            <div className="is-wide">
              <dt>原因</dt>
              <dd>{confirmation.cause || '未特定'}</dd>
            </div>
            <div className="is-wide">
              <dt>作業内容</dt>
              <dd>{confirmation.workContent}</dd>
            </div>
          </dl>
          {updateState.phase === 'error' && (
            <p className="work-report-edit-error" role="alert">
              {updateState.message}
            </p>
          )}
          <div className="work-report-edit-actions">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void handleUpdate()}
            >
              {isUpdating ? '変更を保存中...' : '変更を保存'}
            </button>
            <button
              className="is-secondary"
              type="button"
              disabled={isUpdating}
              onClick={() => {
                setConfirmation(null)
                resetWorkReportUpdate()
              }}
            >
              編集画面に戻る
            </button>
            <button
              className="is-secondary"
              type="button"
              disabled={isUpdating}
              onClick={onCancel}
            >
              編集をキャンセル
            </button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit}>
          {!report.is_legacy && (
            <p className="work-report-edit-guidance">
              7項目を修正し、保存前に変更内容を確認します。編集内容は下書きへ影響しません。
            </p>
          )}
          <label htmlFor="work-report-edit-date">
            <span>1. 日付</span>
            <input
              id="work-report-edit-date"
              type="date"
              value={values.workDate}
              required
              onChange={(event) => updateValue('workDate', event.target.value)}
            />
          </label>
          <WorkReportEquipmentFields
            idPrefix="work-report-edit"
            departmentId={values.departmentId}
            equipmentId={values.equipmentId}
            state={equipmentOptionsState}
            numberedLabels
            onDepartmentChange={(departmentId) =>
              updateValues({ ...values, departmentId, equipmentId: '' })
            }
            onEquipmentChange={(equipmentId) =>
              updateValue('equipmentId', equipmentId)
            }
            onReload={onReloadEquipmentOptions}
          />
          <label htmlFor="work-report-edit-phenomenon">
            <span>4. 現象</span>
            <textarea
              id="work-report-edit-phenomenon"
              value={values.phenomenon}
              maxLength={2000}
              required
              onChange={(event) =>
                updateValue('phenomenon', event.target.value)
              }
            />
          </label>
          <label htmlFor="work-report-edit-cause">
            <span>5. 原因（未特定なら空欄）</span>
            <textarea
              id="work-report-edit-cause"
              className="is-notes"
              value={values.cause}
              maxLength={2000}
              onChange={(event) => updateValue('cause', event.target.value)}
            />
          </label>
          <label htmlFor="work-report-edit-content">
            <span>6. 作業内容</span>
            <textarea
              id="work-report-edit-content"
              value={values.workContent}
              maxLength={2000}
              required
              onChange={(event) =>
                updateValue('workContent', event.target.value)
              }
            />
          </label>
          <label htmlFor="work-report-edit-progress">
            <span>7. 進捗</span>
            <select
              id="work-report-edit-progress"
              value={values.progress}
              required
              onChange={(event) => updateValue('progress', event.target.value)}
            >
              <option value="">選択してください</option>
              {WORK_REPORT_PROGRESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {errors.length > 0 && (
            <div className="work-report-edit-error" role="alert">
              <strong>入力内容を確認してください</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="work-report-edit-actions">
            <button type="submit">変更内容を確認</button>
            <button className="is-secondary" type="button" onClick={onCancel}>
              編集をキャンセル
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

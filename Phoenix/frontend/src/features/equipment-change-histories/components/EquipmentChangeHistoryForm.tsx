import { useState, type FormEvent } from 'react'

import type { Equipment } from '../../equipment-master/types'
import type { WorkReport } from '../../work-reports/types'
import { formatWorkReportDate } from '../../work-reports/workReportForm'
import {
  createEmptyEquipmentChangeHistoryForm,
  validateEquipmentChangeHistoryForm,
  type EquipmentChangeHistoryFormValues,
} from '../equipmentChangeHistoryForm'
import type {
  EquipmentChangeHistory,
  EquipmentChangeHistoryCreateInput,
  EquipmentChangeHistorySaveState,
} from '../types'
import './EquipmentChangeHistoryForm.css'

type EquipmentChangeHistoryFormProps = {
  readonly equipment: Equipment
  readonly availableReports: readonly WorkReport[]
  readonly saveState: EquipmentChangeHistorySaveState
  readonly onSave: (
    input: EquipmentChangeHistoryCreateInput,
  ) => Promise<EquipmentChangeHistory | null>
  readonly onResetSave: () => void
}

export function EquipmentChangeHistoryForm({
  equipment,
  availableReports,
  saveState,
  onSave,
  onResetSave,
}: EquipmentChangeHistoryFormProps) {
  const [values, setValues] = useState<EquipmentChangeHistoryFormValues>(
    createEmptyEquipmentChangeHistoryForm,
  )
  const [errors, setErrors] = useState<readonly string[]>([])
  const isSaving = saveState.phase === 'saving'

  function updateValue<Key extends keyof EquipmentChangeHistoryFormValues>(
    field: Key,
    value: EquipmentChangeHistoryFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors([])
    onResetSave()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateEquipmentChangeHistoryForm(
      values,
      equipment.equipment_id,
      availableReports,
    )
    if (!validation.ok) {
      setErrors(validation.errors)
      return
    }
    setErrors([])
    const saved = await onSave(validation.value)
    if (saved) {
      setValues((current) => ({
        ...current,
        improvementPoint: '',
        changeDetails: '',
        workReportId: '',
      }))
    }
  }

  return (
    <details className="equipment-change-history-form">
      <summary>改良・変更を記録</summary>
      {!equipment.is_active ? (
        <p className="equipment-change-history-form-disabled">
          使用停止中の設備には新しい改良・変更履歴を登録できません。
        </p>
      ) : (
        <form noValidate onSubmit={handleSubmit}>
          <p className="equipment-change-history-form-intro">
            通常修理は作業日報へ記録し、設備の形状・仕様・使い方を変えた場合だけ登録します。
          </p>

          <label htmlFor="equipment-change-history-date">
            <span>改良・変更日</span>
            <input
              id="equipment-change-history-date"
              type="date"
              value={values.changedOn}
              required
              onChange={(event) => updateValue('changedOn', event.target.value)}
            />
          </label>

          <label htmlFor="equipment-change-history-point">
            <span>改良ポイント</span>
            <input
              id="equipment-change-history-point"
              type="text"
              value={values.improvementPoint}
              maxLength={200}
              required
              placeholder="例：チェーンガイドの搬送安定化"
              onChange={(event) =>
                updateValue('improvementPoint', event.target.value)
              }
            />
          </label>

          <label htmlFor="equipment-change-history-details">
            <span>変更内容</span>
            <textarea
              id="equipment-change-history-details"
              value={values.changeDetails}
              maxLength={2000}
              rows={4}
              required
              placeholder="例：樹脂ガイド形状を変更し、製品が蛇行しにくい構造へ変更した"
              onChange={(event) =>
                updateValue('changeDetails', event.target.value)
              }
            />
          </label>

          <label htmlFor="equipment-change-history-report">
            <span>関連する作業日報（任意）</span>
            <select
              id="equipment-change-history-report"
              value={values.workReportId}
              onChange={(event) =>
                updateValue('workReportId', event.target.value)
              }
            >
              <option value="">関連日報なし</option>
              {availableReports.map((report) => (
                <option key={report.id} value={report.id}>
                  {formatWorkReportDate(report.work_date)} /{' '}
                  {report.phenomenon ?? report.work_content}
                </option>
              ))}
            </select>
            <small>
              この設備の設備カルテに表示中の最新日報から選択できます。
            </small>
          </label>

          {errors.length > 0 && (
            <div className="equipment-change-history-form-errors" role="alert">
              <strong>入力内容を確認してください</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {saveState.phase === 'error' && (
            <p className="equipment-change-history-form-error" role="alert">
              {saveState.message}
            </p>
          )}
          {saveState.phase === 'saved' && (
            <p className="equipment-change-history-form-saved" role="status">
              改良・変更履歴を保存し、設備カルテを更新しました。
            </p>
          )}

          <button type="submit" disabled={isSaving}>
            {isSaving ? '保存中…' : '改良・変更履歴を保存'}
          </button>
        </form>
      )}
    </details>
  )
}

import { useState, type FormEvent } from 'react'

import type { Equipment } from '../../equipment-master/types'
import { getEquipmentDisplayName } from '../../equipment-master/components/equipmentMasterView'
import {
  INSPECTION_CYCLE_OPTIONS,
  INSPECTION_INPUT_TYPE_OPTIONS,
  type InspectionCycle,
  type InspectionInputType,
  type InspectionTemplateCreateInput,
  type InspectionTemplateItem,
  type InspectionTemplateSaveState,
} from '../types'

type InspectionTemplateFormProps = {
  readonly equipment: Equipment
  readonly canSave: boolean
  readonly saveState: InspectionTemplateSaveState
  readonly onSave: (
    input: InspectionTemplateCreateInput,
  ) => Promise<InspectionTemplateItem | null>
  readonly onResetSave: () => void
}

type FormValues = {
  readonly cycle: InspectionCycle
  readonly name: string
  readonly inputType: InspectionInputType
  readonly unit: string
  readonly normalMin: string
  readonly normalMax: string
  readonly normalState: string
  readonly checkMethod: string
  readonly cautionNote: string
  readonly displayOrder: string
  readonly isActive: boolean
}

const EMPTY_FORM: FormValues = {
  cycle: 'daily',
  name: '',
  inputType: 'number',
  unit: '',
  normalMin: '',
  normalMax: '',
  normalState: '',
  checkMethod: '',
  cautionNote: '',
  displayOrder: '10',
  isActive: true,
}

export function InspectionTemplateForm({
  equipment,
  canSave,
  saveState,
  onSave,
  onResetSave,
}: InspectionTemplateFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM)
  const [errors, setErrors] = useState<readonly string[]>([])

  function updateValue<Key extends keyof FormValues>(
    field: Key,
    value: FormValues[Key],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors([])
    onResetSave()
  }

  function updateInputType(inputType: InspectionInputType) {
    setValues((current) => ({
      ...current,
      inputType,
      unit: inputType === 'number' ? current.unit : '',
      normalMin: inputType === 'number' ? current.normalMin : '',
      normalMax: inputType === 'number' ? current.normalMax : '',
      normalState: inputType === 'status' ? current.normalState : '',
    }))
    setErrors([])
    onResetSave()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: string[] = []
    const name = values.name.trim()
    const unit = values.unit.trim()
    const normalState = values.normalState.trim()
    const checkMethod = values.checkMethod.trim()
    const cautionNote = values.cautionNote.trim()
    const displayOrder = Number(values.displayOrder)
    let normalMin: number | null = null
    let normalMax: number | null = null

    if (!name) {
      nextErrors.push('点検項目名を入力してください。')
    } else if (name.length > 100) {
      nextErrors.push('点検項目名は100文字以内で入力してください。')
    }
    if (unit.length > 30) {
      nextErrors.push('単位は30文字以内で入力してください。')
    }
    if (checkMethod.length > 300) {
      nextErrors.push('確認方法は300文字以内で入力してください。')
    }
    if (cautionNote.length > 300) {
      nextErrors.push('注意事項・引継ぎ条件は300文字以内で入力してください。')
    }
    if (
      !Number.isInteger(displayOrder) ||
      displayOrder < 0 ||
      displayOrder > 9999
    ) {
      nextErrors.push('表示順は0～9999の整数で入力してください。')
    }
    if (values.inputType === 'number') {
      if (!values.normalMin.trim() || !values.normalMax.trim()) {
        nextErrors.push('数値項目には正常下限と正常上限を入力してください。')
      } else {
        normalMin = Number(values.normalMin)
        normalMax = Number(values.normalMax)
        if (!Number.isFinite(normalMin) || !Number.isFinite(normalMax)) {
          nextErrors.push('正常範囲は数値で入力してください。')
        } else if (
          Math.abs(normalMin) > 999_999_999 ||
          Math.abs(normalMax) > 999_999_999
        ) {
          nextErrors.push('正常範囲は±999999999以内で入力してください。')
        } else if (normalMin > normalMax) {
          nextErrors.push('正常下限は正常上限以下にしてください。')
        }
      }
    } else if (!normalState) {
      nextErrors.push('状態項目には正常状態を入力してください。')
    } else if (normalState.length > 100) {
      nextErrors.push('正常状態は100文字以内で入力してください。')
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors([])
    const saved = await onSave({
      equipmentId: equipment.equipment_id,
      cycle: values.cycle,
      name,
      inputType: values.inputType,
      unit,
      normalMin,
      normalMax,
      normalState,
      checkMethod,
      cautionNote,
      displayOrder,
      isActive: values.isActive,
    })
    if (saved) {
      setValues((current) => ({
        ...current,
        name: '',
        unit: '',
        normalMin: '',
        normalMax: '',
        normalState: '',
        checkMethod: '',
        cautionNote: '',
      }))
    }
  }

  return (
    <article className="inspection-template-form-card">
      <div className="inspection-template-card-heading">
        <span>1</span>
        <div>
          <h4>点検項目を登録</h4>
          <p>
            {getEquipmentDisplayName(equipment)}専用の確認項目を設定します。
          </p>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit}>
        <div className="inspection-template-field-grid">
          <label htmlFor="inspection-template-cycle">
            <span>点検周期</span>
            <select
              id="inspection-template-cycle"
              value={values.cycle}
              onChange={(event) =>
                updateValue('cycle', event.target.value as InspectionCycle)
              }
            >
              {INSPECTION_CYCLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="inspection-template-input-type">
            <span>入力形式</span>
            <select
              id="inspection-template-input-type"
              value={values.inputType}
              onChange={(event) =>
                updateInputType(event.target.value as InspectionInputType)
              }
            >
              {INSPECTION_INPUT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label htmlFor="inspection-template-name">
          <span>点検項目名</span>
          <input
            id="inspection-template-name"
            type="text"
            maxLength={100}
            value={values.name}
            placeholder="例：モーター電流"
            onChange={(event) => updateValue('name', event.target.value)}
          />
        </label>

        {values.inputType === 'number' ? (
          <div className="inspection-template-number-fields">
            <label htmlFor="inspection-template-unit">
              <span>単位（任意）</span>
              <input
                id="inspection-template-unit"
                type="text"
                maxLength={30}
                value={values.unit}
                placeholder="例：A"
                onChange={(event) => updateValue('unit', event.target.value)}
              />
            </label>
            <label htmlFor="inspection-template-normal-min">
              <span>正常下限</span>
              <input
                id="inspection-template-normal-min"
                type="number"
                inputMode="decimal"
                step="any"
                value={values.normalMin}
                placeholder="例：10"
                onChange={(event) =>
                  updateValue('normalMin', event.target.value)
                }
              />
            </label>
            <label htmlFor="inspection-template-normal-max">
              <span>正常上限</span>
              <input
                id="inspection-template-normal-max"
                type="number"
                inputMode="decimal"
                step="any"
                value={values.normalMax}
                placeholder="例：15"
                onChange={(event) =>
                  updateValue('normalMax', event.target.value)
                }
              />
            </label>
          </div>
        ) : (
          <label htmlFor="inspection-template-normal-state">
            <span>正常状態</span>
            <input
              id="inspection-template-normal-state"
              type="text"
              maxLength={100}
              value={values.normalState}
              placeholder="例：異音・振動なし"
              onChange={(event) =>
                updateValue('normalState', event.target.value)
              }
            />
          </label>
        )}

        <label htmlFor="inspection-template-check-method">
          <span>確認方法（任意）</span>
          <textarea
            id="inspection-template-check-method"
            maxLength={300}
            rows={4}
            value={values.checkMethod}
            placeholder="例：操作盤の電流表示を運転中に確認する"
            onChange={(event) => updateValue('checkMethod', event.target.value)}
          />
        </label>

        <label htmlFor="inspection-template-caution-note">
          <span>注意事項・引継ぎ条件（任意）</span>
          <textarea
            id="inspection-template-caution-note"
            maxLength={300}
            rows={4}
            value={values.cautionNote}
            placeholder="例：回転部へ手を近づけない。異常時は経験者へ引き継ぐ"
            onChange={(event) => updateValue('cautionNote', event.target.value)}
          />
          <small className="inspection-template-safety-hint">
            危険作業は会社固有の安全手順を優先し、実施者の境界が分かる内容にします。
          </small>
        </label>

        <div className="inspection-template-field-grid">
          <label htmlFor="inspection-template-display-order">
            <span>表示順</span>
            <input
              id="inspection-template-display-order"
              type="number"
              inputMode="numeric"
              min="0"
              max="9999"
              step="1"
              value={values.displayOrder}
              onChange={(event) =>
                updateValue('displayOrder', event.target.value)
              }
            />
          </label>
          <label className="inspection-template-active-field">
            <span>使用状態</span>
            <span>
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(event) =>
                  updateValue('isActive', event.target.checked)
                }
              />
              点検項目として使用する
            </span>
          </label>
        </div>

        {errors.length > 0 && (
          <div className="inspection-template-errors" role="alert">
            <strong>入力内容を確認してください</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {saveState.phase === 'error' && (
          <p className="inspection-template-save-error" role="alert">
            {saveState.message}
          </p>
        )}
        {saveState.phase === 'saved' && (
          <p className="inspection-template-save-success" role="status">
            「{saveState.item.name}」を
            {INSPECTION_CYCLE_OPTIONS.find(
              (option) => option.value === saveState.item.cycle,
            )?.label ?? saveState.item.cycle}
            点検へ追加しました。
          </p>
        )}
        <button
          className="inspection-template-submit"
          type="submit"
          disabled={!canSave || saveState.phase === 'saving'}
        >
          {saveState.phase === 'saving' ? '登録しています…' : '点検項目を登録'}
        </button>
      </form>
    </article>
  )
}

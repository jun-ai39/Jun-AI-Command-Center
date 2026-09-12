import { useState, type FormEvent } from 'react'

import type {
  Department,
  Equipment,
  EquipmentCreateInput,
  Manufacturer,
  SaveState,
} from '../types'
import { getEquipmentDisplayName } from './equipmentMasterView'

type EquipmentFormValues = {
  readonly departmentId: string
  readonly manufacturerId: string
  readonly name: string
  readonly equipmentNumber: string
  readonly modelNumber: string
}

type EquipmentRegistrationFormProps = {
  readonly departments: readonly Department[]
  readonly manufacturers: readonly Manufacturer[]
  readonly preferredManufacturerId: string
  readonly saveState: SaveState<Equipment>
  readonly onSave: (input: EquipmentCreateInput) => Promise<Equipment | null>
  readonly onResetSave: () => void
}

const EMPTY_FORM: EquipmentFormValues = {
  departmentId: '',
  manufacturerId: '',
  name: '',
  equipmentNumber: '',
  modelNumber: '',
}

export function EquipmentRegistrationForm({
  departments,
  manufacturers,
  preferredManufacturerId,
  saveState,
  onSave,
  onResetSave,
}: EquipmentRegistrationFormProps) {
  const [values, setValues] = useState<EquipmentFormValues>(EMPTY_FORM)
  const [errors, setErrors] = useState<readonly string[]>([])
  const selectedDepartmentId =
    values.departmentId || departments.at(0)?.id || ''
  const selectedManufacturerId =
    values.manufacturerId ||
    preferredManufacturerId ||
    manufacturers.at(0)?.id ||
    ''
  const hasManufacturer = manufacturers.length > 0

  function updateValue(field: keyof EquipmentFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors([])
    onResetSave()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: string[] = []
    const name = values.name.trim()
    const equipmentNumber = values.equipmentNumber.trim()
    const modelNumber = values.modelNumber.trim()
    if (!selectedDepartmentId) {
      nextErrors.push('部門を選択してください。')
    }
    if (!selectedManufacturerId) {
      nextErrors.push('メーカーを選択してください。')
    }
    if (!name) {
      nextErrors.push('設備名を入力してください。')
    } else if (name.length > 100) {
      nextErrors.push('設備名は100文字以内で入力してください。')
    }
    if (equipmentNumber.length > 100) {
      nextErrors.push('設備番号／呼称は100文字以内で入力してください。')
    }
    if (modelNumber.length > 100) {
      nextErrors.push('型式は100文字以内で入力してください。')
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors([])
    const saved = await onSave({
      departmentId: selectedDepartmentId,
      manufacturerId: selectedManufacturerId,
      name,
      equipmentNumber,
      modelNumber,
    })
    if (saved) {
      setValues((current) => ({
        ...current,
        name: '',
        equipmentNumber: '',
        modelNumber: '',
      }))
    }
  }

  return (
    <article className="equipment-master-form-card">
      <div className="equipment-master-form-heading">
        <span>2</span>
        <div>
          <h4>設備を登録</h4>
          <p>写真は設備登録後、設備カルテから登録できます。</p>
        </div>
      </div>
      <form noValidate onSubmit={handleSubmit}>
        <div className="equipment-master-field-grid">
          <label htmlFor="equipment-master-department">
            <span>部門</span>
            <select
              id="equipment-master-department"
              value={selectedDepartmentId}
              onChange={(event) =>
                updateValue('departmentId', event.target.value)
              }
            >
              <option value="">選択してください</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="equipment-master-manufacturer">
            <span>メーカー</span>
            <select
              id="equipment-master-manufacturer"
              value={selectedManufacturerId}
              disabled={!hasManufacturer}
              onChange={(event) =>
                updateValue('manufacturerId', event.target.value)
              }
            >
              <option value="">選択してください</option>
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!hasManufacturer && (
          <p className="equipment-master-hint">
            先にメーカーを1件登録してください。
          </p>
        )}

        <label htmlFor="equipment-master-equipment-name">
          <span>設備名</span>
          <input
            id="equipment-master-equipment-name"
            type="text"
            value={values.name}
            maxLength={100}
            placeholder="例：包装機"
            onChange={(event) => updateValue('name', event.target.value)}
          />
        </label>

        <div className="equipment-master-field-grid">
          <label htmlFor="equipment-master-equipment-number">
            <span>設備番号／呼称（任意）</span>
            <input
              id="equipment-master-equipment-number"
              type="text"
              value={values.equipmentNumber}
              maxLength={100}
              placeholder="例：No.2"
              onChange={(event) =>
                updateValue('equipmentNumber', event.target.value)
              }
            />
          </label>
          <label htmlFor="equipment-master-model-number">
            <span>型式（任意）</span>
            <input
              id="equipment-master-model-number"
              type="text"
              value={values.modelNumber}
              maxLength={100}
              placeholder="例：TEST-200"
              onChange={(event) =>
                updateValue('modelNumber', event.target.value)
              }
            />
          </label>
        </div>

        {errors.length > 0 && (
          <div className="equipment-master-errors" role="alert">
            <strong>入力内容を確認してください</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {saveState.phase === 'error' && (
          <p className="equipment-master-field-error" role="alert">
            {saveState.message}
          </p>
        )}
        {saveState.phase === 'saved' && (
          <p className="equipment-master-save-success" role="status">
            「{getEquipmentDisplayName(saveState.item)}」を登録し、設備ツリーへ
            追加しました。
          </p>
        )}
        <button
          className="equipment-master-submit"
          type="submit"
          disabled={!hasManufacturer || saveState.phase === 'saving'}
        >
          {saveState.phase === 'saving' ? '登録しています…' : '設備を登録'}
        </button>
      </form>
    </article>
  )
}

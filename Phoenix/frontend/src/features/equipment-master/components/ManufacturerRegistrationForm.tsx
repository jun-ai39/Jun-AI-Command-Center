import { useState, type FormEvent } from 'react'

import type { Manufacturer, ManufacturerCreateInput, SaveState } from '../types'

type ManufacturerRegistrationFormProps = {
  readonly saveState: SaveState<Manufacturer>
  readonly onSave: (
    input: ManufacturerCreateInput,
  ) => Promise<Manufacturer | null>
  readonly onSaved: (manufacturer: Manufacturer) => void
  readonly onResetSave: () => void
}

export function ManufacturerRegistrationForm({
  saveState,
  onSave,
  onSaved,
  onResetSave,
}: ManufacturerRegistrationFormProps) {
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim()
    if (!normalizedName) {
      setValidationError('メーカー名を入力してください。')
      return
    }
    if (normalizedName.length > 100) {
      setValidationError('メーカー名は100文字以内で入力してください。')
      return
    }
    setValidationError(null)
    const saved = await onSave({ name: normalizedName })
    if (saved) {
      setName('')
      onSaved(saved)
    }
  }

  return (
    <article className="equipment-master-form-card">
      <div className="equipment-master-form-heading">
        <span>1</span>
        <div>
          <h4>メーカーを登録</h4>
          <p>登録済みなら次の設備登録へ進めます。</p>
        </div>
      </div>
      <form noValidate onSubmit={handleSubmit}>
        <label htmlFor="equipment-master-manufacturer-name">
          <span>メーカー名</span>
          <input
            id="equipment-master-manufacturer-name"
            type="text"
            value={name}
            maxLength={100}
            placeholder="例：架空Aメーカー"
            onChange={(event) => {
              setName(event.target.value)
              setValidationError(null)
              onResetSave()
            }}
          />
        </label>
        {validationError && (
          <p className="equipment-master-field-error" role="alert">
            {validationError}
          </p>
        )}
        {saveState.phase === 'error' && (
          <p className="equipment-master-field-error" role="alert">
            {saveState.message}
          </p>
        )}
        {saveState.phase === 'saved' && (
          <p className="equipment-master-save-success" role="status">
            「{saveState.item.name}」を登録しました。
          </p>
        )}
        <button
          className="equipment-master-submit"
          type="submit"
          disabled={saveState.phase === 'saving'}
        >
          {saveState.phase === 'saving' ? '登録しています…' : 'メーカーを登録'}
        </button>
      </form>
    </article>
  )
}

import { useState, type FormEvent } from 'react'

import {
  INSPECTION_CYCLE_OPTIONS,
  type InspectionTemplateCollectionState,
  type InspectionTemplateGuideSaveState,
  type InspectionTemplateGuideUpdateInput,
  type InspectionTemplateItem,
} from '../types'

type InspectionTemplateListProps = {
  readonly state: InspectionTemplateCollectionState
  readonly guideSaveState: InspectionTemplateGuideSaveState
  readonly onReload: () => void
  readonly onSaveGuide: (
    input: InspectionTemplateGuideUpdateInput,
  ) => Promise<InspectionTemplateItem | null>
  readonly onResetGuideSave: () => void
}

type InspectionTemplateGuideEditorProps = {
  readonly item: InspectionTemplateItem
  readonly saveState: InspectionTemplateGuideSaveState
  readonly onSave: (
    input: InspectionTemplateGuideUpdateInput,
  ) => Promise<InspectionTemplateItem | null>
  readonly onResetSave: () => void
  readonly onCancel: () => void
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 3 }).format(
    value,
  )
}

function getNormalRule(item: InspectionTemplateItem): string {
  if (
    item.input_type === 'number' &&
    item.normal_min !== null &&
    item.normal_max !== null
  ) {
    return `${formatNumber(item.normal_min)} ～ ${formatNumber(item.normal_max)}${item.unit ? ` ${item.unit}` : ''}`
  }
  return item.normal_state ?? '基準未登録'
}

export function InspectionTemplateGuideEditor({
  item,
  saveState,
  onSave,
  onResetSave,
  onCancel,
}: InspectionTemplateGuideEditorProps) {
  const [checkMethod, setCheckMethod] = useState(item.check_method ?? '')
  const [cautionNote, setCautionNote] = useState(item.caution_note ?? '')
  const [errors, setErrors] = useState<readonly string[]>([])
  const isSaving = saveState.phase === 'saving' && saveState.itemId === item.id
  const isSaved = saveState.phase === 'saved' && saveState.item.id === item.id
  const saveError =
    saveState.phase === 'error' && saveState.itemId === item.id
      ? saveState.message
      : null

  function updateCheckMethod(value: string) {
    setCheckMethod(value)
    setErrors([])
    onResetSave()
  }

  function updateCautionNote(value: string) {
    setCautionNote(value)
    setErrors([])
    onResetSave()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: string[] = []
    if (checkMethod.trim().length > 300) {
      nextErrors.push('確認方法は300文字以内で入力してください。')
    }
    if (cautionNote.trim().length > 300) {
      nextErrors.push('注意事項・引継ぎ条件は300文字以内で入力してください。')
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors([])
    await onSave({
      itemId: item.id,
      checkMethod,
      cautionNote,
    })
  }

  return (
    <form
      className="inspection-template-guide-editor"
      noValidate
      onSubmit={handleSubmit}
    >
      <label htmlFor={`inspection-template-guide-method-${item.id}`}>
        <span>確認方法</span>
        <textarea
          id={`inspection-template-guide-method-${item.id}`}
          maxLength={300}
          rows={4}
          value={checkMethod}
          placeholder="確認する場所と手順"
          disabled={isSaving}
          onChange={(event) => updateCheckMethod(event.target.value)}
        />
      </label>
      <label htmlFor={`inspection-template-guide-caution-${item.id}`}>
        <span>注意事項・引継ぎ条件</span>
        <textarea
          id={`inspection-template-guide-caution-${item.id}`}
          maxLength={300}
          rows={4}
          value={cautionNote}
          placeholder="危険事項と経験者へ引き継ぐ条件"
          disabled={isSaving}
          onChange={(event) => updateCautionNote(event.target.value)}
        />
      </label>
      <small>
        空欄で保存すると、そのガイド情報を未登録へ戻します。会社固有の安全手順を優先してください。
      </small>
      {errors.length > 0 && (
        <div
          className="inspection-template-guide-message is-error"
          role="alert"
        >
          {errors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </div>
      )}
      {saveError && (
        <p className="inspection-template-guide-message is-error" role="alert">
          {saveError}
        </p>
      )}
      {isSaved && (
        <p
          className="inspection-template-guide-message is-success"
          role="status"
        >
          ガイドを保存しました。
        </p>
      )}
      <div className="inspection-template-guide-actions">
        <button type="button" disabled={isSaving} onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" disabled={isSaving}>
          {isSaving ? '保存しています…' : 'ガイドを保存'}
        </button>
      </div>
    </form>
  )
}

export function InspectionTemplateList({
  state,
  guideSaveState,
  onReload,
  onSaveGuide,
  onResetGuideSave,
}: InspectionTemplateListProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  function toggleGuideEditor(itemId: string) {
    onResetGuideSave()
    setEditingItemId((current) => (current === itemId ? null : itemId))
  }

  function closeGuideEditor() {
    onResetGuideSave()
    setEditingItemId(null)
  }

  return (
    <article className="inspection-template-list-card">
      <div className="inspection-template-list-heading">
        <div>
          <span>REGISTERED ITEMS</span>
          <h4>登録済み点検項目</h4>
        </div>
        {state.phase === 'ready' && (
          <small>
            登録{state.total}件／表示{state.items.length}件
          </small>
        )}
      </div>

      {state.phase === 'loading' && (
        <p className="inspection-template-state" role="status">
          点検項目を読み込んでいます…
        </p>
      )}
      {state.phase === 'error' && (
        <div className="inspection-template-state is-error" role="alert">
          <p>点検項目を読み込めませんでした。</p>
          <button type="button" onClick={onReload}>
            もう一度読み込む
          </button>
        </div>
      )}
      {state.phase === 'ready' && state.items.length === 0 && (
        <p className="inspection-template-state">
          この設備の点検項目はまだ登録されていません。
        </p>
      )}
      {state.phase === 'ready' && state.items.length > 0 && (
        <div className="inspection-template-cycle-grid">
          {INSPECTION_CYCLE_OPTIONS.map((cycle) => {
            const items = state.items.filter(
              (item) => item.cycle === cycle.value,
            )
            return (
              <section key={cycle.value}>
                <div className="inspection-template-cycle-heading">
                  <h5>{cycle.label}</h5>
                  <span>{items.length}項目</span>
                </div>
                {items.length === 0 ? (
                  <p>未登録</p>
                ) : (
                  <ol>
                    {items.map((item) => (
                      <li key={item.id}>
                        <div className="inspection-template-item-heading">
                          <strong>{item.name}</strong>
                          <span>
                            {item.input_type === 'number' ? '数値' : '状態'}
                          </span>
                        </div>
                        <p className="inspection-template-normal-rule">
                          正常基準：{getNormalRule(item)}
                        </p>
                        <div className="inspection-template-guide-summary">
                          <p>
                            <span>確認方法</span>
                            {item.check_method ?? '未登録'}
                          </p>
                          <p className={item.caution_note ? 'has-caution' : ''}>
                            <span>注意・引継ぎ</span>
                            {item.caution_note ?? '未登録'}
                          </p>
                        </div>
                        <small>
                          表示順 {item.display_order}／
                          {item.is_active ? '使用中' : '使用停止'}
                        </small>
                        <button
                          className="inspection-template-guide-edit-button"
                          type="button"
                          aria-expanded={editingItemId === item.id}
                          onClick={() => toggleGuideEditor(item.id)}
                        >
                          {editingItemId === item.id
                            ? 'ガイド編集を閉じる'
                            : 'ガイドを編集'}
                        </button>
                        {editingItemId === item.id && (
                          <InspectionTemplateGuideEditor
                            key={item.id}
                            item={item}
                            saveState={guideSaveState}
                            onSave={onSaveGuide}
                            onResetSave={onResetGuideSave}
                            onCancel={closeGuideEditor}
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )
          })}
        </div>
      )}
    </article>
  )
}

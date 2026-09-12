import { useMemo, useState, type FormEvent } from 'react'

import type { Equipment } from '../../equipment-master/types'
import { useTroubleshootingGuideCreate } from '../hooks/useTroubleshootingGuideCreate'
import {
  buildTroubleshootingGuideCreateInput,
  COMPLETE_TARGET,
  createInitialTroubleshootingGuideFormValues,
  HANDOFF_TARGET,
  MAX_TROUBLESHOOTING_QUESTIONS,
  type TroubleshootingGuideFormValues,
  type TroubleshootingQuestionDraft,
  validateTroubleshootingGuideForm,
} from '../troubleshootingGuideForm'
import type { TroubleshootingGuide } from '../types'
import './TroubleshootingGuideRegistrationForm.css'

type TroubleshootingGuideRegistrationFormProps = {
  readonly equipment: readonly Equipment[]
  readonly onCancel: () => void
  readonly onSaved: (guide: TroubleshootingGuide) => void
}

type QuestionPatch = Partial<Omit<TroubleshootingQuestionDraft, 'key'>>

function equipmentLabel(equipment: Equipment): string {
  return [equipment.name, equipment.equipment_number].filter(Boolean).join(' ')
}

function targetLabel(
  target: string,
  questions: readonly TroubleshootingQuestionDraft[],
): string {
  if (target === COMPLETE_TARGET) return '完了'
  if (target === HANDOFF_TARGET) return '引継ぎ'
  const index = questions.findIndex((question) => question.key === target)
  return index >= 0 ? `質問 ${index + 1}` : '無効な行き先'
}

export function TroubleshootingGuideRegistrationForm({
  equipment,
  onCancel,
  onSaved,
}: TroubleshootingGuideRegistrationFormProps) {
  const [values, setValues] = useState<TroubleshootingGuideFormValues>(() =>
    createInitialTroubleshootingGuideFormValues(),
  )
  const [showValidation, setShowValidation] = useState(false)
  const { saveState, saveGuide, resetSave } = useTroubleshootingGuideCreate()
  const errors = useMemo(
    () => validateTroubleshootingGuideForm(values),
    [values],
  )
  const isSaving = saveState.phase === 'saving'

  function changeValues(
    update: (
      current: TroubleshootingGuideFormValues,
    ) => TroubleshootingGuideFormValues,
  ) {
    resetSave()
    setValues(update)
  }

  function updateQuestion(index: number, patch: QuestionPatch) {
    changeValues((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    }))
  }

  function addQuestion() {
    if (values.questions.length >= MAX_TROUBLESHOOTING_QUESTIONS) return
    const nextNumber = values.questions.length + 1
    changeValues((current) => ({
      ...current,
      questions: [
        ...current.questions,
        {
          key: `question-${nextNumber}`,
          prompt: '',
          checkMethod: '',
          cautionNote: '',
          yesTarget: COMPLETE_TARGET,
          noTarget: HANDOFF_TARGET,
        },
      ],
    }))
    setShowValidation(true)
  }

  function removeLastQuestion() {
    if (values.questions.length <= 1) return
    const removedKey = values.questions.at(-1)!.key
    changeValues((current) => ({
      ...current,
      questions: current.questions.slice(0, -1).map((question) => ({
        ...question,
        yesTarget:
          question.yesTarget === removedKey
            ? HANDOFF_TARGET
            : question.yesTarget,
        noTarget:
          question.noTarget === removedKey ? HANDOFF_TARGET : question.noTarget,
      })),
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setShowValidation(true)
    if (errors.length > 0 || isSaving) return
    const input = buildTroubleshootingGuideCreateInput(values)
    const saved = await saveGuide(input)
    if (saved) onSaved(saved)
  }

  return (
    <form
      className="troubleshooting-registration"
      aria-labelledby="troubleshooting-registration-title"
      onSubmit={submit}
      noValidate
    >
      <div className="troubleshooting-registration-heading">
        <div>
          <span>ADMIN GUIDE</span>
          <h3 id="troubleshooting-registration-title">新しいガイドを登録</h3>
        </div>
        <p>設備・質問・終点を確認し、分岐全体を一度に保存します。</p>
      </div>

      <ol
        className="troubleshooting-registration-progress"
        aria-label="登録手順"
      >
        <li>
          <span>1</span>基本情報
        </li>
        <li>
          <span>2</span>質問と分岐
        </li>
        <li>
          <span>3</span>完了・引継ぎ
        </li>
        <li>
          <span>4</span>保存前確認
        </li>
      </ol>

      <div className="troubleshooting-registration-layout">
        <div className="troubleshooting-registration-editor">
          <section>
            <div className="troubleshooting-registration-section-heading">
              <div>
                <h4>基本情報</h4>
                <p>どの設備の、どの症状に使うかを決めます。</p>
              </div>
              <span>STEP 1</span>
            </div>
            <div className="troubleshooting-registration-field-grid">
              <label>
                <span>
                  対象設備<small>必須</small>
                </span>
                <select
                  id="troubleshooting-registration-equipment"
                  value={values.equipmentId}
                  disabled={isSaving}
                  onChange={(event) =>
                    changeValues((current) => ({
                      ...current,
                      equipmentId: event.target.value,
                    }))
                  }
                >
                  <option value="">設備を選択</option>
                  {equipment.map((item) => (
                    <option key={item.equipment_id} value={item.equipment_id}>
                      {equipmentLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="troubleshooting-registration-active">
                <span>使用状態</span>
                <span>
                  <input
                    id="troubleshooting-registration-active"
                    type="checkbox"
                    checked={values.isActive}
                    disabled={isSaving}
                    onChange={(event) =>
                      changeValues((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  登録後すぐに使用する
                </span>
              </label>
              <label className="is-wide">
                <span>
                  症状<small>必須</small>
                </span>
                <input
                  id="troubleshooting-registration-symptom"
                  value={values.symptom}
                  maxLength={200}
                  disabled={isSaving}
                  onChange={(event) =>
                    changeValues((current) => ({
                      ...current,
                      symptom: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <details className="troubleshooting-registration-advanced">
              <summary>詳細設定（通常は変更不要）</summary>
              <label>
                <span>表示順</span>
                <input
                  id="troubleshooting-registration-display-order"
                  type="number"
                  min="0"
                  max="9999"
                  value={values.displayOrder}
                  disabled={isSaving}
                  onChange={(event) =>
                    changeValues((current) => ({
                      ...current,
                      displayOrder: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </details>
          </section>

          <section>
            <div className="troubleshooting-registration-section-heading">
              <div>
                <h4>質問と分岐</h4>
                <p>YES・NOは後続質問または終点だけを選べます。</p>
              </div>
              <span>STEP 2</span>
            </div>
            <div className="troubleshooting-registration-questions">
              {values.questions.map((question, index) => {
                const targetOptions = [
                  ...values.questions
                    .slice(index + 1)
                    .map((item, laterIndex) => ({
                      value: item.key,
                      label: `質問 ${index + laterIndex + 2}`,
                    })),
                  { value: COMPLETE_TARGET, label: '完了' },
                  { value: HANDOFF_TARGET, label: '引継ぎ' },
                ]
                return (
                  <article key={question.key}>
                    <div className="troubleshooting-registration-question-heading">
                      <strong>質問 {index + 1}</strong>
                      <small>{index === 0 ? '開始位置' : '後続の確認'}</small>
                    </div>
                    <label>
                      <span>
                        質問文<small>必須</small>
                      </span>
                      <input
                        id={`troubleshooting-question-${index + 1}-prompt`}
                        value={question.prompt}
                        maxLength={500}
                        disabled={isSaving}
                        onChange={(event) =>
                          updateQuestion(index, { prompt: event.target.value })
                        }
                      />
                    </label>
                    <div className="troubleshooting-registration-field-grid">
                      <label>
                        <span>確認方法</span>
                        <textarea
                          id={`troubleshooting-question-${index + 1}-method`}
                          value={question.checkMethod}
                          maxLength={500}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateQuestion(index, {
                              checkMethod: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>注意・安全境界</span>
                        <textarea
                          id={`troubleshooting-question-${index + 1}-caution`}
                          value={question.cautionNote}
                          maxLength={500}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateQuestion(index, {
                              cautionNote: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="troubleshooting-registration-branches">
                      <label className="is-yes">
                        <span>YESの行き先</span>
                        <select
                          value={question.yesTarget}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateQuestion(index, {
                              yesTarget: event.target.value,
                            })
                          }
                        >
                          {targetOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="is-no">
                        <span>NOの行き先</span>
                        <select
                          value={question.noTarget}
                          disabled={isSaving}
                          onChange={(event) =>
                            updateQuestion(index, {
                              noTarget: event.target.value,
                            })
                          }
                        >
                          {targetOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="is-unknown">
                        <span>不明の行き先</span>
                        <select disabled>
                          <option>引継ぎ（固定）</option>
                        </select>
                      </label>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="troubleshooting-registration-editor-actions">
              <button
                type="button"
                disabled={
                  isSaving ||
                  values.questions.length >= MAX_TROUBLESHOOTING_QUESTIONS
                }
                onClick={addQuestion}
              >
                質問を追加
              </button>
              <button
                className="is-danger"
                type="button"
                disabled={isSaving || values.questions.length <= 1}
                onClick={removeLastQuestion}
              >
                最後の質問を削除
              </button>
            </div>
            <p className="troubleshooting-registration-limit">
              1ガイド最大{MAX_TROUBLESHOOTING_QUESTIONS}
              問です。長い場合は症状を分けてください。
            </p>
          </section>

          <section>
            <div className="troubleshooting-registration-section-heading">
              <div>
                <h4>完了・引継ぎ</h4>
                <p>現場へ表示する終点を1つずつ設定します。</p>
              </div>
              <span>STEP 3</span>
            </div>
            <div className="troubleshooting-registration-terminals">
              <div className="is-complete">
                <h5>完了</h5>
                <label>
                  <span>
                    表示内容<small>必須</small>
                  </span>
                  <textarea
                    id="troubleshooting-registration-complete"
                    value={values.completePrompt}
                    maxLength={500}
                    disabled={isSaving}
                    onChange={(event) =>
                      changeValues((current) => ({
                        ...current,
                        completePrompt: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="is-handoff">
                <h5>引継ぎ</h5>
                <label>
                  <span>
                    引継ぎ内容<small>必須</small>
                  </span>
                  <textarea
                    id="troubleshooting-registration-handoff"
                    value={values.handoffPrompt}
                    maxLength={500}
                    disabled={isSaving}
                    onChange={(event) =>
                      changeValues((current) => ({
                        ...current,
                        handoffPrompt: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>
                    安全上の注意<small>必須</small>
                  </span>
                  <textarea
                    id="troubleshooting-registration-handoff-caution"
                    value={values.handoffCaution}
                    maxLength={500}
                    disabled={isSaving}
                    onChange={(event) =>
                      changeValues((current) => ({
                        ...current,
                        handoffCaution: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        <aside className="troubleshooting-registration-preview">
          <div className="troubleshooting-registration-section-heading">
            <div>
              <h4>保存前確認</h4>
              <p>未入力・未到達・危険な分岐を確認します。</p>
            </div>
            <span>STEP 4</span>
          </div>
          <div
            className={`troubleshooting-registration-validation ${errors.length === 0 ? 'is-valid' : ''}`}
          >
            <strong>
              {errors.length === 0
                ? '保存できる設計です'
                : showValidation
                  ? `確認が必要です（${errors.length}件）`
                  : '必須項目を入力してください'}
            </strong>
            {errors.length === 0 ? (
              <ul>
                <li>全質問へ開始位置から到達できます。</li>
                <li>前の質問へ戻らないため循環しません。</li>
                <li>不明はすべて引継ぎへ固定されています。</li>
                <li>完了と引継ぎの両方へ到達できます。</li>
              </ul>
            ) : showValidation ? (
              <ul>
                {errors.map((error) => (
                  <li className="is-error" key={error}>
                    {error}
                  </li>
                ))}
              </ul>
            ) : (
              <p>入力後に「分岐を再確認」を押してください。</p>
            )}
          </div>
          <ol className="troubleshooting-registration-flow">
            {values.questions.map((question, index) => (
              <li key={question.key}>
                <span>
                  質問 {index + 1}
                  {index === 0 ? '・開始' : ''}
                </span>
                <strong>
                  {question.prompt.trim() || '質問文が未入力です'}
                </strong>
                <dl>
                  <div>
                    <dt>YES</dt>
                    <dd>{targetLabel(question.yesTarget, values.questions)}</dd>
                  </div>
                  <div>
                    <dt>NO</dt>
                    <dd>{targetLabel(question.noTarget, values.questions)}</dd>
                  </div>
                  <div>
                    <dt>不明</dt>
                    <dd>引継ぎ（固定）</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
          <div className="troubleshooting-registration-terminal-preview">
            <div>
              <span>完了</span>
              <strong>
                {values.completePrompt.trim() || '表示内容が未入力です'}
              </strong>
            </div>
            <div>
              <span>引継ぎ</span>
              <strong>
                {values.handoffPrompt.trim() || '引継ぎ内容が未入力です'}
              </strong>
            </div>
          </div>
          {saveState.phase === 'error' && (
            <p className="troubleshooting-registration-save-error" role="alert">
              {saveState.message}
            </p>
          )}
          <div className="troubleshooting-registration-preview-actions">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setShowValidation(true)}
            >
              分岐を再確認
            </button>
            <button
              className="is-primary"
              type="submit"
              disabled={isSaving || errors.length > 0}
            >
              {isSaving ? 'ガイドを保存中…' : 'この内容で登録'}
            </button>
            <button type="button" disabled={isSaving} onClick={onCancel}>
              キャンセル
            </button>
          </div>
        </aside>
      </div>
    </form>
  )
}

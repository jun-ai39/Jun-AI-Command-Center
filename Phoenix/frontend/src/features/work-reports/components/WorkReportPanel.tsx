import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import { useWorkReportSave } from '../hooks/useWorkReportSave'
import {
  WORK_REPORT_PROGRESS_OPTIONS,
  type WorkReport,
  type WorkReportConfirmation,
  type WorkReportEquipmentOptionsState,
  type WorkReportFormValues,
  type WorkReportGuideHandoffInput,
  type WorkReportGuideHandoffRequest,
} from '../types'
import {
  formatWorkReportDate,
  getWorkReportProgressLabel,
  validateWorkReport,
} from '../workReportForm'
import {
  clearWorkReportDraft,
  createDefaultWorkReportDraft,
  isWorkReportDraftEmpty,
  loadWorkReportDraft,
  saveWorkReportDraft,
} from '../workReportDraft'
import {
  createGuideHandoffDraft,
  needsGuideHandoffConfirmation,
} from '../workReportGuideHandoff'
import {
  getSelectedDepartmentName,
  getSelectedEquipmentName,
} from '../workReportEquipment'
import { WorkReportEquipmentFields } from './WorkReportEquipmentFields'
import './WorkReportPanel.css'

type WorkReportDraftStatus =
  'idle' | 'restored' | 'saved' | 'cleared' | 'unavailable'

type WorkReportComposerState = {
  readonly values: WorkReportFormValues
  readonly draftStatus: WorkReportDraftStatus
}

type WorkReportPanelProps = {
  readonly onSaved?: (report: WorkReport) => void
  readonly equipmentOptionsState: WorkReportEquipmentOptionsState
  readonly onReloadEquipmentOptions: () => void
}

export type WorkReportPanelHandle = {
  readonly startGuideWorkReport: (input: WorkReportGuideHandoffInput) => void
}

type WorkReportGuideHandoffConflictProps = {
  readonly request: WorkReportGuideHandoffRequest
  readonly onKeepDraft: () => void
  readonly onReplaceDraft: () => void
}

export function WorkReportGuideHandoffConflict({
  request,
  onKeepDraft,
  onReplaceDraft,
}: WorkReportGuideHandoffConflictProps) {
  return (
    <div
      className="work-report-guide-conflict"
      role="alert"
      aria-labelledby="work-report-guide-conflict-title"
    >
      <span>GUIDE → RECORD</span>
      <strong id="work-report-guide-conflict-title">
        入力途中の下書きがあります
      </strong>
      <p>{`ガイドの現象「${request.phenomenon}」を引き継ぐには、現在の下書きを破棄する必要があります。`}</p>
      <div>
        <button type="button" onClick={onKeepDraft}>
          現在の下書きを維持
        </button>
        <button type="button" onClick={onReplaceDraft}>
          下書きを破棄してガイド内容を反映
        </button>
      </div>
    </div>
  )
}

export const WorkReportPanel = forwardRef<
  WorkReportPanelHandle,
  WorkReportPanelProps
>(function WorkReportPanel(
  { onSaved, equipmentOptionsState, onReloadEquipmentOptions },
  ref,
) {
  const [composerState, setComposerState] = useState<WorkReportComposerState>(
    () => {
      const values = loadWorkReportDraft()
      return {
        values,
        draftStatus: isWorkReportDraftEmpty(values) ? 'idle' : 'restored',
      }
    },
  )
  const { values, draftStatus } = composerState
  const [errors, setErrors] = useState<readonly string[]>([])
  const [confirmation, setConfirmation] =
    useState<WorkReportConfirmation | null>(null)
  const [pendingGuideHandoff, setPendingGuideHandoff] =
    useState<WorkReportGuideHandoffRequest | null>(null)
  const [guideHandoffNotice, setGuideHandoffNotice] = useState<
    'applied' | 'kept' | null
  >(null)
  const { saveState, saveWorkReport, resetWorkReportSave } = useWorkReportSave()
  const isSaving = saveState.phase === 'saving'
  const isSaved = saveState.phase === 'saved'
  const nextGuideHandoffRequestIdRef = useRef(1)

  const applyGuideHandoff = useCallback(
    (request: WorkReportGuideHandoffRequest, discardDraft = false) => {
      if (discardDraft) {
        clearWorkReportDraft()
      }
      const nextValues = createGuideHandoffDraft(request)
      const didSaveDraft = saveWorkReportDraft(nextValues)
      setComposerState({
        values: nextValues,
        draftStatus: didSaveDraft ? 'saved' : 'unavailable',
      })
      setPendingGuideHandoff(null)
      setGuideHandoffNotice('applied')
      setErrors([])
      setConfirmation(null)
      resetWorkReportSave()
    },
    [resetWorkReportSave],
  )

  useImperativeHandle(
    ref,
    () => ({
      startGuideWorkReport(input) {
        const request = {
          ...input,
          requestId: nextGuideHandoffRequestIdRef.current,
        }
        nextGuideHandoffRequestIdRef.current += 1
        if (needsGuideHandoffConfirmation(composerState.values, isSaved)) {
          setPendingGuideHandoff(request)
          setGuideHandoffNotice(null)
        } else {
          applyGuideHandoff(request)
        }
      },
    }),
    [applyGuideHandoff, composerState.values, isSaved],
  )

  function updateValues(nextValues: WorkReportFormValues) {
    const didSaveDraft = saveWorkReportDraft(nextValues)
    setComposerState({
      values: nextValues,
      draftStatus: !didSaveDraft
        ? 'unavailable'
        : isWorkReportDraftEmpty(nextValues)
          ? 'idle'
          : 'saved',
    })
    setErrors([])
    setConfirmation(null)
    resetWorkReportSave()
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
    resetWorkReportSave()
  }

  async function handleSave() {
    if (!confirmation || isSaving || isSaved) return
    const savedReport = await saveWorkReport(confirmation)
    if (savedReport) {
      const didClearDraft = clearWorkReportDraft()
      setComposerState((current) => ({
        ...current,
        draftStatus: didClearDraft ? 'cleared' : 'unavailable',
      }))
      setPendingGuideHandoff(null)
      setGuideHandoffNotice(null)
      onSaved?.(savedReport)
    }
  }

  function handleStartNewReport() {
    const didClearDraft = clearWorkReportDraft()
    setComposerState({
      values: createDefaultWorkReportDraft(),
      draftStatus: didClearDraft ? 'cleared' : 'unavailable',
    })
    setErrors([])
    setConfirmation(null)
    setPendingGuideHandoff(null)
    setGuideHandoffNotice(null)
    resetWorkReportSave()
  }

  function handleClearDraft() {
    handleStartNewReport()
  }

  return (
    <section
      id="work-report-section"
      className="work-report-section"
      aria-labelledby="work-report-title"
      tabIndex={-1}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">RECORD / STEP 94</p>
          <h2 id="work-report-title">作業日報</h2>
        </div>
        <p>7項目で記録</p>
      </div>

      <div className="work-report-layout">
        <article className="work-report-composer">
          <div className="work-report-panel-heading">
            <div>
              <span>REPORT INPUT</span>
              <h3>今日の作業を入力</h3>
            </div>
            <span className="work-report-step-badge">1 / 3</span>
          </div>
          <p className="work-report-intro">
            日付・部門・設備・現象・原因・作業内容・進捗を記録します。原因が未特定の場合は空欄で保存できます。
          </p>

          {pendingGuideHandoff && (
            <WorkReportGuideHandoffConflict
              request={pendingGuideHandoff}
              onKeepDraft={() => {
                setPendingGuideHandoff(null)
                setGuideHandoffNotice('kept')
              }}
              onReplaceDraft={() =>
                applyGuideHandoff(pendingGuideHandoff, true)
              }
            />
          )}

          {guideHandoffNotice && (
            <p
              className={`work-report-guide-notice is-${guideHandoffNotice}`}
              role="status"
            >
              {guideHandoffNotice === 'applied'
                ? 'ガイドから部門・設備・現象を引き継ぎました。原因・作業内容・進捗を入力してください。'
                : '現在の下書きを維持しました。ガイド内容は反映していません。'}
            </p>
          )}

          <form noValidate onSubmit={handleSubmit}>
            <label htmlFor="work-report-date">
              <span>1. 日付</span>
              <input
                id="work-report-date"
                type="date"
                value={values.workDate}
                required
                onChange={(event) =>
                  updateValue('workDate', event.target.value)
                }
              />
            </label>

            <WorkReportEquipmentFields
              idPrefix="work-report"
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

            <label htmlFor="work-report-phenomenon">
              <span>4. 現象</span>
              <textarea
                id="work-report-phenomenon"
                value={values.phenomenon}
                maxLength={2000}
                required
                placeholder="例：包装機の搬送部から周期的な異音がする"
                onChange={(event) =>
                  updateValue('phenomenon', event.target.value)
                }
              />
            </label>

            <label htmlFor="work-report-cause">
              <span>5. 原因（未特定なら空欄）</span>
              <textarea
                id="work-report-cause"
                className="work-report-notes"
                value={values.cause}
                maxLength={2000}
                placeholder="例：搬送ベルトの張力低下"
                onChange={(event) => updateValue('cause', event.target.value)}
              />
            </label>

            <label htmlFor="work-report-content">
              <span>6. 作業内容</span>
              <textarea
                id="work-report-content"
                value={values.workContent}
                maxLength={2000}
                required
                placeholder="例：安全手順に従ってベルト張力を確認し調整した"
                onChange={(event) =>
                  updateValue('workContent', event.target.value)
                }
              />
            </label>

            <label htmlFor="work-report-progress">
              <span>7. 進捗</span>
              <select
                id="work-report-progress"
                value={values.progress}
                required
                onChange={(event) =>
                  updateValue('progress', event.target.value)
                }
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
              <div className="work-report-errors" role="alert">
                <strong>入力内容を確認してください</strong>
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <button className="work-report-confirm-button" type="submit">
              入力内容を確認
            </button>
          </form>

          {draftStatus !== 'idle' && (
            <div
              className={`work-report-draft-status${
                draftStatus === 'unavailable' ? ' is-error' : ''
              }`}
              role="status"
            >
              <div>
                <p>
                  {draftStatus === 'restored'
                    ? '前回の下書きを復元しました。'
                    : draftStatus === 'saved'
                      ? '入力内容をこの端末へ下書き保存しました。'
                      : draftStatus === 'cleared'
                        ? '下書きを消去しました。'
                        : 'この端末では下書きを保存できません。'}
                </p>
              </div>
              {(draftStatus === 'restored' || draftStatus === 'saved') && (
                <button type="button" onClick={handleClearDraft}>
                  下書きを消去
                </button>
              )}
            </div>
          )}
          <p className="work-report-storage-note">
            入力途中の内容はこの端末に自動保存され、DB保存後に消去されます。共用端末では作業後に下書きを消去してください。
          </p>
        </article>

        <article
          className={`work-report-preview${confirmation ? ' is-ready' : ''}${
            isSaved ? ' is-saved' : ''
          }`}
        >
          <div className="work-report-panel-heading">
            <div>
              <span>REVIEW & SAVE</span>
              <h3>{isSaved ? '保存完了' : '保存前の確認'}</h3>
            </div>
            <span className="work-report-step-badge">
              {isSaved ? '3 / 3' : '2 / 3'}
            </span>
          </div>

          {!confirmation ? (
            <div className="work-report-empty-preview">
              <span>7</span>
              <p>
                7項目を入力して「入力内容を確認」を押すと、ここに保存内容を表示します。
              </p>
            </div>
          ) : (
            <>
              {isSaved ? (
                <p className="work-report-saved-message" role="status">
                  Phoenix DBへ日報を保存しました。
                </p>
              ) : (
                <p className="work-report-ready-message">
                  内容を確認してからPhoenix DBへ保存してください。
                </p>
              )}
              <dl className="work-report-review-list">
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
                <div className="work-report-review-wide">
                  <dt>現象</dt>
                  <dd>{confirmation.phenomenon}</dd>
                </div>
                <div className="work-report-review-wide">
                  <dt>原因</dt>
                  <dd>{confirmation.cause || '未特定'}</dd>
                </div>
                <div className="work-report-review-wide">
                  <dt>作業内容</dt>
                  <dd>{confirmation.workContent}</dd>
                </div>
              </dl>
              {saveState.phase === 'error' && (
                <p className="work-report-save-error" role="alert">
                  {saveState.message}
                </p>
              )}
              <div className="work-report-review-actions">
                {isSaved ? (
                  <button
                    className="work-report-new-button"
                    type="button"
                    onClick={handleStartNewReport}
                  >
                    次の日報を入力
                  </button>
                ) : (
                  <>
                    <button
                      className="work-report-save-button"
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleSave()}
                    >
                      {isSaving ? '保存中...' : 'Phoenix DBへ保存'}
                    </button>
                    <button
                      className="work-report-edit-button"
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setConfirmation(null)
                        resetWorkReportSave()
                      }}
                    >
                      入力内容を修正
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </article>
      </div>
    </section>
  )
})

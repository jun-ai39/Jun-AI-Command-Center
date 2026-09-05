import { useState, type FormEvent } from 'react'

import { getEquipmentDisplayName } from '../../equipment-master/components/equipmentMasterView'
import type { Equipment } from '../../equipment-master/types'
import {
  INSPECTION_CYCLE_OPTIONS,
  type InspectionCycle,
  type InspectionTemplateItem,
} from '../../inspection-templates/types'
import type { WorkReportEquipmentOptionsState } from '../../work-reports/types'
import { getLocalDateInputValue } from '../../work-reports/workReportForm'
import { useInspectionEntryTemplates } from '../hooks/useInspectionEntryTemplates'
import { useInspectionRecordSave } from '../hooks/useInspectionRecordSave'
import {
  buildInspectionRecordItems,
  getInspectionLiveJudgment,
  MAX_INSPECTION_ABSOLUTE_VALUE,
  type InspectionValueMap,
} from '../inspectionRecordForm'
import type {
  InspectionEntryTemplateState,
  InspectionJudgment,
  InspectionRecord,
  InspectionRecordCreateInput,
  InspectionRecordEntrySelection,
  InspectionRecordSaveState,
} from '../types'
import './InspectionRecordPanel.css'

type InspectionRecordPanelProps = {
  readonly equipmentOptionsState: WorkReportEquipmentOptionsState
  readonly onReloadEquipmentOptions: () => void
  readonly onSaved: () => void
  readonly selection?: InspectionRecordEntrySelection | null
  readonly templateRefreshToken?: number
}

type InspectionRecordWorkspaceContentProps = {
  readonly inspectionDate: string
  readonly equipment: Equipment
  readonly cycle: InspectionCycle
  readonly state: InspectionEntryTemplateState
  readonly saveState: InspectionRecordSaveState
  readonly onReload: () => void
  readonly onSave: (
    input: InspectionRecordCreateInput,
  ) => Promise<InspectionRecord | null>
  readonly onResetSave: () => void
}

function getCycleLabel(cycle: InspectionCycle): string {
  return (
    INSPECTION_CYCLE_OPTIONS.find((option) => option.value === cycle)?.label ??
    cycle
  )
}

function getJudgmentLabel(judgment: InspectionJudgment | null): string {
  if (judgment === 'normal') return '正常'
  if (judgment === 'abnormal') return '異常'
  return '未入力'
}

function InspectionRecordForm({
  inspectionDate,
  equipment,
  cycle,
  items,
  saveState,
  onSave,
  onResetSave,
}: Omit<InspectionRecordWorkspaceContentProps, 'state' | 'onReload'> & {
  readonly items: readonly InspectionTemplateItem[]
}) {
  const [values, setValues] = useState<InspectionValueMap>({})
  const [errors, setErrors] = useState<readonly string[]>([])
  const isSaving = saveState.phase === 'saving'
  const isSaved = saveState.phase === 'saved'

  function updateValue(itemId: string, value: string) {
    setValues((current) => ({ ...current, [itemId]: value }))
    setErrors([])
    onResetSave()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || isSaved) return
    const result = buildInspectionRecordItems(items, values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    await onSave({
      inspectionDate,
      equipmentId: equipment.equipment_id,
      cycle,
      items: result.items,
    })
  }

  const savedRecord = saveState.phase === 'saved' ? saveState.record : null
  const normalCount =
    savedRecord?.items.filter((item) => item.judgment === 'normal').length ?? 0
  const abnormalCount = (savedRecord?.items.length ?? 0) - normalCount

  return (
    <form className="inspection-record-form" noValidate onSubmit={handleSubmit}>
      <div className="inspection-record-context">
        <span>{getEquipmentDisplayName(equipment)}</span>
        <span>{getCycleLabel(cycle)}点検</span>
        <span>{items.length}項目</span>
      </div>

      <div className="inspection-record-item-list">
        {items.map((item, index) => {
          const value = values[item.id] ?? ''
          const judgment = getInspectionLiveJudgment(item, value)
          return (
            <fieldset className="inspection-record-item" key={item.id}>
              <legend>
                <span>{index + 1}</span>
                {item.name}
              </legend>
              {item.check_method && (
                <div className="inspection-record-guide-method">
                  <strong>確認方法</strong>
                  <p>{item.check_method}</p>
                </div>
              )}
              {item.input_type === 'number' ? (
                <>
                  <label htmlFor={`inspection-record-value-${item.id}`}>
                    <span>測定値</span>
                    <span className="inspection-record-number-input">
                      <input
                        id={`inspection-record-value-${item.id}`}
                        type="number"
                        min={-MAX_INSPECTION_ABSOLUTE_VALUE}
                        max={MAX_INSPECTION_ABSOLUTE_VALUE}
                        step="any"
                        value={value}
                        required
                        disabled={isSaving || isSaved}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateValue(item.id, event.target.value)
                        }
                      />
                      {item.unit && <strong>{item.unit}</strong>}
                    </span>
                  </label>
                  <p className="inspection-record-criterion">
                    正常範囲：{item.normal_min} ～ {item.normal_max}
                    {item.unit ? ` ${item.unit}` : ''}
                  </p>
                </>
              ) : (
                <>
                  <div
                    className="inspection-record-status-options"
                    role="radiogroup"
                    aria-label={`${item.name}の判定`}
                  >
                    {(['normal', 'abnormal'] as const).map((status) => (
                      <label
                        className={`is-${status}`}
                        key={status}
                        htmlFor={`inspection-record-${item.id}-${status}`}
                      >
                        <input
                          id={`inspection-record-${item.id}-${status}`}
                          type="radio"
                          name={`inspection-record-${item.id}`}
                          value={status}
                          checked={value === status}
                          disabled={isSaving || isSaved}
                          onChange={(event) =>
                            updateValue(item.id, event.target.value)
                          }
                        />
                        <span>{status === 'normal' ? '正常' : '異常'}</span>
                      </label>
                    ))}
                  </div>
                  <p className="inspection-record-criterion">
                    正常状態：{item.normal_state}
                  </p>
                </>
              )}
              {item.caution_note && (
                <div className="inspection-record-guide-caution" role="note">
                  <strong>注意・引継ぎ</strong>
                  <p>{item.caution_note}</p>
                </div>
              )}
              <p
                className={`inspection-record-live-judgment is-${judgment ?? 'empty'}`}
                aria-live="polite"
              >
                判定：{getJudgmentLabel(judgment)}
              </p>
            </fieldset>
          )
        })}
      </div>

      {errors.length > 0 && (
        <div className="inspection-record-errors" role="alert">
          <strong>未入力の点検項目があります</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {saveState.phase === 'error' && (
        <p className="inspection-record-save-error" role="alert">
          {saveState.message}
        </p>
      )}

      {savedRecord && (
        <div
          className={`inspection-record-saved is-${savedRecord.overall_judgment}`}
          role="status"
        >
          <strong>
            保存しました：総合判定
            {savedRecord.overall_judgment === 'normal' ? ' 正常' : ' 異常'}
          </strong>
          <span>
            正常 {normalCount}件／異常 {abnormalCount}件
          </span>
        </div>
      )}

      <button
        className="inspection-record-save-button"
        type="submit"
        disabled={isSaving || isSaved}
      >
        {isSaving
          ? '点検記録を保存しています…'
          : isSaved
            ? '点検記録を保存しました'
            : '点検記録を保存'}
      </button>
      <p className="inspection-record-duplicate-note">
        毎日は同じ日、毎週は同じ週、毎月は同じ月に、同じ設備の記録を重複保存できません。
      </p>
    </form>
  )
}

export function InspectionRecordWorkspaceContent({
  inspectionDate,
  equipment,
  cycle,
  state,
  saveState,
  onReload,
  onSave,
  onResetSave,
}: InspectionRecordWorkspaceContentProps) {
  if (state.phase === 'loading') {
    return (
      <div className="inspection-record-load-state" role="status">
        点検項目を読み込んでいます…
      </div>
    )
  }
  if (state.phase === 'error') {
    return (
      <div className="inspection-record-load-state is-error" role="alert">
        <strong>点検項目を読み込めませんでした</strong>
        <p>APIの接続状態を確認して、もう一度読み込んでください。</p>
        <button type="button" onClick={onReload}>
          もう一度読み込む
        </button>
      </div>
    )
  }
  if (state.items.length === 0) {
    return (
      <div className="inspection-record-load-state is-empty" role="status">
        <strong>この周期の点検項目は未設定です</strong>
        <p>管理・設定の「設備別点検項目マスター」で項目を登録してください。</p>
      </div>
    )
  }
  return (
    <InspectionRecordForm
      inspectionDate={inspectionDate}
      equipment={equipment}
      cycle={cycle}
      items={state.items}
      saveState={saveState}
      onSave={onSave}
      onResetSave={onResetSave}
    />
  )
}

function InspectionRecordWorkspace({
  inspectionDate,
  equipment,
  cycle,
  onSaved,
  templateRefreshToken,
}: {
  readonly inspectionDate: string
  readonly equipment: Equipment
  readonly cycle: InspectionCycle
  readonly onSaved: () => void
  readonly templateRefreshToken: number
}) {
  const { state, reload } = useInspectionEntryTemplates(
    equipment.equipment_id,
    cycle,
    templateRefreshToken,
  )
  const { saveState, save, reset } = useInspectionRecordSave()

  async function saveAndNotify(
    input: InspectionRecordCreateInput,
  ): Promise<InspectionRecord | null> {
    const record = await save(input)
    if (record) onSaved()
    return record
  }

  return (
    <InspectionRecordWorkspaceContent
      inspectionDate={inspectionDate}
      equipment={equipment}
      cycle={cycle}
      state={state}
      saveState={saveState}
      onReload={reload}
      onSave={saveAndNotify}
      onResetSave={reset}
    />
  )
}

export function InspectionRecordPanel({
  equipmentOptionsState,
  onReloadEquipmentOptions,
  onSaved,
  selection = null,
  templateRefreshToken = 0,
}: InspectionRecordPanelProps) {
  const [inspectionDate, setInspectionDate] = useState(getLocalDateInputValue)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(
    selection?.equipmentId ?? '',
  )
  const [cycle, setCycle] = useState<InspectionCycle>(
    selection?.cycle ?? 'daily',
  )
  const [selectionNotice, setSelectionNotice] =
    useState<InspectionRecordEntrySelection | null>(selection)
  const activeEquipment =
    equipmentOptionsState.phase === 'ready'
      ? equipmentOptionsState.equipment.filter((item) => item.is_active)
      : []
  const selectedEquipment =
    activeEquipment.find((item) => item.equipment_id === selectedEquipmentId) ??
    activeEquipment.at(0)

  function getEquipmentOptionLabel(equipment: Equipment): string {
    if (equipmentOptionsState.phase !== 'ready') {
      return getEquipmentDisplayName(equipment)
    }
    const department = equipmentOptionsState.departments.find(
      (item) => item.id === equipment.department_id,
    )
    return `${department?.name ?? '部門未登録'} / ${getEquipmentDisplayName(equipment)}`
  }

  return (
    <section
      id="inspection-record-section"
      className="inspection-record-section"
      tabIndex={-1}
      aria-labelledby="inspection-record-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">RECORD / STEP 97</p>
          <h2 id="inspection-record-title">点検記録</h2>
        </div>
        <p>設備別の項目を順番に入力</p>
      </div>

      <div className="inspection-record-panel">
        <div className="inspection-record-heading">
          <div>
            <span>INSPECTION INPUT</span>
            <h3>今日の点検を記録</h3>
          </div>
          <span className="inspection-record-step-badge">STEP 97</span>
        </div>
        <p className="inspection-record-intro">
          設備と周期を選ぶと、管理者が設定した有効な点検項目だけを表示します。
        </p>

        {selectionNotice && (
          <div className="inspection-record-selection-notice" role="status">
            <div>
              <strong>定期点検から選択しました</strong>
              <span>
                {selectionNotice.departmentName} /{' '}
                {selectionNotice.equipmentName}
                {selectionNotice.equipmentNumber
                  ? ` ${selectionNotice.equipmentNumber}`
                  : ''}
              </span>
            </div>
            <strong>{getCycleLabel(selectionNotice.cycle)}点検</strong>
          </div>
        )}

        <div className="inspection-record-selectors">
          <label htmlFor="inspection-record-date">
            <span>点検日</span>
            <input
              id="inspection-record-date"
              type="date"
              value={inspectionDate}
              required
              onChange={(event) => setInspectionDate(event.target.value)}
            />
          </label>
          <label htmlFor="inspection-record-equipment">
            <span>設備</span>
            <select
              id="inspection-record-equipment"
              value={selectedEquipment?.equipment_id ?? ''}
              disabled={equipmentOptionsState.phase !== 'ready'}
              onChange={(event) => {
                setSelectedEquipmentId(event.target.value)
                setSelectionNotice(null)
              }}
            >
              {equipmentOptionsState.phase === 'loading' && (
                <option value="">設備を読み込んでいます</option>
              )}
              {equipmentOptionsState.phase === 'error' && (
                <option value="">設備を読み込めません</option>
              )}
              {equipmentOptionsState.phase === 'ready' &&
                activeEquipment.length === 0 && (
                  <option value="">使用中の設備がありません</option>
                )}
              {activeEquipment.map((equipment) => (
                <option
                  key={equipment.equipment_id}
                  value={equipment.equipment_id}
                >
                  {getEquipmentOptionLabel(equipment)}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="inspection-record-cycle">
            <span>点検周期</span>
            <select
              id="inspection-record-cycle"
              value={cycle}
              onChange={(event) => {
                setCycle(event.target.value as InspectionCycle)
                setSelectionNotice(null)
              }}
            >
              {INSPECTION_CYCLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {equipmentOptionsState.phase === 'error' && (
          <div className="inspection-record-equipment-error" role="alert">
            <span>設備一覧を読み込めませんでした。</span>
            <button type="button" onClick={onReloadEquipmentOptions}>
              もう一度読み込む
            </button>
          </div>
        )}

        {equipmentOptionsState.phase === 'ready' &&
          activeEquipment.length === 0 && (
            <div className="inspection-record-load-state is-empty">
              <strong>使用中の設備が登録されていません</strong>
              <p>管理・設定で設備を登録してから点検を開始してください。</p>
            </div>
          )}

        {selectedEquipment && inspectionDate && (
          <InspectionRecordWorkspace
            key={`${inspectionDate}-${selectedEquipment.equipment_id}-${cycle}`}
            inspectionDate={inspectionDate}
            equipment={selectedEquipment}
            cycle={cycle}
            onSaved={onSaved}
            templateRefreshToken={templateRefreshToken}
          />
        )}
      </div>
    </section>
  )
}

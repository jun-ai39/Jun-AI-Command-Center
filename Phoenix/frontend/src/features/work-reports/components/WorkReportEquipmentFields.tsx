import type { WorkReportEquipmentOptionsState } from '../types'
import { getEquipmentLabel } from '../workReportEquipment'
import './WorkReportEquipmentFields.css'

type WorkReportEquipmentFieldsProps = {
  readonly idPrefix: string
  readonly departmentId: string
  readonly equipmentId: string
  readonly state: WorkReportEquipmentOptionsState
  readonly numberedLabels?: boolean
  readonly onDepartmentChange: (departmentId: string) => void
  readonly onEquipmentChange: (equipmentId: string) => void
  readonly onReload: () => void
}

export function WorkReportEquipmentFields({
  idPrefix,
  departmentId,
  equipmentId,
  state,
  numberedLabels = false,
  onDepartmentChange,
  onEquipmentChange,
  onReload,
}: WorkReportEquipmentFieldsProps) {
  const departments = state.phase === 'ready' ? state.departments : []
  const equipment = state.phase === 'ready' ? state.equipment : []
  const filteredEquipment = equipment.filter(
    (item) => item.department_id === departmentId,
  )
  const isUnavailable = state.phase !== 'ready'

  return (
    <div className="work-report-equipment-fields">
      <label htmlFor={`${idPrefix}-department`}>
        <span>{numberedLabels ? '2. 部門' : '部門'}</span>
        <select
          id={`${idPrefix}-department`}
          value={departmentId}
          required
          disabled={isUnavailable}
          onChange={(event) => onDepartmentChange(event.target.value)}
        >
          <option value="">
            {state.phase === 'loading'
              ? '部門を読み込んでいます'
              : state.phase === 'error'
                ? '部門を読み込めません'
                : '選択してください'}
          </option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor={`${idPrefix}-equipment`}>
        <span>{numberedLabels ? '3. 設備' : '設備'}</span>
        <select
          id={`${idPrefix}-equipment`}
          value={equipmentId}
          required
          disabled={isUnavailable || !departmentId}
          onChange={(event) => onEquipmentChange(event.target.value)}
        >
          <option value="">
            {!departmentId
              ? '先に部門を選択してください'
              : filteredEquipment.length === 0
                ? '登録済みの稼働設備がありません'
                : '選択してください'}
          </option>
          {filteredEquipment.map((item) => (
            <option key={item.equipment_id} value={item.equipment_id}>
              {getEquipmentLabel(item)}
            </option>
          ))}
        </select>
      </label>

      {state.phase === 'error' && (
        <div className="work-report-equipment-error" role="alert">
          <p>設備マスターを読み込めませんでした。</p>
          <button type="button" onClick={onReload}>
            もう一度読み込む
          </button>
        </div>
      )}
      {state.phase === 'ready' &&
        departmentId &&
        filteredEquipment.length === 0 && (
          <p className="work-report-equipment-empty" role="status">
            この部門には稼働中の設備がありません。「管理・設定」で設備を登録してください。
          </p>
        )}
    </div>
  )
}

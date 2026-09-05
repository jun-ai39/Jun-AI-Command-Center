import type { WorkReportEquipmentOptionsState } from '../../work-reports/types'
import { getEquipmentLabel } from '../../work-reports/workReportEquipment'
import './TodoEquipmentFields.css'

type TodoEquipmentFieldsProps = {
  readonly idPrefix: string
  readonly departmentId: string
  readonly equipmentId: string
  readonly state: WorkReportEquipmentOptionsState
  readonly onDepartmentChange: (departmentId: string) => void
  readonly onEquipmentChange: (equipmentId: string) => void
  readonly onReload: () => void
}

export function TodoEquipmentFields({
  idPrefix,
  departmentId,
  equipmentId,
  state,
  onDepartmentChange,
  onEquipmentChange,
  onReload,
}: TodoEquipmentFieldsProps) {
  const departments = state.phase === 'ready' ? state.departments : []
  const equipment = state.phase === 'ready' ? state.equipment : []
  const filteredEquipment = equipment.filter(
    (item) => item.department_id === departmentId,
  )
  const isUnavailable = state.phase !== 'ready'

  return (
    <div className="todo-equipment-fields">
      <label htmlFor={`${idPrefix}-department`}>
        対象部門（任意）
        <select
          id={`${idPrefix}-department`}
          value={departmentId}
          disabled={isUnavailable}
          onChange={(event) => onDepartmentChange(event.target.value)}
        >
          <option value="">
            {state.phase === 'loading'
              ? '部門を読み込んでいます'
              : state.phase === 'error'
                ? '部門を読み込めません'
                : '設備を指定しない'}
          </option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor={`${idPrefix}-equipment`}>
        対象設備（任意）
        <select
          id={`${idPrefix}-equipment`}
          value={equipmentId}
          disabled={isUnavailable || !departmentId}
          onChange={(event) => onEquipmentChange(event.target.value)}
        >
          <option value="">
            {!departmentId
              ? '部門を選ぶと設備を指定できます'
              : filteredEquipment.length === 0
                ? '使用中の設備がありません'
                : '設備を指定しない'}
          </option>
          {filteredEquipment.map((item) => (
            <option key={item.equipment_id} value={item.equipment_id}>
              {getEquipmentLabel(item)}
            </option>
          ))}
        </select>
      </label>

      {state.phase === 'error' && (
        <div className="todo-equipment-error" role="alert">
          <p>設備マスターを読み込めませんでした。</p>
          <button type="button" onClick={onReload}>
            もう一度読み込む
          </button>
        </div>
      )}
      {state.phase === 'ready' &&
        departmentId &&
        filteredEquipment.length === 0 && (
          <p className="todo-equipment-empty" role="status">
            この部門には使用中の設備がありません。
          </p>
        )}
      <p className="todo-equipment-note">
        設備を選ぶと「今日の保全予定」に対象設備を表示します。
      </p>
    </div>
  )
}

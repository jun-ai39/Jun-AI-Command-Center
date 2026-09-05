import { formatWorkReportDate } from '../../work-reports/workReportForm'
import type { WorkReportEquipmentOptionsState } from '../../work-reports/types'
import { useTodayMaintenanceSchedules } from '../hooks/useTodayMaintenanceSchedules'
import { getTodoEquipmentSummary } from '../todoEquipment'
import type { Todo, TodoDueSummaryState, TodoPriority } from '../types'
import './TodayMaintenancePanel.css'

const PRIORITY_LABELS: Readonly<Record<TodoPriority, string>> = {
  high: '高',
  medium: '中',
  low: '低',
}

type MaintenanceScheduleGroupProps = {
  readonly title: string
  readonly detail: string
  readonly tone: 'today' | 'overdue'
  readonly items: readonly Todo[]
  readonly equipmentOptionsState: WorkReportEquipmentOptionsState
  readonly mutatingTodoIds: ReadonlySet<string>
  readonly onComplete: (todo: Todo) => void
}

function MaintenanceScheduleGroup({
  title,
  detail,
  tone,
  items,
  equipmentOptionsState,
  mutatingTodoIds,
  onComplete,
}: MaintenanceScheduleGroupProps) {
  return (
    <section className={`maintenance-schedule-group is-${tone}`}>
      <div className="maintenance-schedule-group-heading">
        <div>
          <span>{detail}</span>
          <h4>{title}</h4>
        </div>
        <strong>{items.length}件</strong>
      </div>
      {items.length === 0 ? (
        <p className="maintenance-schedule-group-empty">
          {tone === 'overdue'
            ? '期限を過ぎた予定はありません。'
            : '本日期限の予定はありません。'}
        </p>
      ) : (
        <ul>
          {items.map((todo) => {
            const isBusy = mutatingTodoIds.has(todo.id)
            const equipmentSummary = getTodoEquipmentSummary(
              equipmentOptionsState,
              todo.equipment_id,
            )
            return (
              <li key={todo.id}>
                <div className="maintenance-schedule-item-copy">
                  <span className={`maintenance-schedule-due is-${tone}`}>
                    {tone === 'overdue' ? '期限超過' : '本日期限'}
                  </span>
                  <strong>{todo.title}</strong>
                  {equipmentSummary && (
                    <small
                      className={`maintenance-schedule-equipment is-${equipmentSummary.status}`}
                    >
                      対象設備：{equipmentSummary.label}
                    </small>
                  )}
                  <small>
                    優先度 {PRIORITY_LABELS[todo.priority]}・期限{' '}
                    {formatWorkReportDate(todo.due_date ?? '')}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  aria-label={`${todo.title}を完了にする`}
                  onClick={() => onComplete(todo)}
                >
                  {isBusy ? '保存中…' : '完了'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

type TodayMaintenanceContentProps = {
  readonly targetDate: string
  readonly state: TodoDueSummaryState
  readonly mutatingTodoIds: ReadonlySet<string>
  readonly mutationError: string | null
  readonly equipmentOptionsState: WorkReportEquipmentOptionsState
  readonly onComplete: (todo: Todo) => void
  readonly onReload: () => void
  readonly onOpenScheduleManagement?: () => void
}

export function TodayMaintenanceContent({
  targetDate,
  state,
  mutatingTodoIds,
  mutationError,
  equipmentOptionsState,
  onComplete,
  onReload,
  onOpenScheduleManagement,
}: TodayMaintenanceContentProps) {
  const itemCount =
    state.phase === 'ready'
      ? state.data.today_items.length + state.data.overdue_items.length
      : 0

  return (
    <section
      className="today-maintenance-section"
      aria-labelledby="today-maintenance-title"
    >
      <div className="section-heading today-maintenance-section-heading">
        <div>
          <p className="eyebrow">MANAGE / STEP 101</p>
          <h2 id="today-maintenance-title">今日の保全予定</h2>
        </div>
        <p>{formatWorkReportDate(targetDate)}</p>
      </div>

      <div className="today-maintenance-panel">
        <div className="today-maintenance-heading">
          <div>
            <span>MAINTENANCE SCHEDULES</span>
            <h3>今日までに実施する作業</h3>
          </div>
          {state.phase === 'ready' && (
            <strong className={itemCount > 0 ? 'has-work' : 'is-clear'}>
              {itemCount > 0 ? `要実施 ${itemCount}件` : '予定なし'}
            </strong>
          )}
        </div>
        <p className="today-maintenance-intro">
          本日期限と期限超過の未完了予定だけを表示します。完了した作業はここから外れます。
        </p>

        {state.phase === 'loading' && (
          <p className="today-maintenance-state" role="status">
            今日の保全予定を読み込んでいます…
          </p>
        )}

        {state.phase === 'error' && (
          <div className="today-maintenance-state is-error" role="alert">
            <p>今日の保全予定を読み込めませんでした。</p>
            <button type="button" onClick={onReload}>
              もう一度読み込む
            </button>
          </div>
        )}

        {state.phase === 'ready' && (
          <>
            <div className="maintenance-schedule-grid">
              <MaintenanceScheduleGroup
                title="期限超過"
                detail="OVERDUE"
                tone="overdue"
                items={state.data.overdue_items}
                equipmentOptionsState={equipmentOptionsState}
                mutatingTodoIds={mutatingTodoIds}
                onComplete={onComplete}
              />
              <MaintenanceScheduleGroup
                title="本日の予定"
                detail="TODAY"
                tone="today"
                items={state.data.today_items}
                equipmentOptionsState={equipmentOptionsState}
                mutatingTodoIds={mutatingTodoIds}
                onComplete={onComplete}
              />
            </div>
            {itemCount === 0 && (
              <p className="today-maintenance-clear-message" role="status">
                今日までに実施する未完了予定はありません。
              </p>
            )}
            {mutationError && (
              <p className="today-maintenance-mutation-error" role="alert">
                {mutationError}
              </p>
            )}
            {onOpenScheduleManagement && (
              <button
                className="today-maintenance-manage-link"
                type="button"
                onClick={onOpenScheduleManagement}
              >
                保全予定の登録・詳細管理へ
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

type TodayMaintenancePanelProps = {
  readonly onScheduleCompleted?: () => void
  readonly onOpenScheduleManagement?: () => void
  readonly equipmentOptionsState: WorkReportEquipmentOptionsState
}

export function TodayMaintenancePanel({
  onScheduleCompleted,
  onOpenScheduleManagement,
  equipmentOptionsState,
}: TodayMaintenancePanelProps) {
  const {
    targetDate,
    state,
    mutatingTodoIds,
    mutationError,
    completeSchedule,
    reload,
  } = useTodayMaintenanceSchedules(onScheduleCompleted)

  return (
    <TodayMaintenanceContent
      targetDate={targetDate}
      state={state}
      mutatingTodoIds={mutatingTodoIds}
      mutationError={mutationError}
      equipmentOptionsState={equipmentOptionsState}
      onComplete={(todo) => void completeSchedule(todo)}
      onReload={reload}
      onOpenScheduleManagement={onOpenScheduleManagement}
    />
  )
}

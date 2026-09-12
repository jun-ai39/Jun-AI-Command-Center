import type { InspectionCycle } from '../../inspection-templates/types'
import { INSPECTION_CYCLE_OPTIONS } from '../../inspection-templates/types'
import { formatWorkReportDate } from '../../work-reports/workReportForm'
import { useInspectionStatus } from '../hooks/useInspectionStatus'
import type {
  InspectionScheduleStatusItem,
  InspectionStatusState,
} from '../types'
import './InspectionStatusPanel.css'

type InspectionStatusContentProps = {
  readonly targetDate: string
  readonly state: InspectionStatusState
  readonly onReload: () => void
  readonly onStartInspection: (item: InspectionScheduleStatusItem) => void
}

const CYCLES: readonly InspectionCycle[] = ['daily', 'weekly', 'monthly']

function getCycleLabel(cycle: InspectionCycle): string {
  return (
    INSPECTION_CYCLE_OPTIONS.find((option) => option.value === cycle)?.label ??
    cycle
  )
}

function getPeriodLabel(cycle: InspectionCycle): string {
  if (cycle === 'daily') return '今日'
  if (cycle === 'weekly') return '今週'
  return '今月'
}

function getEquipmentName(item: InspectionScheduleStatusItem): string {
  return item.equipment_number
    ? `${item.equipment_name} ${item.equipment_number}`
    : item.equipment_name
}

function getStatusLabel(item: InspectionScheduleStatusItem): string {
  if (item.completion_status === 'pending') return '未実施'
  return item.overall_judgment === 'abnormal'
    ? '実施済み・異常'
    : '実施済み・正常'
}

export function InspectionStatusContent({
  targetDate,
  state,
  onReload,
  onStartInspection,
}: InspectionStatusContentProps) {
  const pendingTotal =
    state.phase === 'ready'
      ? state.data.cycle_summaries.reduce(
          (total, summary) => total + summary.pending,
          0,
        )
      : 0

  return (
    <section
      className="inspection-status-section"
      aria-labelledby="inspection-status-title"
    >
      <div className="section-heading inspection-status-section-heading">
        <div>
          <p className="eyebrow">MANAGE / INSPECTION STATUS</p>
          <h2 id="inspection-status-title">定期点検</h2>
        </div>
        <p>{formatWorkReportDate(targetDate)}時点</p>
      </div>

      <div className="inspection-status-panel">
        <div className="inspection-status-heading">
          <div>
            <span>PERIODIC INSPECTIONS</span>
            <h3>点検の実施状況</h3>
          </div>
          {state.phase === 'ready' && (
            <strong className={pendingTotal > 0 ? 'has-pending' : 'is-clear'}>
              {pendingTotal > 0 ? `未実施 ${pendingTotal}件` : '未実施なし'}
            </strong>
          )}
        </div>
        <p className="inspection-status-intro">
          有効な点検項目が設定された使用中設備について、毎日・毎週・毎月の完了状況を表示します。
        </p>

        {state.phase === 'loading' && (
          <p className="inspection-status-state" role="status">
            定期点検の実施状況を読み込んでいます…
          </p>
        )}

        {state.phase === 'error' && (
          <div className="inspection-status-state is-error" role="alert">
            <p>定期点検の実施状況を読み込めませんでした。</p>
            <button type="button" onClick={onReload}>
              もう一度読み込む
            </button>
          </div>
        )}

        {state.phase === 'ready' && (
          <>
            <div className="inspection-status-grid">
              {CYCLES.map((cycle) => {
                const summary = state.data.cycle_summaries.find(
                  (item) => item.cycle === cycle,
                )
                const cycleItems = state.data.items.filter(
                  (item) => item.cycle === cycle,
                )
                const total = summary?.total ?? 0
                const completed = summary?.completed ?? 0
                const pending = summary?.pending ?? 0
                const completionRate =
                  total === 0 ? 0 : Math.round((completed / total) * 100)
                const cardState =
                  total === 0
                    ? 'is-empty'
                    : pending > 0
                      ? 'has-pending'
                      : 'is-complete'
                return (
                  <article
                    className={`inspection-status-card ${cardState}`}
                    key={cycle}
                  >
                    <div className="inspection-status-card-heading">
                      <div>
                        <span>{getPeriodLabel(cycle)}</span>
                        <h4>{getCycleLabel(cycle)}点検</h4>
                      </div>
                      <strong>
                        {total === 0
                          ? '対象なし'
                          : pending > 0
                            ? `${pending}件 未実施`
                            : 'すべて実施済み'}
                      </strong>
                    </div>
                    <div className="inspection-status-counts">
                      <div>
                        <span>実施済み</span>
                        <strong>{completed}</strong>
                      </div>
                      <div>
                        <span>未実施</span>
                        <strong>{pending}</strong>
                      </div>
                      <div>
                        <span>対象</span>
                        <strong>{total}</strong>
                      </div>
                    </div>
                    <div
                      className="inspection-status-progress"
                      role="progressbar"
                      aria-label={`${getCycleLabel(cycle)}点検の実施率`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={completionRate}
                    >
                      <span style={{ width: `${completionRate}%` }} />
                    </div>

                    {cycleItems.length > 0 ? (
                      <details open={cycle === 'daily'}>
                        <summary>設備別状況（{cycleItems.length}件）</summary>
                        <ul>
                          {cycleItems.map((item) => (
                            <li key={`${item.equipment_id}-${item.cycle}`}>
                              <div>
                                <span>{item.department_name}</span>
                                <strong>{getEquipmentName(item)}</strong>
                                <small>{item.template_item_count}項目</small>
                              </div>
                              <div className="inspection-status-item-actions">
                                <strong
                                  className={`inspection-status-item-badge is-${
                                    item.completion_status === 'pending'
                                      ? 'pending'
                                      : item.overall_judgment
                                  }`}
                                >
                                  {getStatusLabel(item)}
                                </strong>
                                {item.completion_status === 'pending' && (
                                  <button
                                    type="button"
                                    aria-label={`${getEquipmentName(item)}の${getCycleLabel(item.cycle)}点検を入力`}
                                    onClick={() => onStartInspection(item)}
                                  >
                                    この点検を入力
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <p className="inspection-status-card-empty">
                        この周期の点検項目はありません。
                      </p>
                    )}
                  </article>
                )
              })}
            </div>

            {state.data.items.length === 0 && (
              <p className="inspection-status-empty-note">
                点検項目が設定された使用中設備はまだありません。
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

type InspectionStatusPanelProps = {
  readonly refreshToken?: number
  readonly onStartInspection: (item: InspectionScheduleStatusItem) => void
}

export function InspectionStatusPanel({
  refreshToken = 0,
  onStartInspection,
}: InspectionStatusPanelProps) {
  const { targetDate, state, reload } = useInspectionStatus(refreshToken)
  return (
    <InspectionStatusContent
      targetDate={targetDate}
      state={state}
      onReload={reload}
      onStartInspection={onStartInspection}
    />
  )
}

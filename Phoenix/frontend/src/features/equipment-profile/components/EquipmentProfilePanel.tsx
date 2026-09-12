import { EquipmentChangeHistoryForm } from '../../equipment-change-histories/components/EquipmentChangeHistoryForm'
import type {
  EquipmentChangeHistory,
  EquipmentChangeHistoryCreateInput,
  EquipmentChangeHistorySaveState,
} from '../../equipment-change-histories/types'
import type { Equipment } from '../../equipment-master/types'
import { getEquipmentDisplayName } from '../../equipment-master/components/equipmentMasterView'
import {
  INSPECTION_CYCLE_OPTIONS,
  type InspectionCycle,
  type InspectionTemplateItem,
} from '../../inspection-templates/types'
import { TroubleshootingGuideViewer } from '../../troubleshooting/components/TroubleshootingGuideViewer'
import { useEquipmentTroubleshooting } from '../../troubleshooting/hooks/useEquipmentTroubleshooting'
import type {
  TroubleshootingGuideDetailState,
  TroubleshootingGuideListState,
} from '../../troubleshooting/types'
import type {
  InspectionRecord,
  InspectionRecordItem,
} from '../../inspection-records/types'
import {
  LEGACY_WORK_REPORT_CATEGORY_OPTIONS,
  type LegacyWorkReportCategory,
  type WorkReport,
  type WorkReportGuideHandoffInput,
} from '../../work-reports/types'
import {
  formatWorkReportDate,
  getWorkReportProgressLabel,
} from '../../work-reports/workReportForm'
import { useEquipmentProfileInspections } from '../hooks/useEquipmentProfileInspections'
import { useEquipmentProfileChangeHistories } from '../hooks/useEquipmentProfileChangeHistories'
import { useEquipmentProfileGuides } from '../hooks/useEquipmentProfileGuides'
import { useEquipmentProfileReports } from '../hooks/useEquipmentProfileReports'
import type {
  EquipmentProfileChangeHistoriesState,
  EquipmentProfileGuidesState,
  EquipmentProfileInspectionsState,
  EquipmentProfileReportsState,
} from '../types'
import { EquipmentPhotoPanel } from './EquipmentPhotoPanel'
import './EquipmentProfilePanel.css'

type EquipmentProfilePanelProps = {
  readonly equipment: Equipment
  readonly departmentName: string
  readonly manufacturerName: string
  readonly onClose: () => void
  readonly sectionId?: string
  readonly templateRefreshToken?: number
  readonly onStartWorkReport?: (input: WorkReportGuideHandoffInput) => void
  readonly canManagePhoto?: boolean
  readonly onEquipmentPhotoChanged?: (equipment: Equipment) => void
}

type EquipmentProfileContentProps = EquipmentProfilePanelProps & {
  readonly changeHistoriesState: EquipmentProfileChangeHistoriesState
  readonly changeHistorySaveState: EquipmentChangeHistorySaveState
  readonly reportsState: EquipmentProfileReportsState
  readonly inspectionsState: EquipmentProfileInspectionsState
  readonly guidesState: EquipmentProfileGuidesState
  readonly troubleshootingListState: TroubleshootingGuideListState
  readonly troubleshootingDetailState: TroubleshootingGuideDetailState
  readonly onReloadChangeHistories: () => void
  readonly onSaveChangeHistory: (
    input: EquipmentChangeHistoryCreateInput,
  ) => Promise<EquipmentChangeHistory | null>
  readonly onResetChangeHistorySave: () => void
  readonly onReloadReports: () => void
  readonly onReloadInspections: () => void
  readonly onReloadGuides: () => void
  readonly onReloadTroubleshooting: () => void
  readonly onSelectTroubleshootingGuide: (guideId: string) => void
  readonly onClearTroubleshootingGuide: () => void
}

function getLegacyCategoryLabel(category: LegacyWorkReportCategory): string {
  return (
    LEGACY_WORK_REPORT_CATEGORY_OPTIONS.find(
      (option) => option.value === category,
    )?.label ?? category
  )
}

function hasLegacyDetails(report: WorkReport): boolean {
  return (
    report.legacy_category !== null ||
    report.legacy_work_hours !== null ||
    report.legacy_notes !== null
  )
}

function getInspectionCycleLabel(cycle: InspectionCycle): string {
  return (
    INSPECTION_CYCLE_OPTIONS.find((option) => option.value === cycle)?.label ??
    cycle
  )
}

function getInspectionItemValue(item: InspectionRecordItem): string {
  if (item.input_type === 'number') {
    return `${item.number_value ?? '未入力'}${item.unit ? ` ${item.unit}` : ''}`
  }
  return item.status_value === 'normal' ? '正常' : '異常'
}

function getInspectionCriterion(item: InspectionRecordItem): string {
  if (item.input_type === 'number') {
    return `正常範囲：${item.normal_min} ～ ${item.normal_max}${item.unit ? ` ${item.unit}` : ''}`
  }
  return `正常状態：${item.normal_state ?? '未登録'}`
}

function getInspectionGuideCriterion(item: InspectionTemplateItem): string {
  if (item.input_type === 'number') {
    return `正常範囲：${item.normal_min} ～ ${item.normal_max}${item.unit ? ` ${item.unit}` : ''}`
  }
  return `正常状態：${item.normal_state ?? '未登録'}`
}

function EquipmentChangeHistoryCard({
  history,
}: {
  readonly history: EquipmentChangeHistory
}) {
  return (
    <li>
      <article className="equipment-profile-change-card">
        <div className="equipment-profile-change-heading">
          <div>
            <time dateTime={history.changed_on}>
              {formatWorkReportDate(history.changed_on)}
            </time>
            <h5>{history.improvement_point}</h5>
          </div>
          <span>{history.work_report_id ? '関連日報あり' : '単独記録'}</span>
        </div>
        <p>{history.change_details}</p>
      </article>
    </li>
  )
}

function EquipmentReportCard({ report }: { readonly report: WorkReport }) {
  return (
    <li>
      <article className="equipment-profile-report-card">
        <div className="equipment-profile-report-heading">
          <div>
            <time dateTime={report.work_date}>
              {formatWorkReportDate(report.work_date)}
            </time>
            <h5>{report.phenomenon ?? '旧形式日報（現象未登録）'}</h5>
          </div>
          <span>{getWorkReportProgressLabel(report.progress)}</span>
        </div>
        <dl>
          <div>
            <dt>原因</dt>
            <dd>{report.cause ?? '未特定'}</dd>
          </div>
          <div>
            <dt>作業内容</dt>
            <dd>{report.work_content}</dd>
          </div>
        </dl>
        {hasLegacyDetails(report) && (
          <details>
            <summary>旧形式の詳細を表示</summary>
            <p>
              {report.legacy_category
                ? `カテゴリ：${getLegacyCategoryLabel(report.legacy_category)}\n`
                : ''}
              {report.legacy_work_hours !== null
                ? `作業時間：${report.legacy_work_hours}時間\n`
                : ''}
              {report.legacy_notes ? `備考：${report.legacy_notes}` : ''}
            </p>
          </details>
        )}
      </article>
    </li>
  )
}

function EquipmentInspectionCard({
  record,
}: {
  readonly record: InspectionRecord
}) {
  return (
    <li>
      <article className="equipment-profile-inspection-card">
        <div className="equipment-profile-inspection-heading">
          <div>
            <time dateTime={record.inspection_date}>
              {formatWorkReportDate(record.inspection_date)}
            </time>
            <h5>{getInspectionCycleLabel(record.cycle)}点検</h5>
          </div>
          <span className={`is-${record.overall_judgment}`}>
            {record.overall_judgment === 'normal' ? '総合：正常' : '総合：異常'}
          </span>
        </div>
        <details>
          <summary>点検結果を表示（{record.items.length}項目）</summary>
          <ul>
            {record.items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{getInspectionCriterion(item)}</small>
                </div>
                <div>
                  <strong>{getInspectionItemValue(item)}</strong>
                  <span className={`is-${item.judgment}`}>
                    {item.judgment === 'normal' ? '正常' : '異常'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      </article>
    </li>
  )
}

function EquipmentInspectionGuideCard({
  item,
  index,
}: {
  readonly item: InspectionTemplateItem
  readonly index: number
}) {
  return (
    <li>
      <article className="equipment-profile-guide-card">
        <div className="equipment-profile-guide-item-heading">
          <span>{index + 1}</span>
          <div>
            <h5>{item.name}</h5>
            <small>{getInspectionGuideCriterion(item)}</small>
          </div>
        </div>
        <dl>
          <div>
            <dt>確認方法</dt>
            <dd>{item.check_method ?? '未登録'}</dd>
          </div>
          <div className={item.caution_note ? 'has-caution' : ''}>
            <dt>注意・引継ぎ</dt>
            <dd>{item.caution_note ?? '未登録'}</dd>
          </div>
        </dl>
      </article>
    </li>
  )
}

export function EquipmentProfileContent({
  equipment,
  departmentName,
  manufacturerName,
  changeHistoriesState,
  changeHistorySaveState,
  reportsState,
  inspectionsState,
  guidesState,
  troubleshootingListState,
  troubleshootingDetailState,
  onReloadChangeHistories,
  onSaveChangeHistory,
  onResetChangeHistorySave,
  onReloadReports,
  onReloadInspections,
  onReloadGuides,
  onReloadTroubleshooting,
  onSelectTroubleshootingGuide,
  onClearTroubleshootingGuide,
  onStartWorkReport,
  canManagePhoto = false,
  onEquipmentPhotoChanged,
  onClose,
  sectionId = 'equipment-profile',
}: EquipmentProfileContentProps) {
  const titleId = `${sectionId}-title`
  const firstGuideCycle =
    guidesState.phase === 'ready'
      ? INSPECTION_CYCLE_OPTIONS.find((cycle) =>
          guidesState.items.some((item) => item.cycle === cycle.value),
        )?.value
      : undefined
  return (
    <section
      id={sectionId}
      className="equipment-profile-panel"
      aria-labelledby={titleId}
    >
      <div className="equipment-profile-heading">
        <div>
          <p className="eyebrow">KNOWLEDGE / EQUIPMENT PROFILE</p>
          <h3 id={titleId}>設備カルテ</h3>
        </div>
        <button type="button" onClick={onClose}>
          カルテを閉じる
        </button>
      </div>

      <div className="equipment-profile-overview">
        <EquipmentPhotoPanel
          key={equipment.equipment_id}
          equipment={equipment}
          canManage={canManagePhoto}
          onEquipmentChanged={onEquipmentPhotoChanged}
        />
        <div className="equipment-profile-summary">
          <div className="equipment-profile-title-row">
            <div>
              <span>{departmentName}</span>
              <h4>{getEquipmentDisplayName(equipment)}</h4>
            </div>
            <strong
              className={equipment.is_active ? 'is-active' : 'is-inactive'}
            >
              {equipment.is_active ? '使用中' : '使用停止'}
            </strong>
          </div>
          <dl>
            <div>
              <dt>部門</dt>
              <dd>{departmentName}</dd>
            </div>
            <div>
              <dt>メーカー</dt>
              <dd>{manufacturerName}</dd>
            </div>
            <div>
              <dt>設備名</dt>
              <dd>{equipment.name}</dd>
            </div>
            <div>
              <dt>設備番号・呼称</dt>
              <dd>{equipment.equipment_number ?? '未登録'}</dd>
            </div>
            <div>
              <dt>型式</dt>
              <dd>{equipment.model_number ?? '未登録'}</dd>
            </div>
            <div>
              <dt>固有設備ID</dt>
              <dd className="equipment-profile-id">{equipment.equipment_id}</dd>
            </div>
          </dl>
        </div>
      </div>

      <TroubleshootingGuideViewer
        listState={troubleshootingListState}
        detailState={troubleshootingDetailState}
        onReloadList={onReloadTroubleshooting}
        onSelectGuide={onSelectTroubleshootingGuide}
        onClearGuide={onClearTroubleshootingGuide}
        onStartWorkReport={
          onStartWorkReport
            ? (guide) =>
                onStartWorkReport({
                  departmentId: equipment.department_id,
                  equipmentId: equipment.equipment_id,
                  phenomenon: guide.symptom,
                })
            : undefined
        }
      />

      <div className="equipment-profile-guides">
        <div className="equipment-profile-history-heading">
          <div>
            <span>GUIDE / INSPECTION</span>
            <h4>この設備の点検作業ガイド</h4>
          </div>
          {guidesState.phase === 'ready' && (
            <small>
              登録{guidesState.total}件／表示{guidesState.items.length}件
            </small>
          )}
        </div>
        <p className="equipment-profile-guide-intro">
          周期を開くと、点検項目ごとの確認方法・正常基準・注意事項を確認できます。会社固有の安全手順を優先してください。
        </p>

        {guidesState.phase === 'loading' && (
          <p className="equipment-profile-state" role="status">
            この設備の点検作業ガイドを読み込んでいます…
          </p>
        )}
        {guidesState.phase === 'error' && (
          <div className="equipment-profile-state is-error" role="alert">
            <p>この設備の点検作業ガイドを読み込めませんでした。</p>
            <button type="button" onClick={onReloadGuides}>
              もう一度読み込む
            </button>
          </div>
        )}
        {guidesState.phase === 'ready' && guidesState.items.length === 0 && (
          <p className="equipment-profile-state">
            この設備の点検作業ガイドはまだ登録されていません。
          </p>
        )}
        {guidesState.phase === 'ready' && guidesState.items.length > 0 && (
          <div className="equipment-profile-guide-cycles">
            {INSPECTION_CYCLE_OPTIONS.map((cycle) => {
              const cycleItems = guidesState.items.filter(
                (item) => item.cycle === cycle.value,
              )
              return (
                <details
                  key={cycle.value}
                  open={cycle.value === firstGuideCycle}
                >
                  <summary>
                    <span>{cycle.label}点検</span>
                    <small>{cycleItems.length}項目</small>
                  </summary>
                  {cycleItems.length === 0 ? (
                    <p>この周期のガイドは未登録です。</p>
                  ) : (
                    <ol>
                      {cycleItems.map((item, index) => (
                        <EquipmentInspectionGuideCard
                          key={item.id}
                          item={item}
                          index={index}
                        />
                      ))}
                    </ol>
                  )}
                </details>
              )
            })}
          </div>
        )}
      </div>

      <div className="equipment-profile-inspections">
        <div className="equipment-profile-history-heading">
          <div>
            <span>INSPECTION RECORDS</span>
            <h4>この設備の最新点検記録</h4>
          </div>
          {inspectionsState.phase === 'ready' && (
            <small>
              登録{inspectionsState.total}件／最新
              {inspectionsState.items.length}件
            </small>
          )}
        </div>

        {inspectionsState.phase === 'loading' && (
          <p className="equipment-profile-state" role="status">
            この設備の点検記録を読み込んでいます…
          </p>
        )}
        {inspectionsState.phase === 'error' && (
          <div className="equipment-profile-state is-error" role="alert">
            <p>この設備の点検記録を読み込めませんでした。</p>
            <button type="button" onClick={onReloadInspections}>
              もう一度読み込む
            </button>
          </div>
        )}
        {inspectionsState.phase === 'ready' &&
          inspectionsState.items.length === 0 && (
            <p className="equipment-profile-state">
              この設備に紐づく点検記録はまだありません。
            </p>
          )}
        {inspectionsState.phase === 'ready' &&
          inspectionsState.items.length > 0 && (
            <ol className="equipment-profile-inspection-list">
              {inspectionsState.items.map((record) => (
                <EquipmentInspectionCard key={record.id} record={record} />
              ))}
            </ol>
          )}
      </div>

      <div className="equipment-profile-changes">
        <div className="equipment-profile-history-heading">
          <div>
            <span>KNOWLEDGE / CHANGE HISTORY</span>
            <h4>この設備の改良・変更履歴</h4>
          </div>
          {changeHistoriesState.phase === 'ready' && (
            <small>
              登録{changeHistoriesState.total}件／最新
              {changeHistoriesState.items.length}件
            </small>
          )}
        </div>

        <EquipmentChangeHistoryForm
          key={equipment.equipment_id}
          equipment={equipment}
          availableReports={
            reportsState.phase === 'ready' ? reportsState.items : []
          }
          saveState={changeHistorySaveState}
          onSave={onSaveChangeHistory}
          onResetSave={onResetChangeHistorySave}
        />

        {changeHistoriesState.phase === 'loading' && (
          <p className="equipment-profile-state" role="status">
            この設備の改良・変更履歴を読み込んでいます…
          </p>
        )}
        {changeHistoriesState.phase === 'error' && (
          <div className="equipment-profile-state is-error" role="alert">
            <p>この設備の改良・変更履歴を読み込めませんでした。</p>
            <button type="button" onClick={onReloadChangeHistories}>
              もう一度読み込む
            </button>
          </div>
        )}
        {changeHistoriesState.phase === 'ready' &&
          changeHistoriesState.items.length === 0 && (
            <p className="equipment-profile-state">
              この設備の改良・変更履歴はまだありません。
            </p>
          )}
        {changeHistoriesState.phase === 'ready' &&
          changeHistoriesState.items.length > 0 && (
            <ol className="equipment-profile-change-list">
              {changeHistoriesState.items.map((history) => (
                <EquipmentChangeHistoryCard
                  key={history.change_history_id}
                  history={history}
                />
              ))}
            </ol>
          )}
      </div>

      <div className="equipment-profile-history">
        <div className="equipment-profile-history-heading">
          <div>
            <span>WORK REPORTS</span>
            <h4>この設備の最新作業日報</h4>
          </div>
          {reportsState.phase === 'ready' && (
            <small>
              登録{reportsState.total}件／最新{reportsState.items.length}件
            </small>
          )}
        </div>

        {reportsState.phase === 'loading' && (
          <p className="equipment-profile-state" role="status">
            この設備の日報を読み込んでいます…
          </p>
        )}
        {reportsState.phase === 'error' && (
          <div className="equipment-profile-state is-error" role="alert">
            <p>この設備の日報を読み込めませんでした。</p>
            <button type="button" onClick={onReloadReports}>
              もう一度読み込む
            </button>
          </div>
        )}
        {reportsState.phase === 'ready' && reportsState.items.length === 0 && (
          <p className="equipment-profile-state">
            この設備に紐づく作業日報はまだありません。
          </p>
        )}
        {reportsState.phase === 'ready' && reportsState.items.length > 0 && (
          <ol className="equipment-profile-report-list">
            {reportsState.items.map((report) => (
              <EquipmentReportCard key={report.id} report={report} />
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

export function EquipmentProfilePanel(props: EquipmentProfilePanelProps) {
  const {
    state: changeHistoriesState,
    saveState: changeHistorySaveState,
    reload: reloadChangeHistories,
    save: saveChangeHistory,
    resetSave: resetChangeHistorySave,
  } = useEquipmentProfileChangeHistories(props.equipment.equipment_id)
  const { state: reportsState, reload: reloadReports } =
    useEquipmentProfileReports(props.equipment.equipment_id)
  const { state: inspectionsState, reload: reloadInspections } =
    useEquipmentProfileInspections(props.equipment.equipment_id)
  const { state: guidesState, reload: reloadGuides } =
    useEquipmentProfileGuides(
      props.equipment.equipment_id,
      props.templateRefreshToken,
    )
  const {
    listState: troubleshootingListState,
    detailState: troubleshootingDetailState,
    reloadList: reloadTroubleshooting,
    selectGuide: selectTroubleshootingGuide,
    clearGuide: clearTroubleshootingGuide,
  } = useEquipmentTroubleshooting(props.equipment.equipment_id)
  return (
    <EquipmentProfileContent
      {...props}
      changeHistoriesState={changeHistoriesState}
      changeHistorySaveState={changeHistorySaveState}
      reportsState={reportsState}
      inspectionsState={inspectionsState}
      guidesState={guidesState}
      troubleshootingListState={troubleshootingListState}
      troubleshootingDetailState={troubleshootingDetailState}
      onReloadChangeHistories={reloadChangeHistories}
      onSaveChangeHistory={saveChangeHistory}
      onResetChangeHistorySave={resetChangeHistorySave}
      onReloadReports={reloadReports}
      onReloadInspections={reloadInspections}
      onReloadGuides={reloadGuides}
      onReloadTroubleshooting={reloadTroubleshooting}
      onSelectTroubleshootingGuide={selectTroubleshootingGuide}
      onClearTroubleshootingGuide={clearTroubleshootingGuide}
    />
  )
}

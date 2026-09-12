import { useEffect, useRef, useState, type FormEvent } from 'react'

import { useWorkReportAttentionSummary } from '../hooks/useWorkReportAttentionSummary'
import { useWorkReports } from '../hooks/useWorkReports'
import {
  LEGACY_WORK_REPORT_CATEGORY_OPTIONS,
  WORK_REPORT_PROGRESS_OPTIONS,
  type LegacyWorkReportCategory,
  type WorkReport,
  type WorkReportAttentionProgress,
  type WorkReportEquipmentOptionsState,
  type WorkReportProgress,
  type WorkReportSearchFilters,
} from '../types'
import {
  formatWorkReportDate,
  getWorkReportProgressLabel,
} from '../workReportForm'
import { createAttentionProgressSearchFilters } from '../workReportAttention'
import { WorkReportAttentionSummary } from './WorkReportAttentionSummary'
import { WorkReportEditPanel } from './WorkReportEditPanel'
import './WorkReportHistoryPanel.css'

type WorkReportHistoryListProps = {
  readonly items: readonly WorkReport[]
  readonly total: number
  readonly activeFilterLabels?: readonly string[]
  readonly onEdit?: (report: WorkReport) => void
}

type WorkReportHistoryPanelProps = {
  readonly refreshToken: number
  readonly equipmentOptionsState: WorkReportEquipmentOptionsState
  readonly onReloadEquipmentOptions: () => void
  readonly mode?: 'combined' | 'attention' | 'search'
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

export function WorkReportHistoryList({
  items,
  total,
  activeFilterLabels = [],
  onEdit,
}: WorkReportHistoryListProps) {
  const remaining = Math.max(total - items.length, 0)
  const filterLabel = activeFilterLabels.join('・')
  const hasActiveFilter = activeFilterLabels.length > 0

  return (
    <>
      <p className="work-report-history-summary" role="status">
        {hasActiveFilter ? (
          <>
            {filterLabel}の検索結果 <strong>{total}件</strong> ／ 表示{' '}
            <strong>{items.length}件</strong> ／ 残り{' '}
            <strong>{remaining}件</strong>
          </>
        ) : (
          <>
            保存済み合計 <strong>{total}件</strong> ／ 最新{' '}
            <strong>{items.length}件</strong>を表示 ／ 残り{' '}
            <strong>{remaining}件</strong>
          </>
        )}
      </p>
      <ol className="work-report-history-list">
        {items.map((report) => (
          <li key={report.id}>
            <article className="work-report-history-card">
              <div className="work-report-history-card-heading">
                <div>
                  <time dateTime={report.work_date}>
                    {formatWorkReportDate(report.work_date)}
                  </time>
                  <h3>{report.phenomenon ?? report.work_content}</h3>
                </div>
                <span>{getWorkReportProgressLabel(report.progress)}</span>
              </div>
              <dl>
                <div>
                  <dt>部門</dt>
                  <dd>{report.department_name ?? '未設定'}</dd>
                </div>
                <div>
                  <dt>設備</dt>
                  <dd>
                    {report.equipment_name
                      ? `${report.equipment_name}${
                          report.equipment_number
                            ? ` ${report.equipment_number}`
                            : ''
                        }`
                      : '設備未設定'}
                  </dd>
                </div>
                <div>
                  <dt>原因</dt>
                  <dd>{report.cause ?? '未特定'}</dd>
                </div>
                <div>
                  <dt>作業内容</dt>
                  <dd>{report.work_content}</dd>
                </div>
              </dl>
              {report.is_legacy && (
                <p className="work-report-history-limit-note">
                  旧形式日報（現象・原因は未登録）
                </p>
              )}
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
              {onEdit && (
                <button
                  className="work-report-history-edit-button"
                  type="button"
                  onClick={() => onEdit(report)}
                >
                  この日報を編集
                </button>
              )}
            </article>
          </li>
        ))}
      </ol>
      {total > items.length && (
        <p className="work-report-history-limit-note">
          {hasActiveFilter
            ? '条件に一致する日報のうち最新5件だけを表示しています。'
            : 'この画面は最新5件だけを表示しています。'}
        </p>
      )}
    </>
  )
}

export function WorkReportHistoryPanel({
  refreshToken,
  equipmentOptionsState,
  onReloadEquipmentOptions,
  mode = 'combined',
}: WorkReportHistoryPanelProps) {
  const [workDate, setWorkDate] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [workContentQuery, setWorkContentQuery] = useState('')
  const [progress, setProgress] = useState<WorkReportProgress | ''>('')
  const [editingReport, setEditingReport] = useState<WorkReport | null>(null)
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState<
    string | null
  >(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const historySurfaceRef = useRef<HTMLDivElement>(null)
  const { state, activeFilters, search, clearSearch, reload } =
    useWorkReports(refreshToken)
  const { state: attentionSummaryState, reload: reloadAttentionSummary } =
    useWorkReportAttentionSummary(refreshToken)
  const activeDepartmentName = activeFilters.departmentId
    ? equipmentOptionsState.phase === 'ready'
      ? (equipmentOptionsState.departments.find(
          (department) => department.id === activeFilters.departmentId,
        )?.name ?? '部門指定')
      : '部門指定'
    : null
  const activeFilterLabels = [
    activeFilters.workDate
      ? formatWorkReportDate(activeFilters.workDate)
      : null,
    activeDepartmentName,
    activeFilters.workContentQuery
      ? `作業内容「${activeFilters.workContentQuery}」`
      : null,
    activeFilters.progress
      ? getWorkReportProgressLabel(activeFilters.progress)
      : null,
  ].filter((label): label is string => Boolean(label))
  const activeFilterCount = activeFilterLabels.length
  const showAttentionSummary = mode !== 'search'
  const showSearch = mode !== 'attention'
  const showHistorySurface =
    mode !== 'attention' || progress === 'continued' || progress === 'follow_up'
  const hasDraftFilter = Boolean(
    workDate || departmentId || workContentQuery.trim() || progress,
  )

  useEffect(() => {
    if (editingReport) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [editingReport])

  useEffect(() => {
    if (
      mode !== 'attention' ||
      (progress !== 'continued' && progress !== 'follow_up')
    ) {
      return
    }
    historySurfaceRef.current?.focus({ preventScroll: true })
    historySurfaceRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [mode, progress])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const filters: WorkReportSearchFilters = {
      workDate: workDate || null,
      departmentId: departmentId || null,
      workContentQuery: workContentQuery.trim() || null,
      progress: progress || null,
    }
    if (Object.values(filters).some(Boolean)) search(filters)
  }

  function handleClearSearch() {
    setWorkDate('')
    setDepartmentId('')
    setWorkContentQuery('')
    setProgress('')
    clearSearch()
  }

  function handleAttentionProgressSelect(
    selectedProgress: WorkReportAttentionProgress,
  ) {
    setWorkDate('')
    setDepartmentId('')
    setWorkContentQuery('')
    setProgress(selectedProgress)
    setEditingReport(null)
    setUpdateSuccessMessage(null)
    search(createAttentionProgressSearchFilters(selectedProgress))
    if (mode !== 'attention') {
      historySurfaceRef.current?.focus({ preventScroll: true })
      historySurfaceRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  function handleUpdatedReport() {
    setEditingReport(null)
    setUpdateSuccessMessage(
      '日報の変更を保存できました。最新の内容を読み込んでいます。',
    )
    reload()
    reloadAttentionSummary()
  }

  return (
    <section
      className="work-report-history-section"
      aria-labelledby={
        mode === 'attention'
          ? 'work-report-attention-screen-title'
          : 'work-report-history-title'
      }
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {mode === 'attention' ? 'MANAGE / ATTENTION' : 'MANAGE / HISTORY'}
          </p>
          <h2
            id={
              mode === 'attention'
                ? 'work-report-attention-screen-title'
                : 'work-report-history-title'
            }
          >
            {mode === 'attention' ? '要対応' : '履歴を探す'}
          </h2>
        </div>
        <p>
          {mode === 'attention'
            ? progress
              ? `${getWorkReportProgressLabel(progress)}を表示`
              : '継続対応・経過確認'
            : activeFilterCount > 0
              ? `${activeFilterCount}条件で検索中`
              : '最新5件'}
        </p>
      </div>

      {showAttentionSummary && (
        <WorkReportAttentionSummary
          state={attentionSummaryState}
          activeProgress={
            activeFilters.progress === 'continued' ||
            activeFilters.progress === 'follow_up'
              ? activeFilters.progress
              : null
          }
          onReload={reloadAttentionSummary}
          onSelectProgress={handleAttentionProgressSelect}
        />
      )}

      {showSearch && (
        <form className="work-report-history-search" onSubmit={handleSearch}>
          <div className="work-report-history-search-heading">
            <div>
              <span>HISTORY SEARCH</span>
              <h3>日報の基本検索</h3>
            </div>
            {activeFilterCount > 0 && <strong>{activeFilterCount}条件</strong>}
          </div>
          <p className="work-report-history-search-intro">
            作業日・部門・作業内容を自由に組み合わせて検索できます。
          </p>

          <div className="work-report-history-search-grid">
            <label htmlFor="work-report-history-date">
              <span>作業日</span>
              <input
                id="work-report-history-date"
                type="date"
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
              />
            </label>
            <label htmlFor="work-report-history-department">
              <span>部門</span>
              <select
                id="work-report-history-department"
                value={departmentId}
                disabled={equipmentOptionsState.phase !== 'ready'}
                onChange={(event) => setDepartmentId(event.target.value)}
              >
                <option value="">
                  {equipmentOptionsState.phase === 'loading'
                    ? '部門を読み込んでいます'
                    : equipmentOptionsState.phase === 'error'
                      ? '部門を読み込めません'
                      : 'すべての部門'}
                </option>
                {equipmentOptionsState.phase === 'ready' &&
                  equipmentOptionsState.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor="work-report-history-content">
              <span>作業内容</span>
              <input
                id="work-report-history-content"
                type="search"
                value={workContentQuery}
                maxLength={200}
                placeholder="例：ベルト交換"
                onChange={(event) => setWorkContentQuery(event.target.value)}
              />
            </label>
          </div>

          {equipmentOptionsState.phase === 'error' && (
            <p className="work-report-history-search-error" role="alert">
              部門を読み込めませんでした。
              <button type="button" onClick={onReloadEquipmentOptions}>
                部門を再読み込み
              </button>
            </p>
          )}

          <details className="work-report-history-advanced-search">
            <summary>詳細条件（進捗）</summary>
            <label htmlFor="work-report-history-progress">
              <span>進捗</span>
              <select
                id="work-report-history-progress"
                value={progress}
                onChange={(event) =>
                  setProgress(event.target.value as WorkReportProgress | '')
                }
              >
                <option value="">すべての進捗</option>
                {WORK_REPORT_PROGRESS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </details>

          <div className="work-report-history-search-actions">
            <button type="submit" disabled={!hasDraftFilter}>
              この条件で検索
            </button>
            <button
              className="is-secondary"
              type="button"
              disabled={!hasDraftFilter && activeFilterCount === 0}
              onClick={handleClearSearch}
            >
              条件をすべて解除
            </button>
          </div>
        </form>
      )}

      {editingReport && (
        <div ref={editorRef}>
          <WorkReportEditPanel
            key={editingReport.id}
            report={editingReport}
            onCancel={() => setEditingReport(null)}
            onUpdated={handleUpdatedReport}
            equipmentOptionsState={equipmentOptionsState}
            onReloadEquipmentOptions={onReloadEquipmentOptions}
          />
        </div>
      )}

      {updateSuccessMessage && (
        <p className="work-report-history-update-success" role="status">
          {updateSuccessMessage}
        </p>
      )}

      {mode === 'attention' && !showHistorySurface && (
        <p className="work-report-history-state" role="status">
          「継続対応」または「経過確認」の対象日報を見ると、ここに対象日報を表示します。
        </p>
      )}

      {showHistorySurface && (
        <div
          ref={historySurfaceRef}
          className="work-report-history-surface"
          tabIndex={-1}
          aria-live="polite"
        >
          {state.phase === 'loading' && (
            <p className="work-report-history-state" role="status">
              {activeFilterLabels.length > 0
                ? `${activeFilterLabels.join('・')}の日報を検索しています…`
                : '最新の日報を読み込んでいます…'}
            </p>
          )}
          {state.phase === 'error' && (
            <div className="work-report-history-state is-error" role="alert">
              <p>
                日報を読み込めませんでした。Phoenix
                APIの起動状態を確認してください。
              </p>
              <button type="button" onClick={reload}>
                もう一度読み込む
              </button>
            </div>
          )}
          {state.phase === 'ready' && state.items.length === 0 && (
            <p className="work-report-history-state">
              {activeFilterLabels.length > 0
                ? '条件に一致する日報はありません。'
                : '保存済みの日報はまだありません。'}
            </p>
          )}
          {state.phase === 'ready' && state.items.length > 0 && (
            <WorkReportHistoryList
              items={state.items}
              total={state.total}
              activeFilterLabels={activeFilterLabels}
              onEdit={setEditingReport}
            />
          )}
        </div>
      )}
    </section>
  )
}

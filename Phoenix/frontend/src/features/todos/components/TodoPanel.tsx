import { useEffect, useMemo, useState, type FormEvent } from 'react'

import type { WorkReportEquipmentOptionsState } from '../../work-reports/types'
import { useTodos } from '../hooks/useTodos'
import { buildTodoClipboardText, copyTodoToClipboard } from '../todoClipboard'
import { downloadTodosCsv, parseTodosCsv, TodoCsvError } from '../todoCsv'
import { clearTodoDraft, loadTodoDraft, saveTodoDraft } from '../todoDraft'
import {
  getTodoEquipmentDepartmentId,
  getTodoEquipmentSummary,
} from '../todoEquipment'
import {
  countTodosWithMatchingTitle,
  getTodoInputExcludedIndexes,
  getTodoInputIndexesMatchingExistingTitles,
  getTodoInputIndexesWithRepeatedTitles,
  getTodoInputsExcludingIndexes,
} from '../todoDuplicate'
import { getTodoRepeatOptions } from '../todoRepeat'
import {
  getTodoDueDateQuickOptions,
  getTodoDueDateRelativeLabel,
} from '../todoDueDate'
import { formatTodoUpdatedAt } from '../todoUpdatedAt'
import type {
  Todo,
  TodoCreateInput,
  TodoEditInput,
  TodoPriority,
} from '../types'
import {
  filterTodos,
  getLocalDateString,
  getTodoCategoryFilterOptions,
  getTodoAttentionCounts,
  getTodoDueState,
  getTodoProgressSummary,
  getTodoViewChangeCount,
  makeTodoCategoryFilter,
  sortTodos,
  type TodoAttentionCounts,
  type TodoCategoryFilter,
  type TodoCategoryFilterOption,
  type TodoDueFilter,
  type TodoDueState,
  type TodoPinnedFilter,
  type TodoPriorityFilter,
  type TodoProgressSummary as TodoProgressSummaryValue,
  type TodoSortOption,
  type TodoStatusFilter,
} from './todoFilters'
import {
  loadTodoViewPreferences,
  saveTodoViewPreferences,
} from './todoViewPreferences'
import { TodoDescription } from './TodoDescription'
import { TodoEquipmentFields } from './TodoEquipmentFields'
import './TodoPanel.css'

const LOADING_EQUIPMENT_OPTIONS: WorkReportEquipmentOptionsState = {
  phase: 'loading',
}

function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

const TODO_FILTER_OPTIONS: readonly {
  readonly value: TodoStatusFilter
  readonly label: string
}[] = [
  { value: 'all', label: 'すべて' },
  { value: 'active', label: '未完了' },
  { value: 'completed', label: '完了' },
]

const TODO_DUE_FILTER_OPTIONS: readonly {
  readonly value: TodoDueFilter
  readonly label: string
}[] = [
  { value: 'all', label: 'すべて' },
  { value: 'overdue', label: '期限切れ' },
  { value: 'today', label: '今日' },
  { value: 'next7days', label: '7日以内' },
  { value: 'upcoming', label: '今後' },
  { value: 'none', label: '期限なし' },
]

const TODO_DUE_BADGE_CLASSES: Partial<Record<TodoDueState, string>> = {
  overdue: 'overdue',
  today: 'today',
  upcoming: 'upcoming',
}

const TODO_PRIORITY_OPTIONS: readonly {
  readonly value: TodoPriority
  readonly label: string
}[] = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const TODO_PRIORITY_FILTER_OPTIONS: readonly {
  readonly value: TodoPriorityFilter
  readonly label: string
}[] = [{ value: 'all', label: 'すべて' }, ...TODO_PRIORITY_OPTIONS]

const TODO_SORT_OPTIONS: readonly {
  readonly value: TodoSortOption
  readonly label: string
}[] = [
  { value: 'due', label: '期限が近い順' },
  { value: 'priority', label: '優先度が高い順' },
  { value: 'updated', label: '最近更新した順' },
  { value: 'newest', label: '新しい順' },
  { value: 'oldest', label: '古い順' },
]

type TodoAttentionSummaryProps = {
  readonly counts: TodoAttentionCounts
  readonly onShowOverdue: () => void
  readonly onShowToday: () => void
  readonly onShowHighPriority: () => void
}

export function TodoAttentionSummary({
  counts,
  onShowOverdue,
  onShowToday,
  onShowHighPriority,
}: TodoAttentionSummaryProps) {
  return (
    <section
      className="todo-attention-summary"
      aria-labelledby="todo-attention-title"
    >
      <div className="todo-attention-heading">
        <span>ATTENTION</span>
        <h4 id="todo-attention-title">期限・優先度アラート</h4>
      </div>
      <div className="todo-attention-buttons">
        <button
          type="button"
          className="overdue"
          disabled={counts.overdue === 0}
          onClick={onShowOverdue}
        >
          <strong>{counts.overdue}件</strong>
          <span>期限切れ</span>
        </button>
        <button
          type="button"
          className="today"
          disabled={counts.today === 0}
          onClick={onShowToday}
        >
          <strong>{counts.today}件</strong>
          <span>今日まで</span>
        </button>
        <button
          type="button"
          className="high-priority"
          disabled={counts.highPriority === 0}
          onClick={onShowHighPriority}
        >
          <strong>{counts.highPriority}件</strong>
          <span>優先度 高</span>
        </button>
      </div>
      <p>数字を押すと、未完了の該当ToDoだけを表示します。</p>
    </section>
  )
}

type TodoProgressSummaryProps = {
  readonly summary: TodoProgressSummaryValue
  readonly onShowActive: () => void
  readonly onShowCompleted: () => void
}

export function TodoProgressSummary({
  summary,
  onShowActive,
  onShowCompleted,
}: TodoProgressSummaryProps) {
  return (
    <section
      className="todo-progress-summary"
      aria-labelledby="todo-progress-title"
    >
      <div className="todo-progress-heading">
        <div>
          <span>PROGRESS</span>
          <h4 id="todo-progress-title">ToDo進捗</h4>
        </div>
        <strong>{summary.completionRate}% 完了</strong>
      </div>
      <div
        className="todo-progress-track"
        role="progressbar"
        aria-label="ToDo完了率"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.completionRate}
      >
        <span style={{ width: `${summary.completionRate}%` }} />
      </div>
      <div className="todo-progress-buttons">
        <button
          type="button"
          className="active"
          disabled={summary.active === 0}
          onClick={onShowActive}
        >
          <strong>{summary.active}件</strong>
          <span>未完了</span>
        </button>
        <button
          type="button"
          className="completed"
          disabled={summary.completed === 0}
          onClick={onShowCompleted}
        >
          <strong>{summary.completed}件</strong>
          <span>完了</span>
        </button>
      </div>
      <p>{summary.total}件の進み具合です。件数を押すと一覧を切り替えます。</p>
    </section>
  )
}

type TodoArchiveView = 'current' | 'archived'

type TodoArchiveViewControlsProps = {
  readonly view: TodoArchiveView
  readonly currentCount: number
  readonly archivedCount: number
  readonly onViewChange: (view: TodoArchiveView) => void
}

export function TodoArchiveViewControls({
  view,
  currentCount,
  archivedCount,
  onViewChange,
}: TodoArchiveViewControlsProps) {
  return (
    <section
      className="todo-archive-view-controls"
      aria-labelledby="todo-archive-view-title"
    >
      <div>
        <strong id="todo-archive-view-title">完了ToDoの保管</strong>
        <p>読み込み済みの完了ToDoを通常一覧から分けて保管できます。</p>
      </div>
      <div
        className="todo-archive-view-buttons"
        role="group"
        aria-label="ToDoの保管状態を切り替える"
      >
        <button
          type="button"
          className={view === 'current' ? 'is-active' : ''}
          aria-pressed={view === 'current'}
          onClick={() => onViewChange('current')}
        >
          現在のToDo（{currentCount}）
        </button>
        <button
          type="button"
          className={view === 'archived' ? 'is-active' : ''}
          aria-pressed={view === 'archived'}
          onClick={() => onViewChange('archived')}
        >
          アーカイブ（{archivedCount}）
        </button>
      </div>
    </section>
  )
}

type TodoFilterControlsProps = {
  readonly query: string
  readonly statusFilter: TodoStatusFilter
  readonly dueFilter: TodoDueFilter
  readonly priorityFilter: TodoPriorityFilter
  readonly pinnedFilter: TodoPinnedFilter
  readonly pinnedCount: number
  readonly categoryFilter: TodoCategoryFilter
  readonly categoryFilterOptions: readonly TodoCategoryFilterOption[]
  readonly sortOption: TodoSortOption
  readonly visibleCount: number
  readonly loadedCount: number
  readonly activeViewChangeCount: number
  readonly onQueryChange: (query: string) => void
  readonly onStatusFilterChange: (filter: TodoStatusFilter) => void
  readonly onDueFilterChange: (filter: TodoDueFilter) => void
  readonly onPriorityFilterChange: (filter: TodoPriorityFilter) => void
  readonly onPinnedFilterChange: (filter: TodoPinnedFilter) => void
  readonly onCategoryFilterChange: (filter: TodoCategoryFilter) => void
  readonly onSortOptionChange: (option: TodoSortOption) => void
  readonly onResetView: () => void
}

export function TodoFilterControls({
  query,
  statusFilter,
  dueFilter,
  priorityFilter,
  pinnedFilter,
  pinnedCount,
  categoryFilter,
  categoryFilterOptions,
  sortOption,
  visibleCount,
  loadedCount,
  activeViewChangeCount,
  onQueryChange,
  onStatusFilterChange,
  onDueFilterChange,
  onPriorityFilterChange,
  onPinnedFilterChange,
  onCategoryFilterChange,
  onSortOptionChange,
  onResetView,
}: TodoFilterControlsProps) {
  const unpinnedCount = Math.max(loadedCount - pinnedCount, 0)

  return (
    <div className="todo-filter-panel">
      <div className="todo-search-field">
        <label htmlFor="todo-search">タイトル・説明・カテゴリを検索</label>
        <div>
          <input
            id="todo-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="キーワードを入力"
          />
          {query && (
            <button
              type="button"
              className="todo-search-clear"
              onClick={() => onQueryChange('')}
            >
              クリア
            </button>
          )}
        </div>
      </div>

      <div
        className="todo-status-filters"
        role="group"
        aria-label="状態で絞り込む"
      >
        {TODO_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={statusFilter === option.value ? 'is-active' : ''}
            aria-pressed={statusFilter === option.value}
            onClick={() => onStatusFilterChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="todo-pinned-filter-row">
        <span>固定状態で絞り込む</span>
        <div
          className="todo-pinned-filters"
          role="group"
          aria-label="固定状態で絞り込む"
        >
          <button
            type="button"
            className={pinnedFilter === 'all' ? 'is-active' : ''}
            aria-pressed={pinnedFilter === 'all'}
            onClick={() => onPinnedFilterChange('all')}
          >
            すべて
          </button>
          <button
            type="button"
            className={pinnedFilter === 'pinned' ? 'is-active' : ''}
            aria-pressed={pinnedFilter === 'pinned'}
            onClick={() => onPinnedFilterChange('pinned')}
          >
            固定中（{pinnedCount}）
          </button>
          <button
            type="button"
            className={pinnedFilter === 'unpinned' ? 'is-active' : ''}
            aria-pressed={pinnedFilter === 'unpinned'}
            onClick={() => onPinnedFilterChange('unpinned')}
          >
            通常（{unpinnedCount}）
          </button>
        </div>
      </div>

      <div className="todo-due-filter-row">
        <span>未完了ToDoを期限で絞り込む</span>
        <div
          className="todo-due-filters"
          role="group"
          aria-label="期限で絞り込む"
        >
          {TODO_DUE_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={dueFilter === option.value ? 'is-active' : ''}
              aria-pressed={dueFilter === option.value}
              onClick={() => onDueFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="todo-priority-filter-row">
        <span>優先度で絞り込む</span>
        <div
          className="todo-priority-filters"
          role="group"
          aria-label="優先度で絞り込む"
        >
          {TODO_PRIORITY_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={priorityFilter === option.value ? 'is-active' : ''}
              aria-pressed={priorityFilter === option.value}
              onClick={() => onPriorityFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="todo-category-filter-row">
        <span>カテゴリで絞り込む</span>
        <div
          className="todo-category-filters"
          role="group"
          aria-label="カテゴリで絞り込む"
        >
          {categoryFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={categoryFilter === option.value ? 'is-active' : ''}
              aria-pressed={categoryFilter === option.value}
              onClick={() => onCategoryFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="todo-filter-footer">
        <label className="todo-sort-field" htmlFor="todo-sort">
          <span>並べ替え</span>
          <select
            id="todo-sort"
            value={sortOption}
            onChange={(event) =>
              onSortOptionChange(event.target.value as TodoSortOption)
            }
          >
            {TODO_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="todo-filter-result">
          <p className="todo-filter-count" role="status">
            {loadedCount}件中 {visibleCount}件を表示
          </p>
          <button
            type="button"
            className="todo-filter-reset"
            disabled={activeViewChangeCount === 0}
            onClick={onResetView}
          >
            条件をリセット
            {activeViewChangeCount > 0 && `（${activeViewChangeCount}）`}
          </button>
        </div>
      </div>
      <p className="todo-filter-storage-note">
        表示条件はこの端末に自動保存されます（検索語を除く）。
      </p>
    </div>
  )
}

type TodoItemProps = {
  readonly todo: Todo
  readonly isBusy: boolean
  readonly isSelected: boolean
  readonly categoryOptions?: readonly string[]
  readonly today?: string
  readonly equipmentOptionsState?: WorkReportEquipmentOptionsState
  readonly onReloadEquipmentOptions?: () => void
  readonly onSelectionChange: (todoId: string, isSelected: boolean) => void
  readonly onEdit: (todoId: string, input: TodoEditInput) => Promise<boolean>
  readonly onDuplicate: (todo: Todo) => Promise<boolean>
  readonly onRepeat: (todo: Todo, dueDate: string) => Promise<boolean>
  readonly onToggle: (todo: Todo) => Promise<boolean>
  readonly onTogglePinned: (todo: Todo) => Promise<boolean>
  readonly onToggleArchived: (todo: Todo) => Promise<boolean>
  readonly onDelete: (todoId: string) => Promise<boolean>
}

type TodoDueDateQuickActionsProps = {
  readonly todo: Todo
  readonly isBusy: boolean
  readonly today: string
  readonly onSelect: (dueDate: string) => void
  readonly onClose: () => void
}

export function TodoDueDateQuickActions({
  todo,
  isBusy,
  today,
  onSelect,
  onClose,
}: TodoDueDateQuickActionsProps) {
  const options = getTodoDueDateQuickOptions(today)
  const currentDueDate = todo.due_date ?? ''

  return (
    <div
      className="todo-due-quick-panel"
      aria-label={`「${todo.title}」の期限を変更`}
    >
      <div className="todo-due-quick-heading">
        <strong>期限をすばやく変更</strong>
        <button type="button" disabled={isBusy} onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className="todo-due-quick-options">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            className={currentDueDate === option.value ? 'is-current' : ''}
            disabled={isBusy || currentDueDate === option.value}
            aria-label={
              option.value
                ? `${option.label}（${formatDueDate(option.value)}）`
                : option.label
            }
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

type TodoPriorityQuickActionsProps = {
  readonly todo: Todo
  readonly isBusy: boolean
  readonly onSelect: (priority: TodoPriority) => void
  readonly onClose: () => void
}

export function TodoPriorityQuickActions({
  todo,
  isBusy,
  onSelect,
  onClose,
}: TodoPriorityQuickActionsProps) {
  return (
    <div
      className="todo-priority-quick-panel"
      aria-label={`「${todo.title}」の優先度を変更`}
    >
      <div className="todo-priority-quick-heading">
        <strong>優先度をすばやく変更</strong>
        <button type="button" disabled={isBusy} onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className="todo-priority-quick-options">
        {TODO_PRIORITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              todo.priority === option.value
                ? `is-current ${option.value}`
                : option.value
            }
            disabled={isBusy || todo.priority === option.value}
            aria-label={`優先度 ${option.label}`}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

type TodoCategoryQuickActionsProps = {
  readonly todo: Todo
  readonly isBusy: boolean
  readonly categoryOptions: readonly string[]
  readonly onSelect: (category: string) => void
  readonly onClose: () => void
}

export function TodoCategoryQuickActions({
  todo,
  isBusy,
  categoryOptions,
  onSelect,
  onClose,
}: TodoCategoryQuickActionsProps) {
  const currentCategory = todo.category ?? ''
  const options = [
    { value: '', label: 'カテゴリなし' },
    ...categoryOptions.map((category) => ({
      value: category,
      label: category,
    })),
  ]

  return (
    <div
      className="todo-category-quick-panel"
      aria-label={`「${todo.title}」のカテゴリを変更`}
    >
      <div className="todo-category-quick-heading">
        <strong>カテゴリをすばやく変更</strong>
        <button type="button" disabled={isBusy} onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className="todo-category-quick-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={currentCategory === option.value ? 'is-current' : ''}
            disabled={isBusy || currentCategory === option.value}
            aria-label={`カテゴリ ${option.label}`}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

type TodoRepeatQuickActionsProps = {
  readonly todo: Todo
  readonly isBusy: boolean
  readonly today: string
  readonly onSelect: (dueDate: string) => void
  readonly onClose: () => void
}

export function TodoRepeatQuickActions({
  todo,
  isBusy,
  today,
  onSelect,
  onClose,
}: TodoRepeatQuickActionsProps) {
  const options = getTodoRepeatOptions(todo, today)

  return (
    <div
      className="todo-repeat-quick-panel"
      aria-label={`「${todo.title}」の次回ToDoを作成`}
    >
      <div className="todo-repeat-quick-heading">
        <div>
          <strong>次回ToDoを作成</strong>
          <p>期限がない、または過ぎている場合は、今日を基準にします。</p>
        </div>
        <button type="button" disabled={isBusy} onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className="todo-repeat-quick-options">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            disabled={isBusy}
            aria-label={`${option.label}（${formatDueDate(option.dueDate)}）の次回ToDoを作成`}
            onClick={() => onSelect(option.dueDate)}
          >
            <strong>{option.label}</strong>
            <span>{formatDueDate(option.dueDate)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function TodoManualCopy({ todo }: { readonly todo: Todo }) {
  return (
    <div className="todo-manual-copy" role="alert">
      <p>
        <strong>自動コピーが制限されています。</strong>
        下の文章を手動でコピーしてください。
      </p>
      <textarea
        className="todo-manual-copy-text"
        aria-label="手動コピー用のToDo内容"
        value={buildTodoClipboardText(todo)}
        rows={7}
        readOnly
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.currentTarget.select()}
      />
      <small>
        PC：枠内をクリックして Ctrl+C ／
        スマートフォン：文章を長押しして「すべて選択」→「コピー」
      </small>
    </div>
  )
}

export function TodoItem({
  todo,
  isBusy,
  isSelected,
  categoryOptions = [],
  today = getLocalDateString(),
  equipmentOptionsState = LOADING_EQUIPMENT_OPTIONS,
  onReloadEquipmentOptions = () => undefined,
  onSelectionChange,
  onEdit,
  onDuplicate,
  onRepeat,
  onToggle,
  onTogglePinned,
  onToggleArchived,
  onDelete,
}: TodoItemProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingDueDate, setIsChangingDueDate] = useState(false)
  const [isChangingPriority, setIsChangingPriority] = useState(false)
  const [isChangingCategory, setIsChangingCategory] = useState(false)
  const [isCreatingRepeat, setIsCreatingRepeat] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [copyResult, setCopyResult] = useState<'success' | 'manual' | null>(
    null,
  )
  const [editTitle, setEditTitle] = useState(todo.title)
  const [editDescription, setEditDescription] = useState(todo.description ?? '')
  const [editDueDate, setEditDueDate] = useState(todo.due_date ?? '')
  const [editPriority, setEditPriority] = useState<TodoPriority>(todo.priority)
  const [editCategory, setEditCategory] = useState(todo.category ?? '')
  const [editEquipmentDepartmentId, setEditEquipmentDepartmentId] = useState(
    getTodoEquipmentDepartmentId(equipmentOptionsState, todo.equipment_id),
  )
  const [editEquipmentId, setEditEquipmentId] = useState(
    todo.equipment_id ?? '',
  )
  const dueState = getTodoDueState(todo, today)
  const dueBadgeClassName = TODO_DUE_BADGE_CLASSES[dueState]
  const equipmentSummary = getTodoEquipmentSummary(
    equipmentOptionsState,
    todo.equipment_id,
  )

  function startEditing() {
    setEditTitle(todo.title)
    setEditDescription(todo.description ?? '')
    setEditDueDate(todo.due_date ?? '')
    setEditPriority(todo.priority)
    setEditCategory(todo.category ?? '')
    setEditEquipmentDepartmentId(
      getTodoEquipmentDepartmentId(equipmentOptionsState, todo.equipment_id),
    )
    setEditEquipmentId(todo.equipment_id ?? '')
    setIsConfirmingDelete(false)
    setIsChangingDueDate(false)
    setIsChangingPriority(false)
    setIsChangingCategory(false)
    setIsCreatingRepeat(false)
    setCopyResult(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setEditTitle(todo.title)
    setEditDescription(todo.description ?? '')
    setEditDueDate(todo.due_date ?? '')
    setEditPriority(todo.priority)
    setEditCategory(todo.category ?? '')
    setEditEquipmentDepartmentId(
      getTodoEquipmentDepartmentId(equipmentOptionsState, todo.equipment_id),
    )
    setEditEquipmentId(todo.equipment_id ?? '')
    setIsEditing(false)
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const didUpdate = await onEdit(todo.id, {
      title: editTitle,
      description: editDescription,
      dueDate: editDueDate,
      priority: editPriority,
      category: editCategory,
      equipmentId: editEquipmentId,
    })
    if (didUpdate) {
      setIsEditing(false)
    }
  }

  async function handleDelete() {
    const didDelete = await onDelete(todo.id)
    if (!didDelete) {
      setIsConfirmingDelete(false)
    }
  }

  async function handleCopy() {
    if (isBusy || isCopying) {
      return
    }

    setIsConfirmingDelete(false)
    setIsChangingDueDate(false)
    setIsChangingPriority(false)
    setIsChangingCategory(false)
    setIsCreatingRepeat(false)
    setCopyResult(null)
    setIsCopying(true)
    const didCopy = await copyTodoToClipboard(todo)
    setCopyResult(didCopy ? 'success' : 'manual')
    setIsCopying(false)
  }

  async function handleDueDateChange(nextDueDate: string) {
    const didUpdate = await onEdit(todo.id, {
      title: todo.title,
      description: todo.description ?? '',
      dueDate: nextDueDate,
      priority: todo.priority,
      category: todo.category ?? '',
      equipmentId: todo.equipment_id ?? '',
    })
    if (didUpdate) {
      setIsChangingDueDate(false)
    }
  }

  async function handlePriorityChange(nextPriority: TodoPriority) {
    const didUpdate = await onEdit(todo.id, {
      title: todo.title,
      description: todo.description ?? '',
      dueDate: todo.due_date ?? '',
      priority: nextPriority,
      category: todo.category ?? '',
      equipmentId: todo.equipment_id ?? '',
    })
    if (didUpdate) {
      setIsChangingPriority(false)
    }
  }

  async function handleCategoryChange(nextCategory: string) {
    const didUpdate = await onEdit(todo.id, {
      title: todo.title,
      description: todo.description ?? '',
      dueDate: todo.due_date ?? '',
      priority: todo.priority,
      category: nextCategory,
      equipmentId: todo.equipment_id ?? '',
    })
    if (didUpdate) {
      setIsChangingCategory(false)
    }
  }

  async function handleRepeat(nextDueDate: string) {
    const didCreate = await onRepeat(todo, nextDueDate)
    if (didCreate) {
      setIsCreatingRepeat(false)
    }
  }

  return (
    <li
      className={`todo-item${todo.is_pinned ? ' todo-pinned' : ''}${todo.is_completed ? ' todo-completed' : ''}${todo.is_archived ? ' todo-archived' : ''}${isSelected ? ' todo-selected' : ''}`}
      aria-busy={isBusy}
    >
      {isEditing ? (
        <form className="todo-edit-form" onSubmit={handleEditSubmit}>
          <fieldset disabled={isBusy}>
            <legend>ToDoを編集</legend>

            <label htmlFor={`todo-edit-title-${todo.id}`}>タイトル</label>
            <input
              id={`todo-edit-title-${todo.id}`}
              type="text"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              maxLength={200}
              required
            />

            <label htmlFor={`todo-edit-description-${todo.id}`}>
              説明（任意）
            </label>
            <textarea
              id={`todo-edit-description-${todo.id}`}
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              maxLength={5000}
              rows={3}
            />

            <label htmlFor={`todo-edit-due-date-${todo.id}`}>
              期限（任意）
            </label>
            <input
              id={`todo-edit-due-date-${todo.id}`}
              type="date"
              value={editDueDate}
              onChange={(event) => setEditDueDate(event.target.value)}
            />

            <label htmlFor={`todo-edit-priority-${todo.id}`}>優先度</label>
            <select
              id={`todo-edit-priority-${todo.id}`}
              value={editPriority}
              onChange={(event) =>
                setEditPriority(event.target.value as TodoPriority)
              }
            >
              {TODO_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label htmlFor={`todo-edit-category-${todo.id}`}>
              カテゴリ（任意）
            </label>
            <input
              id={`todo-edit-category-${todo.id}`}
              type="text"
              value={editCategory}
              onChange={(event) => setEditCategory(event.target.value)}
              maxLength={30}
              placeholder="例：学習、仕事、資産づくり"
            />

            <TodoEquipmentFields
              idPrefix={`todo-edit-${todo.id}`}
              departmentId={editEquipmentDepartmentId}
              equipmentId={editEquipmentId}
              state={equipmentOptionsState}
              onDepartmentChange={(departmentId) => {
                setEditEquipmentDepartmentId(departmentId)
                setEditEquipmentId('')
              }}
              onEquipmentChange={setEditEquipmentId}
              onReload={onReloadEquipmentOptions}
            />

            <div className="todo-edit-actions">
              <button
                type="submit"
                className="todo-save-button"
                disabled={!editTitle.trim() || isBusy}
              >
                {isBusy ? '保存中...' : '変更を保存'}
              </button>
              <button
                type="button"
                className="todo-cancel-button"
                disabled={isBusy}
                onClick={cancelEditing}
              >
                キャンセル
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          {!todo.is_archived && (
            <label className="todo-selection-control">
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isBusy}
                onChange={(event) =>
                  onSelectionChange(todo.id, event.target.checked)
                }
              />
              <span>一括操作に選択</span>
            </label>
          )}
          <div className="todo-item-heading">
            <h3>{todo.title}</h3>
            <div className="todo-item-badges">
              {todo.is_pinned && (
                <span className="todo-pinned-badge">固定中</span>
              )}
              {todo.is_archived && (
                <span className="todo-archived-badge">アーカイブ中</span>
              )}
              {todo.category && (
                <span className="todo-category-badge">
                  カテゴリ {todo.category}
                </span>
              )}
              <span className={`todo-priority-badge ${todo.priority}`}>
                優先度 {TODO_PRIORITY_LABELS[todo.priority]}
              </span>
              <span
                className={`todo-status${todo.is_completed ? ' completed' : ''}`}
              >
                {todo.is_completed ? '完了' : '未完了'}
              </span>
            </div>
          </div>
          {todo.description && (
            <TodoDescription description={todo.description} />
          )}
          {equipmentSummary && (
            <p
              className={`todo-equipment-summary is-${equipmentSummary.status}`}
            >
              対象設備：{equipmentSummary.label}
            </p>
          )}
          <div className="todo-due-row">
            <small>
              {todo.due_date
                ? `期限 ${formatDueDate(todo.due_date)}`
                : '期限なし'}
            </small>
            <small className="todo-updated-at">
              更新 {formatTodoUpdatedAt(todo.updated_at)}
            </small>
            {dueBadgeClassName && todo.due_date && (
              <span className={`todo-due-badge ${dueBadgeClassName}`}>
                {getTodoDueDateRelativeLabel(todo.due_date, today)}
              </span>
            )}
          </div>

          <div className="todo-actions">
            {todo.is_archived ? (
              <span className="todo-archived-state">完了済みで保管中</span>
            ) : (
              <label className="todo-completion-control">
                <input
                  type="checkbox"
                  checked={todo.is_completed}
                  disabled={isBusy}
                  onChange={() => void onToggle(todo)}
                />
                <span>{todo.is_completed ? '未完了に戻す' : '完了にする'}</span>
              </label>
            )}
            <div className="todo-item-buttons">
              {(todo.is_completed || todo.is_archived) && (
                <button
                  type="button"
                  className="todo-archive-button"
                  disabled={isBusy}
                  onClick={() => {
                    setIsConfirmingDelete(false)
                    setIsChangingDueDate(false)
                    setIsChangingPriority(false)
                    setIsChangingCategory(false)
                    setIsCreatingRepeat(false)
                    setCopyResult(null)
                    void onToggleArchived(todo)
                  }}
                >
                  {todo.is_archived ? '一覧へ復元' : 'アーカイブ'}
                </button>
              )}
              <button
                type="button"
                className="todo-pin-button"
                disabled={isBusy}
                aria-pressed={todo.is_pinned}
                onClick={() => {
                  setIsConfirmingDelete(false)
                  setIsChangingDueDate(false)
                  setIsChangingPriority(false)
                  setIsChangingCategory(false)
                  setIsCreatingRepeat(false)
                  setCopyResult(null)
                  void onTogglePinned(todo)
                }}
              >
                {todo.is_pinned ? '固定を解除' : '上部へ固定'}
              </button>
              <button
                type="button"
                className="todo-due-change-button"
                disabled={isBusy}
                aria-expanded={isChangingDueDate}
                onClick={() => {
                  setIsConfirmingDelete(false)
                  setIsChangingPriority(false)
                  setIsChangingCategory(false)
                  setIsCreatingRepeat(false)
                  setIsChangingDueDate((isOpen) => !isOpen)
                }}
              >
                期限変更
              </button>
              <button
                type="button"
                className="todo-priority-change-button"
                disabled={isBusy}
                aria-expanded={isChangingPriority}
                onClick={() => {
                  setIsConfirmingDelete(false)
                  setIsChangingDueDate(false)
                  setIsChangingCategory(false)
                  setIsCreatingRepeat(false)
                  setIsChangingPriority((isOpen) => !isOpen)
                }}
              >
                優先度変更
              </button>
              <button
                type="button"
                className="todo-category-change-button"
                disabled={isBusy}
                aria-expanded={isChangingCategory}
                onClick={() => {
                  setIsConfirmingDelete(false)
                  setIsChangingDueDate(false)
                  setIsChangingPriority(false)
                  setIsCreatingRepeat(false)
                  setIsChangingCategory((isOpen) => !isOpen)
                }}
              >
                カテゴリ変更
              </button>
              <button
                type="button"
                className="todo-repeat-button"
                disabled={isBusy}
                aria-expanded={isCreatingRepeat}
                onClick={() => {
                  setIsConfirmingDelete(false)
                  setIsChangingDueDate(false)
                  setIsChangingPriority(false)
                  setIsChangingCategory(false)
                  setCopyResult(null)
                  setIsCreatingRepeat((isOpen) => !isOpen)
                }}
              >
                次回作成
              </button>
              <button
                type="button"
                className="todo-copy-button"
                disabled={isBusy || isCopying}
                onClick={() => void handleCopy()}
              >
                {isCopying ? 'コピー中...' : '内容をコピー'}
              </button>
              <button
                type="button"
                className="todo-duplicate-button"
                disabled={isBusy}
                onClick={() => {
                  setIsCreatingRepeat(false)
                  void onDuplicate(todo)
                }}
              >
                複製
              </button>
              <button
                type="button"
                className="todo-edit-button"
                disabled={isBusy}
                onClick={startEditing}
              >
                編集
              </button>
              <button
                type="button"
                className="todo-delete-button"
                disabled={isBusy}
                onClick={() => {
                  setIsChangingDueDate(false)
                  setIsChangingPriority(false)
                  setIsChangingCategory(false)
                  setIsCreatingRepeat(false)
                  setIsConfirmingDelete(true)
                }}
              >
                削除
              </button>
            </div>
          </div>
        </>
      )}

      {isChangingDueDate && !isEditing && !isConfirmingDelete && (
        <TodoDueDateQuickActions
          todo={todo}
          isBusy={isBusy}
          today={today}
          onSelect={(nextDueDate) => void handleDueDateChange(nextDueDate)}
          onClose={() => setIsChangingDueDate(false)}
        />
      )}

      {isChangingPriority && !isEditing && !isConfirmingDelete && (
        <TodoPriorityQuickActions
          todo={todo}
          isBusy={isBusy}
          onSelect={(nextPriority) => void handlePriorityChange(nextPriority)}
          onClose={() => setIsChangingPriority(false)}
        />
      )}

      {isChangingCategory && !isEditing && !isConfirmingDelete && (
        <TodoCategoryQuickActions
          todo={todo}
          isBusy={isBusy}
          categoryOptions={categoryOptions}
          onSelect={(nextCategory) => void handleCategoryChange(nextCategory)}
          onClose={() => setIsChangingCategory(false)}
        />
      )}

      {isCreatingRepeat && !isEditing && !isConfirmingDelete && (
        <TodoRepeatQuickActions
          todo={todo}
          isBusy={isBusy}
          today={today}
          onSelect={(nextDueDate) => void handleRepeat(nextDueDate)}
          onClose={() => setIsCreatingRepeat(false)}
        />
      )}

      {isBusy && (
        <p className="todo-operation-status" role="status">
          変更を保存しています...
        </p>
      )}

      {copyResult === 'success' && !isEditing && (
        <p className="todo-copy-result success" role="status">
          ToDo内容をコピーしました。
        </p>
      )}

      {copyResult === 'manual' && !isEditing && <TodoManualCopy todo={todo} />}

      {isConfirmingDelete && !isEditing && !isBusy && (
        <div className="todo-delete-confirmation" role="alert">
          <p>「{todo.title}」を削除しますか？ この操作は元に戻せません。</p>
          <div>
            <button
              type="button"
              className="todo-delete-confirm-button"
              onClick={() => void handleDelete()}
            >
              削除を実行
            </button>
            <button
              type="button"
              className="todo-cancel-button"
              onClick={() => setIsConfirmingDelete(false)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

type TodoBulkActionsProps = {
  readonly selectedCount: number
  readonly visibleCount: number
  readonly isAllVisibleSelected: boolean
  readonly today: string
  readonly canComplete: boolean
  readonly canReopen: boolean
  readonly canPin: boolean
  readonly canUnpin: boolean
  readonly canSetDueDate: (dueDate: string) => boolean
  readonly canSetPriority: (priority: TodoPriority) => boolean
  readonly canSetCategory: (category: string) => boolean
  readonly categoryOptions: readonly string[]
  readonly isBusy: boolean
  readonly isConfirmingDelete: boolean
  readonly onToggleAllVisible: () => void
  readonly onComplete: () => void
  readonly onReopen: () => void
  readonly onPin: () => void
  readonly onUnpin: () => void
  readonly onDuplicate: () => void
  readonly onDeleteRequest: () => void
  readonly onDeleteConfirm: () => void
  readonly onDeleteCancel: () => void
  readonly onDueDateChange: (dueDate: string) => void
  readonly onPriorityChange: (priority: TodoPriority) => void
  readonly onCategoryChange: (category: string) => void
  readonly onClear: () => void
}

type TodoBulkCustomDueDateProps = {
  readonly value: string
  readonly isDisabled: boolean
  readonly canApply: boolean
  readonly onChange: (dueDate: string) => void
  readonly onApply: () => void
}

export function TodoBulkCustomDueDate({
  value,
  isDisabled,
  canApply,
  onChange,
  onApply,
}: TodoBulkCustomDueDateProps) {
  return (
    <div className="todo-bulk-custom-due-date">
      <label htmlFor="todo-bulk-custom-due-date">任意の日付</label>
      <div>
        <input
          id="todo-bulk-custom-due-date"
          type="date"
          value={value}
          disabled={isDisabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="todo-bulk-custom-due-button"
          disabled={isDisabled || !value || !canApply}
          aria-label={
            value
              ? `選択したToDoの期限を${formatDueDate(value)}へ変更`
              : '選択したToDoへ任意の期限を設定'
          }
          onClick={onApply}
        >
          日付を適用
        </button>
      </div>
    </div>
  )
}

export function TodoBulkActions({
  selectedCount,
  visibleCount,
  isAllVisibleSelected,
  today,
  canComplete,
  canReopen,
  canPin,
  canUnpin,
  canSetDueDate,
  canSetPriority,
  canSetCategory,
  categoryOptions,
  isBusy,
  isConfirmingDelete,
  onToggleAllVisible,
  onComplete,
  onReopen,
  onPin,
  onUnpin,
  onDuplicate,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onDueDateChange,
  onPriorityChange,
  onCategoryChange,
  onClear,
}: TodoBulkActionsProps) {
  const [customDueDate, setCustomDueDate] = useState('')
  const areStandardActionsDisabled = isBusy || isConfirmingDelete
  const bulkDueDateOptions = getTodoDueDateQuickOptions(today)
  const bulkCategoryOptions = [
    { value: '', label: 'カテゴリなし' },
    ...categoryOptions.map((category) => ({
      value: category,
      label: category,
    })),
  ]

  function applyCustomDueDate() {
    if (
      selectedCount === 0 ||
      !customDueDate ||
      !canSetDueDate(customDueDate) ||
      areStandardActionsDisabled
    ) {
      return
    }

    onDueDateChange(customDueDate)
    setCustomDueDate('')
  }

  return (
    <div className="todo-bulk-actions" aria-label="ToDoの一括操作">
      <div className="todo-bulk-summary">
        <strong>{selectedCount}件を選択中</strong>
        <button
          type="button"
          className="todo-select-all-button"
          disabled={visibleCount === 0 || areStandardActionsDisabled}
          onClick={onToggleAllVisible}
        >
          {isAllVisibleSelected ? '表示中の選択を解除' : '表示中をすべて選択'}
        </button>
      </div>
      <div className="todo-bulk-buttons">
        <button
          type="button"
          className="todo-bulk-complete-button"
          disabled={!canComplete || areStandardActionsDisabled}
          onClick={onComplete}
        >
          選択を完了
        </button>
        <button
          type="button"
          className="todo-bulk-reopen-button"
          disabled={!canReopen || areStandardActionsDisabled}
          onClick={onReopen}
        >
          未完了に戻す
        </button>
        <button
          type="button"
          className="todo-bulk-pin-button"
          disabled={!canPin || areStandardActionsDisabled}
          onClick={onPin}
        >
          選択を固定
        </button>
        <button
          type="button"
          className="todo-bulk-unpin-button"
          disabled={!canUnpin || areStandardActionsDisabled}
          onClick={onUnpin}
        >
          固定を解除
        </button>
        <button
          type="button"
          className="todo-bulk-duplicate-button"
          disabled={selectedCount === 0 || areStandardActionsDisabled}
          onClick={onDuplicate}
        >
          選択を複製
        </button>
        <button
          type="button"
          className="todo-bulk-delete-button"
          disabled={selectedCount === 0 || areStandardActionsDisabled}
          onClick={onDeleteRequest}
        >
          選択を削除
        </button>
        <button
          type="button"
          className="todo-bulk-clear-button"
          disabled={selectedCount === 0 || areStandardActionsDisabled}
          onClick={onClear}
        >
          選択解除
        </button>
      </div>
      <div className="todo-bulk-due-actions">
        <span>選択したToDoの期限</span>
        <div className="todo-bulk-due-controls">
          <div className="todo-bulk-due-buttons">
            {bulkDueDateOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                disabled={
                  !canSetDueDate(option.value) || areStandardActionsDisabled
                }
                aria-label={
                  option.value
                    ? `選択したToDoの期限を${option.label}（${formatDueDate(option.value)}）へ変更`
                    : '選択したToDoを期限なしへ変更'
                }
                onClick={() => onDueDateChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <TodoBulkCustomDueDate
            value={customDueDate}
            isDisabled={selectedCount === 0 || areStandardActionsDisabled}
            canApply={canSetDueDate(customDueDate)}
            onChange={setCustomDueDate}
            onApply={applyCustomDueDate}
          />
        </div>
      </div>
      <div className="todo-bulk-priority-actions">
        <span>選択したToDoの優先度</span>
        <div className="todo-bulk-priority-buttons">
          {TODO_PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value}
              disabled={
                !canSetPriority(option.value) || areStandardActionsDisabled
              }
              aria-label={`選択したToDoを優先度 ${option.label}へ変更`}
              onClick={() => onPriorityChange(option.value)}
            >
              {option.label}に変更
            </button>
          ))}
        </div>
      </div>
      <div className="todo-bulk-category-actions">
        <span>選択したToDoのカテゴリ</span>
        <div className="todo-bulk-category-buttons">
          {bulkCategoryOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={
                !canSetCategory(option.value) || areStandardActionsDisabled
              }
              aria-label={`選択したToDoをカテゴリ ${option.label}へ変更`}
              onClick={() => onCategoryChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {isConfirmingDelete && (
        <div className="todo-bulk-delete-confirmation" role="alert">
          <p>
            選択した{selectedCount}件を削除しますか？ この操作は元に戻せません。
          </p>
          <div>
            <button
              type="button"
              className="todo-bulk-delete-confirm-button"
              disabled={isBusy}
              onClick={onDeleteConfirm}
            >
              削除を実行
            </button>
            <button
              type="button"
              className="todo-bulk-delete-cancel-button"
              disabled={isBusy}
              onClick={onDeleteCancel}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
      {isBusy && (
        <p className="todo-bulk-status" role="status">
          選択したToDoを処理しています...
        </p>
      )}
    </div>
  )
}

type TodoLoadMoreProps = {
  readonly loadedCount: number
  readonly totalCount: number
  readonly loadingAction: 'more' | 'all' | null
  readonly error: string | null
  readonly onLoadMore: () => void
  readonly onLoadAll: () => void
}

export function TodoLoadMore({
  loadedCount,
  totalCount,
  loadingAction,
  error,
  onLoadMore,
  onLoadAll,
}: TodoLoadMoreProps) {
  const remainingCount = Math.max(0, totalCount - loadedCount)
  const isLoading = loadingAction !== null
  if (remainingCount === 0) {
    return null
  }

  return (
    <div className="todo-load-more" aria-label="ToDoの追加読み込み">
      <div>
        <strong>
          {loadedCount}件を読み込み済み / 残り{remainingCount}件
        </strong>
        <p>検索・集計・一括操作は、現在読み込み済みのToDoが対象です。</p>
      </div>
      <div className="todo-load-more-buttons">
        <button
          type="button"
          className="todo-load-more-button"
          disabled={isLoading}
          onClick={onLoadMore}
        >
          {loadingAction === 'more' ? '読み込み中...' : 'さらに読み込む'}
        </button>
        <button
          type="button"
          className="todo-load-all-button"
          disabled={isLoading}
          onClick={onLoadAll}
        >
          {loadingAction === 'all' ? '全件を読み込み中...' : 'すべて読み込む'}
        </button>
      </div>
      {error && (
        <p className="todo-load-more-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type TodoExportActionsProps = {
  readonly visibleCount: number
  readonly selectedCount: number
  readonly loadedCount: number
  readonly totalCount: number
  readonly onExportVisible: () => void
  readonly onExportSelected: () => void
}

export function TodoExportActions({
  visibleCount,
  selectedCount,
  loadedCount,
  totalCount,
  onExportVisible,
  onExportSelected,
}: TodoExportActionsProps) {
  const unloadedCount = Math.max(0, totalCount - loadedCount)

  return (
    <div className="todo-export-actions" aria-label="ToDoのCSV書き出し">
      <div>
        <strong>表示中または選択中のToDoをCSVへ</strong>
        <p>
          検索・絞り込み後の表示結果、または一括操作で選択したToDoだけを保存します。
          {unloadedCount > 0 &&
            ` 残り${unloadedCount}件は追加読み込み後に含められます。`}
        </p>
      </div>
      <div className="todo-export-buttons">
        <button
          type="button"
          disabled={visibleCount === 0}
          onClick={onExportVisible}
        >
          表示中の{visibleCount}件をCSVへ
        </button>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onExportSelected}
        >
          選択中の{selectedCount}件をCSVへ
        </button>
      </div>
    </div>
  )
}

type TodoCsvImportPreview = {
  readonly fileName: string
  readonly items: readonly TodoCreateInput[]
}

const TODO_CSV_PREVIEW_ITEM_LIMIT = 3

type TodoCsvImportActionsProps = {
  readonly preview: TodoCsvImportPreview | null
  readonly duplicateTitleIndexes: ReadonlySet<number>
  readonly csvRepeatedTitleIndexes: ReadonlySet<number>
  readonly previewSearchQuery: string
  readonly excludeDuplicateTitles: boolean
  readonly showAllPreviewItems: boolean
  readonly showOnlyDuplicatePreviewItems: boolean
  readonly showOnlyIncludedPreviewItems: boolean
  readonly excludedPreviewItemIndexes: ReadonlySet<number>
  readonly loadedCount: number
  readonly totalCount: number
  readonly isImporting: boolean
  readonly error: string | null
  readonly onFileSelect: (file: File | null) => void
  readonly onExcludeDuplicateTitlesChange: (exclude: boolean) => void
  readonly onPreviewSearchQueryChange: (query: string) => void
  readonly onShowAllPreviewItemsChange: (showAll: boolean) => void
  readonly onShowOnlyDuplicatePreviewItemsChange: (showOnly: boolean) => void
  readonly onShowOnlyIncludedPreviewItemsChange: (showOnly: boolean) => void
  readonly onExcludeAllPreviewItems: () => void
  readonly onIncludePreviewItems: (indexes: readonly number[]) => void
  readonly onPreviewItemExclusionChange: (
    index: number,
    isExcluded: boolean,
  ) => void
  readonly onClearPreviewItemExclusions: () => void
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function TodoCsvImportActions({
  preview,
  duplicateTitleIndexes,
  csvRepeatedTitleIndexes,
  previewSearchQuery,
  excludeDuplicateTitles,
  showAllPreviewItems,
  showOnlyDuplicatePreviewItems,
  showOnlyIncludedPreviewItems,
  excludedPreviewItemIndexes,
  loadedCount,
  totalCount,
  isImporting,
  error,
  onFileSelect,
  onExcludeDuplicateTitlesChange,
  onPreviewSearchQueryChange,
  onShowAllPreviewItemsChange,
  onShowOnlyDuplicatePreviewItemsChange,
  onShowOnlyIncludedPreviewItemsChange,
  onExcludeAllPreviewItems,
  onIncludePreviewItems,
  onPreviewItemExclusionChange,
  onClearPreviewItemExclusions,
  onConfirm,
  onCancel,
}: TodoCsvImportActionsProps) {
  const [expandedPreviewItemIndexes, setExpandedPreviewItemIndexes] = useState<
    ReadonlySet<number>
  >(new Set())

  const unloadedCount = Math.max(0, totalCount - loadedCount)
  const existingDuplicateTitleCount = duplicateTitleIndexes.size
  const csvRepeatedTitleCount = csvRepeatedTitleIndexes.size
  const allDuplicateTitleIndexes = new Set([
    ...duplicateTitleIndexes,
    ...csvRepeatedTitleIndexes,
  ])
  const duplicateTitleCount = allDuplicateTitleIndexes.size
  const normalizedPreviewSearchQuery = previewSearchQuery
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ja-JP')
  const isSearchingPreviewItems = normalizedPreviewSearchQuery !== ''
  const excludedItemIndexes = getTodoInputExcludedIndexes(
    preview?.items.length ?? 0,
    excludedPreviewItemIndexes,
    allDuplicateTitleIndexes,
    excludeDuplicateTitles,
  )
  const individuallyExcludedItemCount = preview
    ? preview.items.reduce(
        (count, _, index) =>
          count +
          (excludedPreviewItemIndexes.has(index) &&
          !(excludeDuplicateTitles && allDuplicateTitleIndexes.has(index))
            ? 1
            : 0),
        0,
      )
    : 0
  const itemsToRegisterCount = preview
    ? preview.items.length - excludedItemIndexes.size
    : 0
  const isShowingOnlyDuplicatePreviewItems =
    showOnlyDuplicatePreviewItems && duplicateTitleCount > 0
  const isShowingOnlyIncludedPreviewItems =
    showOnlyIncludedPreviewItems &&
    excludedItemIndexes.size > 0 &&
    itemsToRegisterCount > 0
  const indexedPreviewItems = preview
    ? preview.items.map((item, index) => ({ item, index }))
    : []
  const filteredPreviewItems = isShowingOnlyDuplicatePreviewItems
    ? indexedPreviewItems.filter(({ index }) =>
        allDuplicateTitleIndexes.has(index),
      )
    : isShowingOnlyIncludedPreviewItems
      ? indexedPreviewItems.filter(
          ({ index }) => !excludedItemIndexes.has(index),
        )
      : showAllPreviewItems
        ? indexedPreviewItems
        : indexedPreviewItems.slice(0, TODO_CSV_PREVIEW_ITEM_LIMIT)
  const previewItems = isSearchingPreviewItems
    ? (isShowingOnlyDuplicatePreviewItems || isShowingOnlyIncludedPreviewItems
        ? filteredPreviewItems
        : indexedPreviewItems
      ).filter(({ item }) =>
        `${item.title}\n${item.description}\n${item.category}`
          .normalize('NFKC')
          .toLocaleLowerCase('ja-JP')
          .includes(normalizedPreviewSearchQuery),
      )
    : filteredPreviewItems
  const excludedSearchResultCount = isSearchingPreviewItems
    ? previewItems.filter(({ index }) => excludedItemIndexes.has(index)).length
    : 0
  const includedSearchResultIndexes = isSearchingPreviewItems
    ? previewItems.flatMap(({ index }) =>
        excludedItemIndexes.has(index) ? [] : [index],
      )
    : []
  const restorableSearchResultIndexes = isSearchingPreviewItems
    ? previewItems.flatMap(({ index }) =>
        excludedPreviewItemIndexes.has(index) &&
        !(excludeDuplicateTitles && allDuplicateTitleIndexes.has(index))
          ? [index]
          : [],
      )
    : []
  const hiddenPreviewItemCount = preview
    ? Math.max(0, preview.items.length - TODO_CSV_PREVIEW_ITEM_LIMIT)
    : 0
  const areAllVisiblePreviewDetailsExpanded =
    previewItems.length > 0 &&
    previewItems.every(({ index }) => expandedPreviewItemIndexes.has(index))

  function changeVisiblePreviewDetails(isExpanded: boolean) {
    setExpandedPreviewItemIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes)
      previewItems.forEach(({ index }) => {
        if (isExpanded) {
          nextIndexes.add(index)
        } else {
          nextIndexes.delete(index)
        }
      })
      return nextIndexes
    })
  }

  function changePreviewItemDetails(index: number, isExpanded: boolean) {
    setExpandedPreviewItemIndexes((currentIndexes) => {
      if (currentIndexes.has(index) === isExpanded) {
        return currentIndexes
      }

      const nextIndexes = new Set(currentIndexes)
      if (isExpanded) {
        nextIndexes.add(index)
      } else {
        nextIndexes.delete(index)
      }
      return nextIndexes
    })
  }

  return (
    <div className="todo-import-actions" aria-label="CSVからToDoを一括登録">
      <div className="todo-import-heading">
        <div>
          <strong>CSVから新しいToDoを登録</strong>
          <p>Phoenixで書き出したCSVを、最大50件まで確認して登録します。</p>
        </div>
        <input
          className="todo-import-file-input"
          type="file"
          accept=".csv,text/csv"
          aria-label="登録するToDoのCSVファイル"
          disabled={isImporting}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null
            event.currentTarget.value = ''
            setExpandedPreviewItemIndexes(new Set())
            onFileSelect(file)
          }}
        />
      </div>

      {preview && (
        <div className="todo-import-confirmation">
          <div>
            <strong>{itemsToRegisterCount}件を登録しますか？</strong>
            <p>{preview.fileName}</p>
          </div>
          <div className="todo-import-preview-search">
            <label>
              <span>CSV候補をタイトル・説明・カテゴリで検索</span>
              <input
                type="search"
                value={previewSearchQuery}
                maxLength={200}
                placeholder="例：連絡"
                aria-label="CSV候補をタイトル・説明・カテゴリで検索"
                disabled={isImporting}
                onChange={(event) =>
                  onPreviewSearchQueryChange(event.currentTarget.value)
                }
              />
            </label>
            {isSearchingPreviewItems && (
              <>
                <p role="status">
                  「{previewSearchQuery.trim()}」で{previewItems.length}
                  件を表示中です。登録対象は変わりません。
                </p>
                <button
                  type="button"
                  className="todo-import-preview-search-clear-button"
                  disabled={isImporting}
                  onClick={() => onPreviewSearchQueryChange('')}
                >
                  検索をクリア
                </button>
              </>
            )}
            {isSearchingPreviewItems && previewItems.length > 0 && (
              <div className="todo-import-preview-search-selection">
                {includedSearchResultIndexes.length > 0 && (
                  <button
                    type="button"
                    className="todo-import-preview-search-exclude-button"
                    disabled={isImporting}
                    onClick={() =>
                      includedSearchResultIndexes.forEach((index) =>
                        onPreviewItemExclusionChange(index, true),
                      )
                    }
                  >
                    検索結果の{includedSearchResultIndexes.length}
                    件を登録対象から外す
                  </button>
                )}
                {restorableSearchResultIndexes.length > 0 ? (
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() =>
                      onIncludePreviewItems(restorableSearchResultIndexes)
                    }
                  >
                    検索結果の{restorableSearchResultIndexes.length}
                    件を登録対象に戻す
                  </button>
                ) : excludedSearchResultCount > 0 ? (
                  <button type="button" disabled>
                    重複候補の除外を解除してください
                  </button>
                ) : (
                  <p role="status">
                    検索結果の{previewItems.length}
                    件はすべて登録対象です。
                  </p>
                )}
              </div>
            )}
          </div>
          {previewItems.length > 0 && (
            <div className="todo-import-preview-detail-controls">
              <div>
                <strong>候補の内容をまとめて確認</strong>
                <p>現在表示中の候補だけを一括で開閉します。</p>
              </div>
              <button
                type="button"
                aria-expanded={areAllVisiblePreviewDetailsExpanded}
                onClick={() =>
                  changeVisiblePreviewDetails(
                    !areAllVisiblePreviewDetailsExpanded,
                  )
                }
              >
                {areAllVisiblePreviewDetailsExpanded
                  ? `表示中の${previewItems.length}件をすべて折りたたむ`
                  : `表示中の${previewItems.length}件の内容をすべて開く`}
              </button>
            </div>
          )}
          <ul>
            {previewItems.map(({ item, index }) => {
              const matchesExistingTitle = duplicateTitleIndexes.has(index)
              const repeatsCsvTitle = csvRepeatedTitleIndexes.has(index)
              const isDuplicate = matchesExistingTitle || repeatsCsvTitle
              const isExcluded = excludedItemIndexes.has(index)
              const className = [
                isDuplicate ? 'has-duplicate-title' : '',
                isExcluded ? 'is-excluded' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <li
                  key={`${item.title}-${index}`}
                  className={className || undefined}
                >
                  <span>{item.title}</span>
                  <div className="todo-import-preview-meta">
                    {matchesExistingTitle && (
                      <span className="todo-import-duplicate-badge">
                        重複候補
                      </span>
                    )}
                    {repeatsCsvTitle && (
                      <span className="todo-import-csv-duplicate-badge">
                        CSV内重複
                      </span>
                    )}
                    <small>
                      {item.isCompleted ? '完了' : '未完了'} ／
                      {item.isPinned ? '固定' : '通常'}
                    </small>
                    <label className="todo-import-item-selection">
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        disabled={
                          isImporting || (excludeDuplicateTitles && isDuplicate)
                        }
                        aria-label={`「${item.title}」を登録する`}
                        onChange={(event) =>
                          onPreviewItemExclusionChange(
                            index,
                            !event.currentTarget.checked,
                          )
                        }
                      />
                      <span>{isExcluded ? '登録しない' : '登録する'}</span>
                    </label>
                  </div>
                  <details
                    className="todo-import-preview-details"
                    open={expandedPreviewItemIndexes.has(index)}
                    onToggle={(event) =>
                      changePreviewItemDetails(index, event.currentTarget.open)
                    }
                  >
                    <summary>内容を確認</summary>
                    <dl>
                      <div className="todo-import-preview-description">
                        <dt>説明</dt>
                        <dd>{item.description || '説明なし'}</dd>
                      </div>
                      <div>
                        <dt>期限</dt>
                        <dd>
                          {item.dueDate
                            ? formatDueDate(item.dueDate)
                            : '期限なし'}
                        </dd>
                      </div>
                      <div>
                        <dt>優先度</dt>
                        <dd>{TODO_PRIORITY_LABELS[item.priority]}</dd>
                      </div>
                      <div>
                        <dt>カテゴリ</dt>
                        <dd>{item.category || 'カテゴリなし'}</dd>
                      </div>
                    </dl>
                  </details>
                </li>
              )
            })}
          </ul>
          {isSearchingPreviewItems && previewItems.length === 0 && (
            <p className="todo-import-preview-search-empty" role="status">
              一致するCSV候補はありません。
            </p>
          )}
          {hiddenPreviewItemCount > 0 &&
            !isSearchingPreviewItems &&
            !isShowingOnlyDuplicatePreviewItems &&
            !isShowingOnlyIncludedPreviewItems && (
              <div className="todo-import-preview-controls">
                <span role="status">
                  {showAllPreviewItems
                    ? `${preview.items.length}件すべて表示中`
                    : `先頭${TODO_CSV_PREVIEW_ITEM_LIMIT}件を表示中`}
                </span>
                <button
                  type="button"
                  aria-expanded={showAllPreviewItems}
                  disabled={isImporting}
                  onClick={() =>
                    onShowAllPreviewItemsChange(!showAllPreviewItems)
                  }
                >
                  {showAllPreviewItems
                    ? `先頭${TODO_CSV_PREVIEW_ITEM_LIMIT}件だけ表示`
                    : `残り${hiddenPreviewItemCount}件を表示`}
                </button>
              </div>
            )}
          <div className="todo-import-bulk-exclusion-controls">
            <div>
              <strong>登録対象をまとめて変更</strong>
              <p>全候補を外してから、必要な候補だけ選び直せます。</p>
            </div>
            <button
              type="button"
              disabled={isImporting || itemsToRegisterCount === 0}
              onClick={onExcludeAllPreviewItems}
            >
              {itemsToRegisterCount > 0
                ? '全候補を登録対象から外す'
                : '全候補を登録対象から外しました'}
            </button>
          </div>
          {itemsToRegisterCount === 0 && (
            <p className="todo-import-all-excluded-summary" role="status">
              全{preview.items.length}
              件を登録対象から外しました。必要な候補はチェックを戻せます。
            </p>
          )}
          {excludedItemIndexes.size > 0 && itemsToRegisterCount > 0 && (
            <div className="todo-import-registration-filter">
              <button
                type="button"
                aria-pressed={isShowingOnlyIncludedPreviewItems}
                disabled={isImporting}
                onClick={() =>
                  onShowOnlyIncludedPreviewItemsChange(
                    !isShowingOnlyIncludedPreviewItems,
                  )
                }
              >
                {isShowingOnlyIncludedPreviewItems
                  ? 'CSVの全候補を表示'
                  : `登録対象${itemsToRegisterCount}件だけ表示`}
              </button>
              {isShowingOnlyIncludedPreviewItems && (
                <p role="status">
                  登録対象{itemsToRegisterCount}件だけを表示中です。
                </p>
              )}
            </div>
          )}
          {individuallyExcludedItemCount > 0 && (
            <div className="todo-import-item-exclusion-controls">
              <p className="todo-import-item-exclusion-summary" role="status">
                個別に{individuallyExcludedItemCount}件を登録対象から外し、
                {itemsToRegisterCount}件を登録します。
              </p>
              <button
                type="button"
                disabled={isImporting}
                onClick={onClearPreviewItemExclusions}
              >
                個別除外をすべて戻す
              </button>
            </div>
          )}
          {duplicateTitleCount > 0 && (
            <div className="todo-import-duplicate-warning" role="status">
              <strong>同じタイトルを確認</strong>
              <p>
                {existingDuplicateTitleCount > 0 && (
                  <>
                    読み込み済みToDoと同じタイトルが
                    {existingDuplicateTitleCount}
                    件あります。内容を確認してから登録してください。
                    {unloadedCount > 0 &&
                      ` 未読み込みの${unloadedCount}件は判定対象外です。`}
                  </>
                )}
                {csvRepeatedTitleCount > 0 && (
                  <>
                    {existingDuplicateTitleCount > 0 && ' '}
                    CSV内で同じタイトルが{csvRepeatedTitleCount}
                    件重複しています。先にある候補を残して確認してください。
                  </>
                )}
              </p>
              <button
                type="button"
                className="todo-import-duplicate-filter-button"
                aria-pressed={isShowingOnlyDuplicatePreviewItems}
                disabled={isImporting}
                onClick={() =>
                  onShowOnlyDuplicatePreviewItemsChange(
                    !isShowingOnlyDuplicatePreviewItems,
                  )
                }
              >
                {isShowingOnlyDuplicatePreviewItems
                  ? 'CSVの全候補を表示'
                  : `重複候補${duplicateTitleCount}件だけ表示`}
              </button>
              {isShowingOnlyDuplicatePreviewItems && (
                <p className="todo-import-duplicate-filter-summary">
                  重複候補{duplicateTitleCount}
                  件だけを表示中です。登録対象は変わりません。
                </p>
              )}
              <label className="todo-import-duplicate-option">
                <input
                  type="checkbox"
                  checked={excludeDuplicateTitles}
                  disabled={isImporting}
                  onChange={(event) =>
                    onExcludeDuplicateTitlesChange(event.currentTarget.checked)
                  }
                />
                <span>
                  <strong>重複候補を登録しない</strong>
                  <small>
                    チェックした場合だけ、候補を登録対象から外します。
                  </small>
                </span>
              </label>
              {excludeDuplicateTitles && (
                <p className="todo-import-exclusion-summary">
                  重複候補{duplicateTitleCount}件を除外し、
                  {itemsToRegisterCount}件を登録します。
                </p>
              )}
            </div>
          )}
          <div
            className="todo-import-final-summary"
            role="status"
            aria-label="CSV登録前の最終件数"
          >
            <div className="todo-import-final-summary-heading">
              <strong>登録前の最終件数</strong>
              <p>検索や表示条件に関係なく、現在の選択内容を集計しています。</p>
            </div>
            <dl>
              <div>
                <dt>CSV全体</dt>
                <dd>{preview.items.length}件</dd>
              </div>
              <div>
                <dt>登録対象</dt>
                <dd>{itemsToRegisterCount}件</dd>
              </div>
              <div>
                <dt>除外</dt>
                <dd>{excludedItemIndexes.size}件</dd>
              </div>
            </dl>
          </div>
          <p>
            {excludeDuplicateTitles
              ? individuallyExcludedItemCount > 0
                ? '重複候補と個別に外した候補以外を登録します。完了状態と固定状態は引き継ぎ、作成・更新日時は新しい登録日時になります。'
                : '重複候補以外を登録します。完了状態と固定状態は引き継ぎ、作成・更新日時は新しい登録日時になります。'
              : individuallyExcludedItemCount > 0
                ? '個別に外した候補以外を登録します。完了状態と固定状態は引き継ぎ、作成・更新日時は新しい登録日時になります。'
                : '同じ内容も別のToDoとして追加します。完了状態と固定状態は引き継ぎ、作成・更新日時は新しい登録日時になります。'}
          </p>
          <div className="todo-import-buttons">
            <button
              type="button"
              className="todo-import-confirm-button"
              disabled={isImporting || itemsToRegisterCount === 0}
              onClick={() => {
                setExpandedPreviewItemIndexes(new Set())
                onConfirm()
              }}
            >
              {isImporting
                ? 'CSVを登録中...'
                : itemsToRegisterCount > 0
                  ? `${itemsToRegisterCount}件を登録する`
                  : '登録対象がありません'}
            </button>
            <button
              type="button"
              className="todo-import-cancel-button"
              disabled={isImporting}
              onClick={() => {
                setExpandedPreviewItemIndexes(new Set())
                onCancel()
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="todo-import-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type TodoDuplicateTitleWarningProps = {
  readonly duplicateCount: number
  readonly loadedCount: number
  readonly totalCount: number
  readonly isCreating: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function TodoDuplicateTitleWarning({
  duplicateCount,
  loadedCount,
  totalCount,
  isCreating,
  onConfirm,
  onCancel,
}: TodoDuplicateTitleWarningProps) {
  const unloadedCount = Math.max(0, totalCount - loadedCount)

  return (
    <div className="todo-duplicate-title-warning" role="alert">
      <strong>同じタイトルのToDoが{duplicateCount}件あります。</strong>
      <p>
        読み込み済み{loadedCount}
        件を確認しました。内容を確認して、重複登録を防いでください。
        {unloadedCount > 0 &&
          ` 未読み込みの${unloadedCount}件は判定対象外です。`}
      </p>
      <div className="todo-duplicate-title-buttons">
        <button
          type="button"
          className="todo-duplicate-title-confirm"
          disabled={isCreating}
          onClick={onConfirm}
        >
          {isCreating ? '追加中...' : 'それでも追加'}
        </button>
        <button
          type="button"
          className="todo-duplicate-title-cancel"
          disabled={isCreating}
          onClick={onCancel}
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}

type TodoPanelProps = {
  readonly refreshToken?: number
  readonly equipmentOptionsState?: WorkReportEquipmentOptionsState
  readonly onReloadEquipmentOptions?: () => void
}

export function TodoPanel({
  refreshToken = 0,
  equipmentOptionsState = LOADING_EQUIPMENT_OPTIONS,
  onReloadEquipmentOptions = () => undefined,
}: TodoPanelProps) {
  const {
    state,
    isCreating,
    createError,
    isImporting,
    importError,
    mutationError,
    todoLoadingAction,
    loadMoreError,
    mutatingTodoIds,
    addTodo,
    importTodos,
    clearImportError,
    editTodo,
    duplicateTodo,
    repeatTodo,
    toggleTodo,
    toggleTodoPinned,
    toggleTodoArchived,
    setTodosCompletion,
    setTodosPinned,
    setTodosDueDate,
    setTodosPriority,
    setTodosCategory,
    duplicateTodos,
    removeTodos,
    removeTodo,
    loadMore,
    loadAll,
    reload,
  } = useTodos(refreshToken)
  const [initialViewPreferences] = useState(loadTodoViewPreferences)
  const [initialTodoDraft] = useState(loadTodoDraft)
  const [title, setTitle] = useState(initialTodoDraft.title)
  const [description, setDescription] = useState(initialTodoDraft.description)
  const [dueDate, setDueDate] = useState(initialTodoDraft.dueDate)
  const [priority, setPriority] = useState<TodoPriority>(
    initialTodoDraft.priority,
  )
  const [category, setCategory] = useState(initialTodoDraft.category)
  const [equipmentDepartmentId, setEquipmentDepartmentId] = useState(
    initialTodoDraft.equipmentDepartmentId,
  )
  const [equipmentId, setEquipmentId] = useState(initialTodoDraft.equipmentId)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isConfirmingDuplicateCreate, setIsConfirmingDuplicateCreate] =
    useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [archiveView, setArchiveView] = useState<TodoArchiveView>('current')
  const [statusFilter, setStatusFilter] = useState<TodoStatusFilter>(
    initialViewPreferences.statusFilter,
  )
  const [dueFilter, setDueFilter] = useState<TodoDueFilter>(
    initialViewPreferences.dueFilter,
  )
  const [priorityFilter, setPriorityFilter] = useState<TodoPriorityFilter>(
    initialViewPreferences.priorityFilter,
  )
  const [pinnedFilter, setPinnedFilter] = useState<TodoPinnedFilter>(
    initialViewPreferences.pinnedFilter,
  )
  const [categoryFilter, setCategoryFilter] = useState<TodoCategoryFilter>(
    initialViewPreferences.categoryFilter,
  )
  const [sortOption, setSortOption] = useState<TodoSortOption>(
    initialViewPreferences.sortOption,
  )
  const [selectedTodoIds, setSelectedTodoIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<
    string | null
  >(null)
  const [exportResult, setExportResult] = useState<{
    readonly kind: 'success' | 'error'
    readonly message: string
  } | null>(null)
  const [csvImportPreview, setCsvImportPreview] =
    useState<TodoCsvImportPreview | null>(null)
  const [csvImportPreviewSearchQuery, setCsvImportPreviewSearchQuery] =
    useState('')
  const [excludeCsvDuplicateTitles, setExcludeCsvDuplicateTitles] =
    useState(false)
  const [showAllCsvImportPreviewItems, setShowAllCsvImportPreviewItems] =
    useState(false)
  const [
    showOnlyCsvDuplicatePreviewItems,
    setShowOnlyCsvDuplicatePreviewItems,
  ] = useState(false)
  const [
    showOnlyIncludedCsvImportPreviewItems,
    setShowOnlyIncludedCsvImportPreviewItems,
  ] = useState(false)
  const [excludedCsvImportItemIndexes, setExcludedCsvImportItemIndexes] =
    useState<ReadonlySet<number>>(() => new Set())
  const [csvImportError, setCsvImportError] = useState<string | null>(null)
  const today = getLocalDateString()

  useEffect(() => {
    saveTodoViewPreferences({
      statusFilter,
      dueFilter,
      priorityFilter,
      pinnedFilter,
      categoryFilter,
      sortOption,
    })
  }, [
    categoryFilter,
    dueFilter,
    pinnedFilter,
    priorityFilter,
    sortOption,
    statusFilter,
  ])

  useEffect(() => {
    saveTodoDraft({
      title,
      description,
      dueDate,
      priority,
      category,
      equipmentDepartmentId,
      equipmentId,
    })
  }, [
    category,
    description,
    dueDate,
    equipmentDepartmentId,
    equipmentId,
    priority,
    title,
  ])

  const currentTodos = useMemo(
    () =>
      state.phase === 'ready'
        ? state.items.filter((todo) => !todo.is_archived)
        : [],
    [state],
  )
  const archivedTodos = useMemo(
    () =>
      state.phase === 'ready'
        ? state.items.filter((todo) => todo.is_archived)
        : [],
    [state],
  )
  const visibleTodos = useMemo(
    () =>
      archiveView === 'archived'
        ? sortTodos(archivedTodos, 'updated')
        : state.phase === 'ready'
          ? sortTodos(
              filterTodos(
                currentTodos,
                searchQuery,
                statusFilter,
                dueFilter,
                today,
                priorityFilter,
                categoryFilter,
                pinnedFilter,
              ),
              sortOption,
            )
          : [],
    [
      archiveView,
      archivedTodos,
      categoryFilter,
      currentTodos,
      dueFilter,
      pinnedFilter,
      priorityFilter,
      searchQuery,
      sortOption,
      state,
      statusFilter,
      today,
    ],
  )
  const attentionCounts = useMemo(
    () => getTodoAttentionCounts(currentTodos, today),
    [currentTodos, today],
  )
  const progressSummary = useMemo(
    () => getTodoProgressSummary(currentTodos),
    [currentTodos],
  )
  const duplicateTitleCount = useMemo(
    () =>
      state.phase === 'ready'
        ? countTodosWithMatchingTitle(state.items, title)
        : 0,
    [state, title],
  )
  const csvImportDuplicateTitleIndexes = useMemo(
    () =>
      state.phase === 'ready' && csvImportPreview
        ? new Set(
            getTodoInputIndexesMatchingExistingTitles(
              state.items,
              csvImportPreview.items,
            ),
          )
        : new Set<number>(),
    [csvImportPreview, state],
  )
  const csvImportRepeatedTitleIndexes = useMemo(
    () =>
      csvImportPreview
        ? new Set(getTodoInputIndexesWithRepeatedTitles(csvImportPreview.items))
        : new Set<number>(),
    [csvImportPreview],
  )
  const csvImportAllDuplicateTitleIndexes = useMemo(
    () =>
      new Set([
        ...csvImportDuplicateTitleIndexes,
        ...csvImportRepeatedTitleIndexes,
      ]),
    [csvImportDuplicateTitleIndexes, csvImportRepeatedTitleIndexes],
  )
  const categoryFilterOptions = useMemo(
    () => getTodoCategoryFilterOptions(currentTodos),
    [currentTodos],
  )
  const categoryQuickOptions = useMemo(
    () =>
      categoryFilterOptions
        .filter((option) => option.value.startsWith('category:'))
        .map((option) => option.label),
    [categoryFilterOptions],
  )
  const pinnedCount = currentTodos.filter((todo) => todo.is_pinned).length
  const activeViewChangeCount = getTodoViewChangeCount({
    query: searchQuery,
    statusFilter,
    dueFilter,
    priorityFilter,
    pinnedFilter,
    categoryFilter,
    sortOption,
  })

  const selectedTodos =
    state.phase === 'ready'
      ? state.items.filter((todo) => selectedTodoIds.has(todo.id))
      : []
  const isAllVisibleSelected =
    visibleTodos.length > 0 &&
    visibleTodos.every((todo) => selectedTodoIds.has(todo.id))
  const isBulkBusy = selectedTodos.some((todo) => mutatingTodoIds.has(todo.id))

  function clearSelection() {
    setSelectedTodoIds(new Set())
    setIsConfirmingBulkDelete(false)
    setActionSuccessMessage(null)
    setExportResult(null)
  }

  function handleFilterChange<T>(
    value: T,
    updateFilter: (nextValue: T) => void,
  ) {
    clearSelection()
    updateFilter(value)
  }

  function handleArchiveViewChange(view: TodoArchiveView) {
    clearSelection()
    setArchiveView(view)
  }

  function handleSelectionChange(todoId: string, isSelected: boolean) {
    setActionSuccessMessage(null)
    setExportResult(null)
    setIsConfirmingBulkDelete(false)
    setSelectedTodoIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (isSelected) {
        nextIds.add(todoId)
      } else {
        nextIds.delete(todoId)
      }
      return nextIds
    })
  }

  function showAttentionView(view: 'overdue' | 'today' | 'highPriority') {
    clearSelection()
    setSearchQuery('')
    setStatusFilter('active')
    setDueFilter(view === 'highPriority' ? 'all' : view)
    setPriorityFilter(view === 'highPriority' ? 'high' : 'all')
    setPinnedFilter('all')
    setCategoryFilter('all')
    setSortOption(view === 'highPriority' ? 'priority' : 'due')
  }

  function showProgressView(status: 'active' | 'completed') {
    clearSelection()
    setSearchQuery('')
    setStatusFilter(status)
    setDueFilter('all')
    setPriorityFilter('all')
    setPinnedFilter('all')
    setCategoryFilter('all')
    setSortOption('due')
  }

  function resetTodoView() {
    clearSelection()
    setSearchQuery('')
    setStatusFilter('all')
    setDueFilter('all')
    setPriorityFilter('all')
    setPinnedFilter('all')
    setCategoryFilter('all')
    setSortOption('due')
  }

  function handleToggleAllVisible() {
    setActionSuccessMessage(null)
    setExportResult(null)
    setIsConfirmingBulkDelete(false)
    setSelectedTodoIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (isAllVisibleSelected) {
        visibleTodos.forEach((todo) => nextIds.delete(todo.id))
      } else {
        visibleTodos.forEach((todo) => nextIds.add(todo.id))
      }
      return nextIds
    })
  }

  async function handleBulkCompletion(isCompleted: boolean) {
    setActionSuccessMessage(null)
    setIsConfirmingBulkDelete(false)
    const result = await setTodosCompletion(
      selectedTodos.map((todo) => todo.id),
      isCompleted,
    )

    setSelectedTodoIds(new Set(result.failedIds))
    if (result.updatedItems.length > 0) {
      const action = isCompleted ? '完了' : '未完了'
      setActionSuccessMessage(
        `${result.updatedItems.length}件を${action}へ変更しました。`,
      )
    }
  }

  async function handleBulkPriority(priority: TodoPriority) {
    setActionSuccessMessage(null)
    setIsConfirmingBulkDelete(false)
    const result = await setTodosPriority(
      selectedTodos.map((todo) => todo.id),
      priority,
    )

    setSelectedTodoIds(new Set(result.failedIds))
    if (result.updatedItems.length > 0) {
      setActionSuccessMessage(
        `${result.updatedItems.length}件の優先度を「${TODO_PRIORITY_LABELS[priority]}」へ変更しました。`,
      )
    }
  }

  async function handleBulkPinned(isPinned: boolean) {
    setActionSuccessMessage(null)
    setIsConfirmingBulkDelete(false)
    const result = await setTodosPinned(
      selectedTodos.map((todo) => todo.id),
      isPinned,
    )

    setSelectedTodoIds(new Set(result.failedIds))
    if (result.updatedItems.length > 0) {
      setActionSuccessMessage(
        isPinned
          ? `${result.updatedItems.length}件を上部へ固定しました。`
          : `${result.updatedItems.length}件の固定を解除しました。`,
      )
    }
  }

  async function handleBulkDueDate(dueDate: string) {
    setActionSuccessMessage(null)
    setIsConfirmingBulkDelete(false)
    const result = await setTodosDueDate(
      selectedTodos.map((todo) => todo.id),
      dueDate,
    )

    setSelectedTodoIds(new Set(result.failedIds))
    if (result.updatedItems.length > 0) {
      const dueDateLabel =
        getTodoDueDateQuickOptions(today).find(
          (option) => option.value === dueDate,
        )?.label ?? (dueDate ? formatDueDate(dueDate) : '期限なし')
      setActionSuccessMessage(
        `${result.updatedItems.length}件の期限を「${dueDateLabel}」へ変更しました。`,
      )
    }
  }

  async function handleBulkCategory(category: string) {
    setActionSuccessMessage(null)
    setIsConfirmingBulkDelete(false)
    const result = await setTodosCategory(
      selectedTodos.map((todo) => todo.id),
      category,
    )

    setSelectedTodoIds(new Set(result.failedIds))
    if (result.updatedItems.length > 0) {
      const categoryLabel = category || 'カテゴリなし'
      setActionSuccessMessage(
        `${result.updatedItems.length}件のカテゴリを「${categoryLabel}」へ変更しました。`,
      )
    }
  }

  async function handleBulkDuplicate() {
    setActionSuccessMessage(null)
    setIsConfirmingBulkDelete(false)
    const result = await duplicateTodos(selectedTodos.map((todo) => todo.id))

    setSelectedTodoIds(new Set(result.failedIds))
    if (result.createdItems.length > 0) {
      setActionSuccessMessage(
        `${result.createdItems.length}件のToDoを複製しました。`,
      )
    }
  }

  async function handleBulkDelete() {
    setActionSuccessMessage(null)
    const result = await removeTodos(selectedTodos.map((todo) => todo.id))
    const deletedIdSet = new Set(result.deletedIds)

    setIsConfirmingBulkDelete(false)
    setSelectedTodoIds(new Set(result.failedIds))
    if (
      result.deletedIds.length > 0 &&
      categoryFilter !== 'all' &&
      state.phase === 'ready' &&
      !state.items.some(
        (todo) =>
          !deletedIdSet.has(todo.id) &&
          getCategoryFilterForValue(todo.category) === categoryFilter,
      )
    ) {
      setCategoryFilter('all')
    }
    if (result.deletedIds.length > 0) {
      setActionSuccessMessage(
        `${result.deletedIds.length}件のToDoを削除しました。`,
      )
    }
  }

  async function createTodoFromComposer() {
    setIsConfirmingDuplicateCreate(false)
    const didCreate = await addTodo({
      title,
      description,
      dueDate,
      priority,
      category,
      equipmentId,
    })
    if (didCreate) {
      clearTodoDraft()
      setTitle('')
      setDescription('')
      setDueDate('')
      setPriority('medium')
      setCategory('')
      setEquipmentDepartmentId('')
      setEquipmentId('')
      setSuccessMessage('ToDoを追加しました。')
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccessMessage(null)
    if (duplicateTitleCount > 0) {
      setIsConfirmingDuplicateCreate(true)
      return
    }

    void createTodoFromComposer()
  }

  function getCategoryFilterForValue(
    categoryValue: string | null,
  ): TodoCategoryFilter {
    return categoryValue
      ? makeTodoCategoryFilter(categoryValue)
      : 'uncategorized'
  }

  function hasAnotherTodoInCurrentCategory(todoId: string): boolean {
    return (
      state.phase === 'ready' &&
      state.items.some(
        (todo) =>
          todo.id !== todoId &&
          getCategoryFilterForValue(todo.category) === categoryFilter,
      )
    )
  }

  async function handleEditTodo(
    todoId: string,
    input: TodoEditInput,
  ): Promise<boolean> {
    const didUpdate = await editTodo(todoId, input)
    if (
      didUpdate &&
      categoryFilter !== 'all' &&
      getCategoryFilterForValue(input.category.trim() || null) !==
        categoryFilter &&
      !hasAnotherTodoInCurrentCategory(todoId)
    ) {
      handleFilterChange('all', setCategoryFilter)
    }
    return didUpdate
  }

  async function handleRemoveTodo(todoId: string): Promise<boolean> {
    const didDelete = await removeTodo(todoId)
    if (
      didDelete &&
      categoryFilter !== 'all' &&
      !hasAnotherTodoInCurrentCategory(todoId)
    ) {
      handleFilterChange('all', setCategoryFilter)
    }
    return didDelete
  }

  async function handleDuplicateTodo(todo: Todo): Promise<boolean> {
    setActionSuccessMessage(null)
    const didDuplicate = await duplicateTodo(todo)
    if (didDuplicate) {
      setActionSuccessMessage(`「${todo.title}」を複製しました。`)
    }
    return didDuplicate
  }

  async function handleRepeatTodo(
    todo: Todo,
    nextDueDate: string,
  ): Promise<boolean> {
    setActionSuccessMessage(null)
    const didCreate = await repeatTodo(todo, nextDueDate)
    if (didCreate) {
      setActionSuccessMessage(
        `「${todo.title}」の次回ToDoを${formatDueDate(nextDueDate)}で作成しました。`,
      )
    }
    return didCreate
  }

  async function handleToggleTodoPinned(todo: Todo): Promise<boolean> {
    setActionSuccessMessage(null)
    const didUpdate = await toggleTodoPinned(todo)
    if (didUpdate) {
      setActionSuccessMessage(
        todo.is_pinned
          ? `「${todo.title}」の固定を解除しました。`
          : `「${todo.title}」を上部へ固定しました。`,
      )
    }
    return didUpdate
  }

  async function handleToggleTodoArchived(todo: Todo): Promise<boolean> {
    setActionSuccessMessage(null)
    const didUpdate = await toggleTodoArchived(todo)
    if (didUpdate) {
      if (todo.is_archived) {
        setArchiveView('current')
        setActionSuccessMessage(`「${todo.title}」を通常一覧へ復元しました。`)
      } else {
        setActionSuccessMessage(`「${todo.title}」をアーカイブしました。`)
      }
    }
    return didUpdate
  }

  function handleExportVisibleTodos() {
    setExportResult(null)
    if (visibleTodos.length === 0) {
      return
    }

    try {
      downloadTodosCsv(visibleTodos, today)
      setExportResult({
        kind: 'success',
        message: `表示中の${visibleTodos.length}件をCSVに書き出しました。`,
      })
    } catch {
      setExportResult({
        kind: 'error',
        message:
          'CSVを書き出せませんでした。ブラウザのダウンロード設定を確認してください。',
      })
    }
  }

  function handleExportSelectedTodos() {
    setExportResult(null)
    if (selectedTodos.length === 0) {
      return
    }

    try {
      downloadTodosCsv(selectedTodos, today)
      setExportResult({
        kind: 'success',
        message: `選択中の${selectedTodos.length}件をCSVに書き出しました。`,
      })
    } catch {
      setExportResult({
        kind: 'error',
        message:
          'CSVを書き出せませんでした。ブラウザのダウンロード設定を確認してください。',
      })
    }
  }

  async function handleLoadAllTodos() {
    setActionSuccessMessage(null)
    setExportResult(null)
    const didLoadAll = await loadAll()
    if (didLoadAll) {
      setActionSuccessMessage('すべてのToDoを読み込みました。')
    }
  }

  async function handleCsvFile(file: File | null) {
    setActionSuccessMessage(null)
    setExportResult(null)
    setCsvImportPreview(null)
    setCsvImportPreviewSearchQuery('')
    setExcludeCsvDuplicateTitles(false)
    setShowAllCsvImportPreviewItems(false)
    setShowOnlyCsvDuplicatePreviewItems(false)
    setShowOnlyIncludedCsvImportPreviewItems(false)
    setExcludedCsvImportItemIndexes(new Set())
    setCsvImportError(null)
    clearImportError()
    if (!file) {
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvImportError('CSVファイルを選択してください。')
      return
    }
    if (file.size > 1_000_000) {
      setCsvImportError('CSVファイルが大きすぎます。')
      return
    }

    try {
      const items = parseTodosCsv(await file.text())
      setCsvImportPreview({ fileName: file.name, items })
    } catch (error) {
      setCsvImportError(
        error instanceof TodoCsvError
          ? error.message
          : 'CSVファイルを読み込めませんでした。',
      )
    }
  }

  async function handleCsvImport() {
    if (!csvImportPreview) {
      return
    }

    setActionSuccessMessage(null)
    const excludedIndexes = getTodoInputExcludedIndexes(
      csvImportPreview.items.length,
      excludedCsvImportItemIndexes,
      csvImportAllDuplicateTitleIndexes,
      excludeCsvDuplicateTitles,
    )
    const pendingItems = getTodoInputsExcludingIndexes(
      csvImportPreview.items,
      excludedIndexes,
    )
    if (pendingItems.length === 0) {
      return
    }
    const result = await importTodos(pendingItems)
    const failedItems = result.failedIndexes
      .map((index) => pendingItems[index])
      .filter((item): item is TodoCreateInput => item !== undefined)

    if (result.createdItems.length > 0) {
      setActionSuccessMessage(
        `${result.createdItems.length}件のToDoをCSVから登録しました。`,
      )
    }
    setCsvImportPreview(
      failedItems.length > 0
        ? { fileName: csvImportPreview.fileName, items: failedItems }
        : null,
    )
    setCsvImportPreviewSearchQuery('')
    setExcludeCsvDuplicateTitles(false)
    setShowAllCsvImportPreviewItems(false)
    setShowOnlyCsvDuplicatePreviewItems(false)
    setShowOnlyIncludedCsvImportPreviewItems(false)
    setExcludedCsvImportItemIndexes(new Set())
  }

  function handleShowOnlyCsvDuplicatePreviewItemsChange(showOnly: boolean) {
    setShowOnlyCsvDuplicatePreviewItems(showOnly)
    if (showOnly) {
      setShowOnlyIncludedCsvImportPreviewItems(false)
    }
  }

  function handleShowOnlyIncludedCsvImportPreviewItemsChange(
    showOnly: boolean,
  ) {
    setShowOnlyIncludedCsvImportPreviewItems(showOnly)
    if (showOnly) {
      setShowOnlyCsvDuplicatePreviewItems(false)
    } else {
      setShowAllCsvImportPreviewItems(true)
    }
  }

  function handleExcludeAllCsvImportPreviewItems() {
    if (!csvImportPreview) {
      return
    }

    setExcludedCsvImportItemIndexes(
      new Set(csvImportPreview.items.map((_, index) => index)),
    )
    setShowAllCsvImportPreviewItems(true)
    setShowOnlyCsvDuplicatePreviewItems(false)
    setShowOnlyIncludedCsvImportPreviewItems(false)
  }

  function handleIncludeCsvImportPreviewItems(indexes: readonly number[]) {
    setExcludedCsvImportItemIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes)
      indexes.forEach((index) => nextIndexes.delete(index))
      return nextIndexes
    })
  }

  function handleCsvPreviewItemExclusionChange(
    index: number,
    isExcluded: boolean,
  ) {
    setExcludedCsvImportItemIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes)
      if (isExcluded) {
        nextIndexes.add(index)
      } else {
        nextIndexes.delete(index)
      }
      return nextIndexes
    })
  }

  function cancelCsvImport() {
    setCsvImportPreview(null)
    setCsvImportPreviewSearchQuery('')
    setExcludeCsvDuplicateTitles(false)
    setShowAllCsvImportPreviewItems(false)
    setShowOnlyCsvDuplicatePreviewItems(false)
    setShowOnlyIncludedCsvImportPreviewItems(false)
    setExcludedCsvImportItemIndexes(new Set())
    setCsvImportError(null)
    clearImportError()
  }

  const isFormUnavailable = state.phase !== 'ready'

  return (
    <section className="todo-section" aria-labelledby="todo-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ACTION CONTROL</p>
          <h2 id="todo-title">ToDo</h2>
        </div>
        <p>{state.phase === 'ready' ? `${state.total} items` : 'syncing'}</p>
      </div>

      <div className="todo-layout">
        <form className="todo-composer" onSubmit={handleSubmit}>
          <div className="todo-panel-heading">
            <div>
              <span>NEW ACTION</span>
              <h3>新しいToDo</h3>
            </div>
            <span className="todo-panel-index">01</span>
          </div>

          <fieldset disabled={isFormUnavailable || isCreating}>
            <label htmlFor="todo-title-input">タイトル</label>
            <input
              id="todo-title-input"
              name="title"
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setIsConfirmingDuplicateCreate(false)
              }}
              maxLength={200}
              placeholder="今日取り組むこと"
              required
            />

            <label htmlFor="todo-description">説明（任意）</label>
            <textarea
              id="todo-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              rows={4}
              placeholder="必要な手順やメモ"
            />

            <label htmlFor="todo-due-date">期限（任意）</label>
            <input
              id="todo-due-date"
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />

            <label htmlFor="todo-priority">優先度</label>
            <select
              id="todo-priority"
              name="priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TodoPriority)
              }
            >
              {TODO_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label htmlFor="todo-category">カテゴリ（任意）</label>
            <input
              id="todo-category"
              name="category"
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={30}
              placeholder="例：学習、仕事、資産づくり"
            />

            <TodoEquipmentFields
              idPrefix="todo"
              departmentId={equipmentDepartmentId}
              equipmentId={equipmentId}
              state={equipmentOptionsState}
              onDepartmentChange={(departmentId) => {
                setEquipmentDepartmentId(departmentId)
                setEquipmentId('')
              }}
              onEquipmentChange={setEquipmentId}
              onReload={onReloadEquipmentOptions}
            />

            <button type="submit" disabled={!title.trim() || isCreating}>
              {isCreating ? '追加中...' : 'ToDoを追加'}
            </button>
            <p className="todo-draft-storage-note">
              入力途中の内容はこの端末に自動保存され、登録後に消去されます。
            </p>
          </fieldset>

          {isConfirmingDuplicateCreate && duplicateTitleCount > 0 && (
            <TodoDuplicateTitleWarning
              duplicateCount={duplicateTitleCount}
              loadedCount={state.phase === 'ready' ? state.items.length : 0}
              totalCount={state.phase === 'ready' ? state.total : 0}
              isCreating={isCreating}
              onConfirm={() => void createTodoFromComposer()}
              onCancel={() => setIsConfirmingDuplicateCreate(false)}
            />
          )}

          {successMessage && (
            <p className="form-message success-message" role="status">
              {successMessage}
            </p>
          )}
          {createError && (
            <p className="form-message error-message" role="alert">
              {createError}
            </p>
          )}
          {isFormUnavailable && (
            <p className="form-hint">一覧の接続後に入力できます。</p>
          )}
        </form>

        <div className="todo-board" aria-live="polite">
          <div className="todo-panel-heading">
            <div>
              <span>ACTION QUEUE</span>
              <h3>実行リスト</h3>
            </div>
            <span className="todo-panel-index">02</span>
          </div>

          {state.phase === 'loading' && (
            <div className="todo-state-card" role="status">
              <span className="state-indicator loading" aria-hidden="true" />
              <div>
                <strong>ToDoを読み込んでいます</strong>
                <p>FastAPIから最新の一覧を取得中です。</p>
              </div>
            </div>
          )}

          {state.phase === 'error' && (
            <div className="todo-state-card error" role="alert">
              <span className="state-indicator" aria-hidden="true" />
              <div>
                <strong>ToDoへ接続できません</strong>
                <p>APIの起動状態を確認して、もう一度お試しください。</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={reload}
                >
                  再読み込み
                </button>
              </div>
            </div>
          )}

          {state.phase === 'ready' && (
            <TodoCsvImportActions
              preview={csvImportPreview}
              duplicateTitleIndexes={csvImportDuplicateTitleIndexes}
              csvRepeatedTitleIndexes={csvImportRepeatedTitleIndexes}
              previewSearchQuery={csvImportPreviewSearchQuery}
              excludeDuplicateTitles={excludeCsvDuplicateTitles}
              showAllPreviewItems={showAllCsvImportPreviewItems}
              showOnlyDuplicatePreviewItems={showOnlyCsvDuplicatePreviewItems}
              showOnlyIncludedPreviewItems={
                showOnlyIncludedCsvImportPreviewItems
              }
              excludedPreviewItemIndexes={excludedCsvImportItemIndexes}
              loadedCount={state.items.length}
              totalCount={state.total}
              isImporting={isImporting}
              error={csvImportError ?? importError}
              onFileSelect={(file) => void handleCsvFile(file)}
              onExcludeDuplicateTitlesChange={setExcludeCsvDuplicateTitles}
              onPreviewSearchQueryChange={setCsvImportPreviewSearchQuery}
              onShowAllPreviewItemsChange={setShowAllCsvImportPreviewItems}
              onShowOnlyDuplicatePreviewItemsChange={
                handleShowOnlyCsvDuplicatePreviewItemsChange
              }
              onShowOnlyIncludedPreviewItemsChange={
                handleShowOnlyIncludedCsvImportPreviewItemsChange
              }
              onExcludeAllPreviewItems={handleExcludeAllCsvImportPreviewItems}
              onIncludePreviewItems={handleIncludeCsvImportPreviewItems}
              onPreviewItemExclusionChange={handleCsvPreviewItemExclusionChange}
              onClearPreviewItemExclusions={() => {
                setExcludedCsvImportItemIndexes(new Set())
                setShowOnlyIncludedCsvImportPreviewItems(false)
              }}
              onConfirm={() => void handleCsvImport()}
              onCancel={cancelCsvImport}
            />
          )}

          {state.phase === 'ready' && state.items.length === 0 && (
            <div className="todo-state-card empty">
              <span className="state-indicator" aria-hidden="true" />
              <div>
                <strong>登録されたToDoはありません</strong>
                <p>左のフォームから最初の行動を追加できます。</p>
              </div>
            </div>
          )}

          {state.phase === 'ready' && state.items.length > 0 && (
            <>
              <TodoArchiveViewControls
                view={archiveView}
                currentCount={currentTodos.length}
                archivedCount={archivedTodos.length}
                onViewChange={handleArchiveViewChange}
              />
              {archiveView === 'current' && (
                <>
                  <TodoProgressSummary
                    summary={progressSummary}
                    onShowActive={() => showProgressView('active')}
                    onShowCompleted={() => showProgressView('completed')}
                  />
                  <TodoAttentionSummary
                    counts={attentionCounts}
                    onShowOverdue={() => showAttentionView('overdue')}
                    onShowToday={() => showAttentionView('today')}
                    onShowHighPriority={() => showAttentionView('highPriority')}
                  />
                  <TodoFilterControls
                    query={searchQuery}
                    statusFilter={statusFilter}
                    dueFilter={dueFilter}
                    priorityFilter={priorityFilter}
                    pinnedFilter={pinnedFilter}
                    pinnedCount={pinnedCount}
                    categoryFilter={categoryFilter}
                    categoryFilterOptions={categoryFilterOptions}
                    sortOption={sortOption}
                    visibleCount={visibleTodos.length}
                    loadedCount={currentTodos.length}
                    activeViewChangeCount={activeViewChangeCount}
                    onQueryChange={(value) =>
                      handleFilterChange(value, setSearchQuery)
                    }
                    onStatusFilterChange={(value) =>
                      handleFilterChange(value, setStatusFilter)
                    }
                    onDueFilterChange={(value) =>
                      handleFilterChange(value, setDueFilter)
                    }
                    onPriorityFilterChange={(value) =>
                      handleFilterChange(value, setPriorityFilter)
                    }
                    onPinnedFilterChange={(value) =>
                      handleFilterChange(value, setPinnedFilter)
                    }
                    onCategoryFilterChange={(value) =>
                      handleFilterChange(value, setCategoryFilter)
                    }
                    onSortOptionChange={(value) =>
                      handleFilterChange(value, setSortOption)
                    }
                    onResetView={resetTodoView}
                  />
                  <TodoExportActions
                    visibleCount={visibleTodos.length}
                    selectedCount={selectedTodos.length}
                    loadedCount={state.items.length}
                    totalCount={state.total}
                    onExportVisible={handleExportVisibleTodos}
                    onExportSelected={handleExportSelectedTodos}
                  />
                  {exportResult && (
                    <p
                      className={`todo-export-message ${exportResult.kind}`}
                      role={
                        exportResult.kind === 'success' ? 'status' : 'alert'
                      }
                    >
                      {exportResult.message}
                    </p>
                  )}
                </>
              )}
              {mutationError && (
                <p className="todo-mutation-error" role="alert">
                  {mutationError}
                </p>
              )}
              {actionSuccessMessage && (
                <p className="todo-bulk-success" role="status">
                  {actionSuccessMessage}
                </p>
              )}
              {archiveView === 'current' && (
                <TodoBulkActions
                  selectedCount={selectedTodos.length}
                  visibleCount={visibleTodos.length}
                  isAllVisibleSelected={isAllVisibleSelected}
                  today={today}
                  canComplete={selectedTodos.some((todo) => !todo.is_completed)}
                  canReopen={selectedTodos.some((todo) => todo.is_completed)}
                  canPin={selectedTodos.some((todo) => !todo.is_pinned)}
                  canUnpin={selectedTodos.some((todo) => todo.is_pinned)}
                  canSetDueDate={(nextDueDate) =>
                    selectedTodos.some(
                      (todo) => (todo.due_date ?? '') !== nextDueDate,
                    )
                  }
                  canSetPriority={(nextPriority) =>
                    selectedTodos.some((todo) => todo.priority !== nextPriority)
                  }
                  canSetCategory={(nextCategory) =>
                    selectedTodos.some(
                      (todo) => (todo.category ?? '') !== nextCategory,
                    )
                  }
                  categoryOptions={categoryQuickOptions}
                  isBusy={isBulkBusy}
                  isConfirmingDelete={isConfirmingBulkDelete}
                  onToggleAllVisible={handleToggleAllVisible}
                  onComplete={() => void handleBulkCompletion(true)}
                  onReopen={() => void handleBulkCompletion(false)}
                  onPin={() => void handleBulkPinned(true)}
                  onUnpin={() => void handleBulkPinned(false)}
                  onDuplicate={() => void handleBulkDuplicate()}
                  onDeleteRequest={() => {
                    setActionSuccessMessage(null)
                    setIsConfirmingBulkDelete(true)
                  }}
                  onDeleteConfirm={() => void handleBulkDelete()}
                  onDeleteCancel={() => setIsConfirmingBulkDelete(false)}
                  onDueDateChange={(nextDueDate) =>
                    void handleBulkDueDate(nextDueDate)
                  }
                  onPriorityChange={(nextPriority) =>
                    void handleBulkPriority(nextPriority)
                  }
                  onCategoryChange={(nextCategory) =>
                    void handleBulkCategory(nextCategory)
                  }
                  onClear={clearSelection}
                />
              )}
              {visibleTodos.length === 0 ? (
                <div className="todo-state-card empty filtered-empty">
                  <span className="state-indicator" aria-hidden="true" />
                  <div>
                    <strong>
                      {archiveView === 'archived'
                        ? 'アーカイブされたToDoはありません'
                        : currentTodos.length === 0
                          ? '現在のToDoはありません'
                          : '条件に一致するToDoはありません'}
                    </strong>
                    <p>
                      {archiveView === 'archived'
                        ? '完了ToDoをアーカイブすると、ここから復元できます。'
                        : currentTodos.length === 0
                          ? 'アーカイブを確認するか、新しいToDoを追加してください。'
                          : '検索語・状態・固定・期限・優先度・カテゴリの条件を変更してください。'}
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="todo-list">
                  {visibleTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      isBusy={mutatingTodoIds.has(todo.id)}
                      isSelected={selectedTodoIds.has(todo.id)}
                      categoryOptions={categoryQuickOptions}
                      today={today}
                      equipmentOptionsState={equipmentOptionsState}
                      onReloadEquipmentOptions={onReloadEquipmentOptions}
                      onSelectionChange={handleSelectionChange}
                      onEdit={handleEditTodo}
                      onDuplicate={handleDuplicateTodo}
                      onRepeat={handleRepeatTodo}
                      onToggle={toggleTodo}
                      onTogglePinned={handleToggleTodoPinned}
                      onToggleArchived={handleToggleTodoArchived}
                      onDelete={handleRemoveTodo}
                    />
                  ))}
                </ul>
              )}
              <TodoLoadMore
                loadedCount={state.items.length}
                totalCount={state.total}
                loadingAction={todoLoadingAction}
                error={loadMoreError}
                onLoadMore={() => void loadMore()}
                onLoadAll={() => void handleLoadAllTodos()}
              />
            </>
          )}
        </div>
      </div>
    </section>
  )
}

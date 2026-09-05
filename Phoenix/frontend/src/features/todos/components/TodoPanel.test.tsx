import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Todo } from '../types'
import {
  READY_EQUIPMENT_OPTIONS,
  TEST_EQUIPMENT_ID,
} from '../../work-reports/testFixtures'
import { formatTodoUpdatedAt } from '../todoUpdatedAt'
import {
  TodoAttentionSummary,
  TodoArchiveViewControls,
  TodoBulkActions,
  TodoBulkCustomDueDate,
  TodoCategoryQuickActions,
  TodoCsvImportActions,
  TodoDuplicateTitleWarning,
  TodoDueDateQuickActions,
  TodoExportActions,
  TodoFilterControls,
  TodoItem,
  TodoLoadMore,
  TodoManualCopy,
  TodoPanel,
  TodoPriorityQuickActions,
  TodoProgressSummary,
  TodoRepeatQuickActions,
} from './TodoPanel'
import { makeTodoDuplicateInput } from '../todoDuplicate'
import {
  addDaysToLocalDateString,
  getTodoDueDateQuickOptions,
  getTodoDueDateRelativeLabel,
} from '../todoDueDate'
import {
  filterTodos,
  getLocalDateString,
  getTodoCategoryFilterOptions,
  getTodoAttentionCounts,
  getTodoDueState,
  getTodoProgressSummary,
  getTodoViewChangeCount,
  sortTodos,
} from './todoFilters'

const todo: Todo = {
  id: 'a48af9d2-e26c-469f-bbeb-2d99ffbd15c2',
  title: 'Phoenix UIを確認する',
  description: 'PCとスマートフォンで操作を確認する',
  due_date: '2026-07-23',
  priority: 'high',
  category: '学習',
  equipment_id: null,
  is_pinned: false,
  is_completed: false,
  is_archived: false,
  created_at: '2026-07-22T15:00:00Z',
  updated_at: '2026-07-22T15:00:00Z',
}

describe('TodoPanel', () => {
  it('explains that an unfinished Todo is saved only on this device', () => {
    const markup = renderToStaticMarkup(<TodoPanel />)

    expect(markup).toContain(
      '入力途中の内容はこの端末に自動保存され、登録後に消去されます。',
    )
  })
})

describe('TodoDuplicateTitleWarning', () => {
  it('explains the duplicate count and requires an explicit choice', () => {
    const markup = renderToStaticMarkup(
      <TodoDuplicateTitleWarning
        duplicateCount={1}
        loadedCount={3}
        totalCount={5}
        isCreating={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('同じタイトルのToDoが1件あります。')
    expect(markup).toContain('読み込み済み3件を確認しました。')
    expect(markup).toContain('未読み込みの2件は判定対象外です。')
    expect(markup).toContain('>それでも追加</button>')
    expect(markup).toContain('>キャンセル</button>')
  })
})

describe('TodoArchiveViewControls', () => {
  it('shows loaded current and archived counts with an explicit view choice', () => {
    const markup = renderToStaticMarkup(
      <TodoArchiveViewControls
        view="archived"
        currentCount={4}
        archivedCount={1}
        onViewChange={vi.fn()}
      />,
    )

    expect(markup).toContain('完了ToDoの保管')
    expect(markup).toContain('現在のToDo（4）')
    expect(markup).toContain('アーカイブ（1）')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('読み込み済みの完了ToDo')
  })
})

describe('TodoItem', () => {
  it('shows the linked equipment without adding noise to unlinked schedules', () => {
    const linkedMarkup = renderToStaticMarkup(
      <TodoItem
        todo={{ ...todo, equipment_id: TEST_EQUIPMENT_ID }}
        isBusy={false}
        isSelected={false}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onSelectionChange={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onRepeat={vi.fn()}
        onToggle={vi.fn()}
        onTogglePinned={vi.fn()}
        onToggleArchived={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    const unlinkedMarkup = renderToStaticMarkup(
      <TodoItem
        todo={todo}
        isBusy={false}
        isSelected={false}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onSelectionChange={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onRepeat={vi.fn()}
        onToggle={vi.fn()}
        onTogglePinned={vi.fn()}
        onToggleArchived={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(linkedMarkup).toContain('対象設備：菓子パン / 包装機 No.2')
    expect(unlinkedMarkup).not.toContain('対象設備：')
  })

  it('renders completion and guarded delete controls', () => {
    const markup = renderToStaticMarkup(
      <TodoItem
        todo={todo}
        isBusy={false}
        isSelected={false}
        today="2026-07-24"
        onSelectionChange={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onRepeat={vi.fn()}
        onToggle={vi.fn()}
        onTogglePinned={vi.fn()}
        onToggleArchived={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(markup).toContain('完了にする')
    expect(markup).toContain('>上部へ固定</button>')
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain('>期限変更</button>')
    expect(markup).toContain('>優先度変更</button>')
    expect(markup).toContain('>カテゴリ変更</button>')
    expect(markup).toContain('>次回作成</button>')
    expect(markup).toContain('>内容をコピー</button>')
    expect(markup).toContain('>複製</button>')
    expect(markup).toContain('>編集</button>')
    expect(markup).toContain('>削除</button>')
    expect(markup).toContain('todo-due-badge overdue')
    expect(markup).toContain('1日超過')
    expect(markup).toContain('todo-priority-badge high')
    expect(markup).toContain('優先度 高')
    expect(markup).toContain('todo-category-badge')
    expect(markup).toContain('カテゴリ 学習')
    expect(markup).toContain('class="todo-updated-at"')
    expect(markup).toContain('更新 ')
    expect(markup).toContain('一括操作に選択')
    expect(markup).toContain('aria-busy="false"')
    expect(markup).not.toContain('削除を実行')
  })

  it('renders a completed item as checked and disables busy actions', () => {
    const markup = renderToStaticMarkup(
      <TodoItem
        todo={{ ...todo, is_completed: true }}
        isBusy
        isSelected
        today="2026-07-24"
        onSelectionChange={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onRepeat={vi.fn()}
        onToggle={vi.fn()}
        onTogglePinned={vi.fn()}
        onToggleArchived={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(markup).toContain('todo-completed')
    expect(markup).toContain('todo-selected')
    expect(markup).toContain('checked=""')
    expect(markup).toContain('未完了に戻す')
    expect(markup).toContain('変更を保存しています...')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).not.toContain('todo-due-badge')
  })

  it('renders a pinned item with a persistent state indicator', () => {
    const markup = renderToStaticMarkup(
      <TodoItem
        todo={{ ...todo, is_pinned: true }}
        isBusy={false}
        isSelected={false}
        onSelectionChange={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onRepeat={vi.fn()}
        onToggle={vi.fn()}
        onTogglePinned={vi.fn()}
        onToggleArchived={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(markup).toContain('todo-pinned')
    expect(markup).toContain('todo-pinned-badge')
    expect(markup).toContain('固定中')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('>固定を解除</button>')
  })

  it('offers archive for completed items and restore for archived items', () => {
    const completedMarkup = renderToStaticMarkup(
      <TodoItem
        todo={{ ...todo, is_completed: true }}
        isBusy={false}
        isSelected={false}
        onSelectionChange={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onRepeat={vi.fn()}
        onToggle={vi.fn()}
        onTogglePinned={vi.fn()}
        onToggleArchived={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    const archivedMarkup = renderToStaticMarkup(
      <TodoItem
        todo={{ ...todo, is_completed: true, is_archived: true }}
        isBusy={false}
        isSelected={false}
        onSelectionChange={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onRepeat={vi.fn()}
        onToggle={vi.fn()}
        onTogglePinned={vi.fn()}
        onToggleArchived={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(completedMarkup).toContain('>アーカイブ</button>')
    expect(completedMarkup).not.toContain('アーカイブ中')
    expect(archivedMarkup).toContain('todo-archived')
    expect(archivedMarkup).toContain('todo-archived-badge')
    expect(archivedMarkup).toContain('アーカイブ中')
    expect(archivedMarkup).toContain('完了済みで保管中')
    expect(archivedMarkup).toContain('>一覧へ復元</button>')
    expect(archivedMarkup).not.toContain('一括操作に選択')
    expect(archivedMarkup).not.toContain('未完了に戻す')
  })

  it('builds an active duplicate input while preserving task details', () => {
    const input = makeTodoDuplicateInput({
      ...todo,
      title: '長'.repeat(200),
      is_completed: true,
    })

    expect(input.title).toHaveLength(200)
    expect(input.title).toMatch(/（コピー）$/)
    expect(input).toEqual({
      title: `${'長'.repeat(195)}（コピー）`,
      description: todo.description,
      dueDate: todo.due_date,
      priority: todo.priority,
      category: todo.category,
      equipmentId: '',
    })
    expect(input).not.toHaveProperty('is_completed')
  })
})

describe('TodoManualCopy', () => {
  it('shows selectable Todo text when automatic clipboard access is blocked', () => {
    const markup = renderToStaticMarkup(<TodoManualCopy todo={todo} />)

    expect(markup).toContain('自動コピーが制限されています。')
    expect(markup).toContain('手動コピー用のToDo内容')
    expect(markup).toContain('ToDo: Phoenix UIを確認する')
    expect(markup).toContain('PC：枠内をクリックして Ctrl+C')
    expect(markup).toContain('スマートフォン：文章を長押しして')
  })
})

describe('TodoDueDateQuickActions', () => {
  it('calculates today-based dates across month and year boundaries', () => {
    expect(addDaysToLocalDateString('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDaysToLocalDateString('2026-12-31', 1)).toBe('2027-01-01')
    expect(getTodoDueDateQuickOptions('2026-07-23')).toEqual([
      { value: '2026-07-23', label: '今日' },
      { value: '2026-07-24', label: '明日' },
      { value: '2026-07-30', label: '1週間後' },
      { value: '', label: '期限なし' },
    ])
  })

  it('shows calendar-day distances before and after a Todo due date', () => {
    expect(getTodoDueDateRelativeLabel('2026-07-22', '2026-07-23')).toBe(
      '1日超過',
    )
    expect(getTodoDueDateRelativeLabel('2026-07-23', '2026-07-23')).toBe(
      '今日まで',
    )
    expect(getTodoDueDateRelativeLabel('2026-07-24', '2026-07-23')).toBe(
      'あと1日',
    )
    expect(getTodoDueDateRelativeLabel('2026-08-01', '2026-07-30')).toBe(
      'あと2日',
    )
  })

  it('renders four accessible choices and disables the current due date', () => {
    const markup = renderToStaticMarkup(
      <TodoDueDateQuickActions
        todo={todo}
        isBusy={false}
        today="2026-07-23"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('期限をすばやく変更')
    expect(markup).toContain('aria-label="今日（2026年7月23日）"')
    expect(markup).toContain(
      'class="is-current" disabled="" aria-label="今日（2026年7月23日）"',
    )
    expect(markup).toContain('aria-label="明日（2026年7月24日）"')
    expect(markup).toContain('aria-label="1週間後（2026年7月30日）"')
    expect(markup).toContain('aria-label="期限なし"')
    expect(markup).toContain('>閉じる</button>')
  })
})

describe('TodoPriorityQuickActions', () => {
  it('renders three accessible choices and disables the current priority', () => {
    const markup = renderToStaticMarkup(
      <TodoPriorityQuickActions
        todo={{ ...todo, priority: 'medium' }}
        isBusy={false}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('優先度をすばやく変更')
    expect(markup).toContain('aria-label="優先度 高"')
    expect(markup).toContain(
      'class="is-current medium" disabled="" aria-label="優先度 中"',
    )
    expect(markup).toContain('aria-label="優先度 低"')
    expect(markup).toContain('>閉じる</button>')
  })
})

describe('TodoCategoryQuickActions', () => {
  it('renders registered categories and disables the current category', () => {
    const markup = renderToStaticMarkup(
      <TodoCategoryQuickActions
        todo={todo}
        isBusy={false}
        categoryOptions={['学習', '設備保全', '資産づくり']}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('カテゴリをすばやく変更')
    expect(markup).toContain('aria-label="カテゴリ カテゴリなし"')
    expect(markup).toContain(
      'class="is-current" disabled="" aria-label="カテゴリ 学習"',
    )
    expect(markup).toContain('aria-label="カテゴリ 設備保全"')
    expect(markup).toContain('aria-label="カテゴリ 資産づくり"')
    expect(markup).toContain('>閉じる</button>')
  })
})

describe('TodoRepeatQuickActions', () => {
  it('shows one-week and one-month choices with exact next dates', () => {
    const markup = renderToStaticMarkup(
      <TodoRepeatQuickActions
        todo={{ ...todo, due_date: '2026-08-15' }}
        isBusy={false}
        today="2026-08-09"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('次回ToDoを作成')
    expect(markup).toContain(
      '期限がない、または過ぎている場合は、今日を基準にします。',
    )
    expect(markup).toContain(
      'aria-label="1週間後（2026年8月22日）の次回ToDoを作成"',
    )
    expect(markup).toContain(
      'aria-label="1か月後（2026年9月15日）の次回ToDoを作成"',
    )
    expect(markup).toContain('>閉じる</button>')
  })
})

describe('TodoBulkActions', () => {
  it('renders an enabled custom due date action for a selected date', () => {
    const markup = renderToStaticMarkup(
      <TodoBulkCustomDueDate
        value="2026-08-15"
        isDisabled={false}
        canApply
        onChange={vi.fn()}
        onApply={vi.fn()}
      />,
    )

    expect(markup).toContain('for="todo-bulk-custom-due-date">任意の日付')
    expect(markup).toContain('type="date" value="2026-08-15"')
    expect(markup).toContain(
      'aria-label="選択したToDoの期限を2026年8月15日へ変更"',
    )
    expect(markup).toContain('>日付を適用</button>')
    expect(markup).not.toContain('disabled=""')
  })

  it('renders selection count and reversible bulk actions', () => {
    const markup = renderToStaticMarkup(
      <TodoBulkActions
        selectedCount={2}
        visibleCount={3}
        isAllVisibleSelected={false}
        today="2026-07-23"
        canComplete
        canReopen
        canPin
        canUnpin
        canSetDueDate={(dueDate) => dueDate !== '2026-07-24'}
        canSetPriority={(priority) => priority !== 'medium'}
        canSetCategory={(category) => category !== '学習'}
        categoryOptions={['学習', '設備保全']}
        isBusy={false}
        isConfirmingDelete={false}
        onToggleAllVisible={vi.fn()}
        onComplete={vi.fn()}
        onReopen={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        onDuplicate={vi.fn()}
        onDeleteRequest={vi.fn()}
        onDeleteConfirm={vi.fn()}
        onDeleteCancel={vi.fn()}
        onDueDateChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(markup).toContain('aria-label="ToDoの一括操作"')
    expect(markup).toContain('2件を選択中')
    expect(markup).toContain('表示中をすべて選択')
    expect(markup).toContain('選択を完了')
    expect(markup).toContain('未完了に戻す')
    expect(markup).toContain('選択を固定')
    expect(markup).toContain('固定を解除')
    expect(markup).toContain('選択を複製')
    expect(markup).toContain('選択を削除')
    expect(markup).toContain('選択したToDoの期限')
    expect(markup).toContain(
      'aria-label="選択したToDoの期限を今日（2026年7月23日）へ変更"',
    )
    expect(markup).toContain(
      'disabled="" aria-label="選択したToDoの期限を明日（2026年7月24日）へ変更"',
    )
    expect(markup).toContain('aria-label="選択したToDoを期限なしへ変更"')
    expect(markup).toContain('for="todo-bulk-custom-due-date">任意の日付')
    expect(markup).toContain('aria-label="選択したToDoへ任意の期限を設定"')
    expect(markup).toContain('class="todo-bulk-custom-due-button" disabled=""')
    expect(markup).toContain('>日付を適用</button>')
    expect(markup).toContain('選択したToDoの優先度')
    expect(markup).toContain('aria-label="選択したToDoを優先度 高へ変更"')
    expect(markup).toContain(
      'class="medium" disabled="" aria-label="選択したToDoを優先度 中へ変更"',
    )
    expect(markup).toContain('aria-label="選択したToDoを優先度 低へ変更"')
    expect(markup).toContain('選択したToDoのカテゴリ')
    expect(markup).toContain(
      'aria-label="選択したToDoをカテゴリ カテゴリなしへ変更"',
    )
    expect(markup).toContain(
      'disabled="" aria-label="選択したToDoをカテゴリ 学習へ変更"',
    )
    expect(markup).toContain(
      'aria-label="選択したToDoをカテゴリ 設備保全へ変更"',
    )
    expect(markup).toContain('選択解除')
  })

  it('renders a guarded bulk delete confirmation', () => {
    const markup = renderToStaticMarkup(
      <TodoBulkActions
        selectedCount={2}
        visibleCount={3}
        isAllVisibleSelected={false}
        today="2026-07-23"
        canComplete
        canReopen={false}
        canPin
        canUnpin={false}
        canSetDueDate={() => true}
        canSetPriority={() => true}
        canSetCategory={() => true}
        categoryOptions={['学習']}
        isBusy={false}
        isConfirmingDelete
        onToggleAllVisible={vi.fn()}
        onComplete={vi.fn()}
        onReopen={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        onDuplicate={vi.fn()}
        onDeleteRequest={vi.fn()}
        onDeleteConfirm={vi.fn()}
        onDeleteCancel={vi.fn()}
        onDueDateChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(
      '選択した2件を削除しますか？ この操作は元に戻せません。',
    )
    expect(markup).toContain('削除を実行')
    expect(markup).toContain('キャンセル')
    expect(markup).toContain('class="todo-bulk-duplicate-button" disabled=""')
    expect(markup).toContain('class="todo-bulk-pin-button" disabled=""')
  })
})

describe('TodoLoadMore', () => {
  it('shows the remaining count, loading state, and a retryable error', () => {
    const markup = renderToStaticMarkup(
      <TodoLoadMore
        loadedCount={50}
        totalCount={75}
        loadingAction="more"
        error="追加読み込みに失敗しました。"
        onLoadMore={vi.fn()}
        onLoadAll={vi.fn()}
      />,
    )

    expect(markup).toContain('aria-label="ToDoの追加読み込み"')
    expect(markup).toContain('50件を読み込み済み / 残り25件')
    expect(markup).toContain('読み込み済みのToDoが対象です。')
    expect(markup).toContain(
      'class="todo-load-more-button" disabled="">読み込み中...',
    )
    expect(markup).toContain(
      'class="todo-load-all-button" disabled="">すべて読み込む',
    )
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('追加読み込みに失敗しました。')
  })

  it('shows a dedicated busy state while every remaining page is loading', () => {
    const markup = renderToStaticMarkup(
      <TodoLoadMore
        loadedCount={50}
        totalCount={175}
        loadingAction="all"
        error={null}
        onLoadMore={vi.fn()}
        onLoadAll={vi.fn()}
      />,
    )

    expect(markup).toContain('50件を読み込み済み / 残り125件')
    expect(markup).toContain(
      'class="todo-load-all-button" disabled="">全件を読み込み中...',
    )
  })
})

describe('TodoExportActions', () => {
  it('shows the visible count and explains unloaded items', () => {
    const markup = renderToStaticMarkup(
      <TodoExportActions
        visibleCount={3}
        selectedCount={2}
        loadedCount={3}
        totalCount={5}
        onExportVisible={vi.fn()}
        onExportSelected={vi.fn()}
      />,
    )

    expect(markup).toContain('aria-label="ToDoのCSV書き出し"')
    expect(markup).toContain('表示中または選択中のToDoをCSVへ')
    expect(markup).toContain('残り2件は追加読み込み後に含められます。')
    expect(markup).toContain('>表示中の3件をCSVへ</button>')
    expect(markup).toContain('>選択中の2件をCSVへ</button>')
  })

  it('disables each export target when it has no Todo', () => {
    const markup = renderToStaticMarkup(
      <TodoExportActions
        visibleCount={0}
        selectedCount={0}
        loadedCount={5}
        totalCount={5}
        onExportVisible={vi.fn()}
        onExportSelected={vi.fn()}
      />,
    )

    expect(markup).toContain('disabled="">表示中の0件をCSVへ</button>')
    expect(markup).toContain('disabled="">選択中の0件をCSVへ</button>')
  })
})

describe('TodoCsvImportActions', () => {
  it('renders a CSV selector without saving immediately', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={null}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={0}
        totalCount={0}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('aria-label="CSVからToDoを一括登録"')
    expect(markup).toContain('accept=".csv,text/csv"')
    expect(markup).toContain('最大50件まで確認して登録します。')
    expect(markup).not.toContain('件を登録する</button>')
  })

  it('shows a guarded preview and disables it while importing', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{
          fileName: 'phoenix-todos-2026-08-03.csv',
          items: [
            {
              title: 'CSV登録を確認する',
              description: '',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
            {
              title: 'スマートフォン表示を確認する',
              description: '',
              dueDate: '',
              priority: 'low',
              category: '',
              isCompleted: true,
              isPinned: true,
            },
          ],
        }}
        duplicateTitleIndexes={new Set([0])}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={2}
        totalCount={5}
        isImporting
        error="1件を登録できませんでした。"
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('2件を登録しますか？')
    expect(markup).toContain('phoenix-todos-2026-08-03.csv')
    expect(markup).toContain('CSV登録を確認する')
    expect(markup).toContain('<small>未完了 ／通常</small>')
    expect(markup).toContain('<small>完了 ／固定</small>')
    expect(markup).toContain('class="has-duplicate-title"')
    expect(markup).toContain('todo-import-duplicate-badge">重複候補')
    expect(markup.match(/todo-import-duplicate-badge/g)).toHaveLength(1)
    expect(markup).toContain('同じタイトルを確認')
    expect(markup).toContain('同じタイトルが1件あります。')
    expect(markup).toContain('未読み込みの3件は判定対象外です。')
    expect(markup).toContain('完了状態と固定状態は引き継ぎ')
    expect(markup).toContain('disabled="">CSVを登録中...')
    expect(markup).toContain('role="alert"')
  })

  it('shows every CSV candidate detail before registration', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{
          fileName: 'phoenix-todos.csv',
          items: [
            {
              title: '点検予定を確認する',
              description: '担当者へ連絡して手順を確認する',
              dueDate: '2026-08-12',
              priority: 'high',
              category: '確認',
            },
            {
              title: '期限なしの候補',
              description: '',
              dueDate: '',
              priority: 'low',
              category: '',
            },
          ],
        }}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={2}
        totalCount={2}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(
      markup.match(/<details class="todo-import-preview-details">/g),
    ).toHaveLength(2)
    expect(markup).toContain('候補の内容をまとめて確認')
    expect(markup).toContain('現在表示中の候補だけを一括で開閉します。')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('>表示中の2件の内容をすべて開く</button>')
    expect(markup.match(/<summary>内容を確認<\/summary>/g)).toHaveLength(2)
    expect(markup).toContain('担当者へ連絡して手順を確認する')
    expect(markup).toContain('2026年8月12日')
    expect(markup).toContain('<dd>高</dd>')
    expect(markup).toContain('<dd>確認</dd>')
    expect(markup).toContain('<dd>説明なし</dd>')
    expect(markup).toContain('<dd>期限なし</dd>')
    expect(markup).toContain('<dd>カテゴリなし</dd>')
    expect(markup).not.toContain('検索をクリア')
  })

  it('shows the registration count after excluding duplicate candidates', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{
          fileName: 'phoenix-todos.csv',
          items: [
            {
              title: '登録済みToDo',
              description: '',
              dueDate: '',
              priority: 'high',
              category: '',
            },
            {
              title: '新しいToDo',
              description: '',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
          ],
        }}
        duplicateTitleIndexes={new Set([0])}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={4}
        totalCount={4}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('checked=""')
    expect(markup).toContain('重複候補を登録しない')
    expect(markup).toContain('重複候補1件を除外し、1件を登録します。')
    expect(markup).toContain('重複候補以外を登録します。')
    expect(markup).toContain('>1件を登録する</button>')
  })

  it('summarizes the final CSV registration counts before saving', () => {
    const items = [1, 2, 3, 4, 5].map((number) => ({
      title: `${number}件目のCSV候補`,
      description: '',
      dueDate: '',
      priority: 'medium' as const,
      category: '',
    }))
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{ fileName: 'phoenix-todos.csv', items }}
        duplicateTitleIndexes={new Set([1])}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set([3])}
        loadedCount={5}
        totalCount={5}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('aria-label="CSV登録前の最終件数"')
    expect(markup).toContain('登録前の最終件数')
    expect(markup).toContain('検索や表示条件に関係なく')
    expect(markup).toContain('<dt>CSV全体</dt><dd>5件</dd>')
    expect(markup).toContain('<dt>登録対象</dt><dd>3件</dd>')
    expect(markup).toContain('<dt>除外</dt><dd>2件</dd>')
    expect(markup).toContain('>3件を登録する</button>')
  })

  it('warns about later repeated titles inside the selected CSV', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{
          fileName: 'phoenix-todos.csv',
          items: [
            {
              title: '週次予定を確認',
              description: '',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
            {
              title: '週次予定を確認',
              description: 'CSV内の2件目',
              dueDate: '',
              priority: 'low',
              category: '',
            },
          ],
        }}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set([1])}
        previewSearchQuery=""
        excludeDuplicateTitles
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={3}
        totalCount={3}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('todo-import-csv-duplicate-badge">CSV内重複')
    expect(markup.match(/todo-import-csv-duplicate-badge/g)).toHaveLength(1)
    expect(markup).not.toContain('todo-import-duplicate-badge')
    expect(markup).toContain(
      'CSV内で同じタイトルが1件重複しています。先にある候補を残して確認してください。',
    )
    expect(markup).toContain('重複候補1件を除外し、1件を登録します。')
    expect(markup).toContain('>1件を登録する</button>')
  })

  it('expands the CSV preview so later duplicate candidates can be checked', () => {
    const items = [
      {
        title: '1件目のToDo',
        description: '',
        dueDate: '',
        priority: 'medium' as const,
        category: '',
      },
      {
        title: '2件目のToDo',
        description: '',
        dueDate: '',
        priority: 'medium' as const,
        category: '',
      },
      {
        title: '3件目のToDo',
        description: '',
        dueDate: '',
        priority: 'medium' as const,
        category: '',
      },
      {
        title: '4件目のToDo',
        description: '',
        dueDate: '',
        priority: 'medium' as const,
        category: '',
      },
      {
        title: '5件目の重複ToDo',
        description: '',
        dueDate: '',
        priority: 'high' as const,
        category: '',
      },
    ]
    const renderPreview = (showAllPreviewItems: boolean) =>
      renderToStaticMarkup(
        <TodoCsvImportActions
          preview={{ fileName: 'phoenix-todos.csv', items }}
          duplicateTitleIndexes={new Set([4])}
          csvRepeatedTitleIndexes={new Set()}
          previewSearchQuery=""
          excludeDuplicateTitles={false}
          showAllPreviewItems={showAllPreviewItems}
          showOnlyDuplicatePreviewItems={false}
          showOnlyIncludedPreviewItems={false}
          excludedPreviewItemIndexes={new Set()}
          loadedCount={5}
          totalCount={5}
          isImporting={false}
          error={null}
          onFileSelect={vi.fn()}
          onExcludeDuplicateTitlesChange={vi.fn()}
          onPreviewSearchQueryChange={vi.fn()}
          onShowAllPreviewItemsChange={vi.fn()}
          onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
          onShowOnlyIncludedPreviewItemsChange={vi.fn()}
          onExcludeAllPreviewItems={vi.fn()}
          onIncludePreviewItems={vi.fn()}
          onPreviewItemExclusionChange={vi.fn()}
          onClearPreviewItemExclusions={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      )

    const collapsedMarkup = renderPreview(false)
    expect(collapsedMarkup).toContain('先頭3件を表示中')
    expect(collapsedMarkup).toContain('aria-expanded="false"')
    expect(collapsedMarkup).toContain('残り2件を表示')
    expect(collapsedMarkup).not.toContain('4件目のToDo')
    expect(collapsedMarkup).not.toContain('5件目の重複ToDo')

    const expandedMarkup = renderPreview(true)
    expect(expandedMarkup).toContain('5件すべて表示中')
    expect(expandedMarkup).toContain('aria-expanded="true"')
    expect(expandedMarkup).toContain('先頭3件だけ表示')
    expect(expandedMarkup).toContain('4件目のToDo')
    expect(expandedMarkup).toContain('5件目の重複ToDo')
    expect(expandedMarkup.match(/todo-import-duplicate-badge/g)).toHaveLength(1)
  })

  it('shows duplicate candidates only without changing registration count', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{
          fileName: 'phoenix-todos.csv',
          items: [
            {
              title: '新しいToDo 1',
              description: '',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
            {
              title: '新しいToDo 2',
              description: '',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
            {
              title: '新しいToDo 3',
              description: '',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
            {
              title: '新しいToDo 4',
              description: '',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
            {
              title: '5件目の重複ToDo',
              description: '',
              dueDate: '',
              priority: 'high',
              category: '',
            },
          ],
        }}
        duplicateTitleIndexes={new Set([4])}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={5}
        totalCount={5}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).not.toContain('新しいToDo 1')
    expect(markup).not.toContain('新しいToDo 4')
    expect(markup).toContain('5件目の重複ToDo')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('CSVの全候補を表示')
    expect(markup).toContain(
      '重複候補1件だけを表示中です。登録対象は変わりません。',
    )
    expect(markup).toContain('>5件を登録する</button>')
    expect(markup).not.toContain('残り2件を表示')
  })

  it('updates the registration count for individually excluded CSV items', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{
          fileName: 'phoenix-todos.csv',
          items: [
            {
              title: '登録するToDo',
              description: '',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
            {
              title: '登録しないToDo',
              description: '',
              dueDate: '',
              priority: 'low',
              category: '',
            },
          ],
        }}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set([1])}
        loadedCount={2}
        totalCount={2}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('1件を登録しますか？')
    expect(markup).toContain('class="is-excluded"')
    expect(markup).toContain('aria-label="「登録しないToDo」を登録する"')
    expect(markup).toContain('>登録しない</span>')
    expect(markup).toContain('個別に1件を登録対象から外し、1件を登録します。')
    expect(markup).toContain('>個別除外をすべて戻す</button>')
    expect(markup).toContain('個別に外した候補以外を登録します。')
    expect(markup).toContain('>1件を登録する</button>')
  })

  it('shows every CSV item that remains a registration target', () => {
    const items = [
      {
        title: '登録しないToDo',
        description: '',
        dueDate: '',
        priority: 'low' as const,
        category: '',
      },
      ...[2, 3, 4, 5].map((number) => ({
        title: `${number}件目の登録対象ToDo`,
        description: '',
        dueDate: '',
        priority: 'medium' as const,
        category: '',
      })),
    ]
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{ fileName: 'phoenix-todos.csv', items }}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems
        excludedPreviewItemIndexes={new Set([0])}
        loadedCount={5}
        totalCount={5}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).not.toContain('登録しないToDo')
    expect(markup).toContain('2件目の登録対象ToDo')
    expect(markup).toContain('4件目の登録対象ToDo')
    expect(markup).toContain('5件目の登録対象ToDo')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('>CSVの全候補を表示</button>')
    expect(markup).toContain('登録対象4件だけを表示中です。')
    expect(markup).toContain('>4件を登録する</button>')
    expect(markup).not.toContain('残り2件を表示')
  })

  it('searches every CSV preview title without changing registration count', () => {
    const items = [
      '週次予定を確認',
      '共有資料を更新',
      '会議メモを整理',
      '連絡内容を確認',
      '来週の準備',
    ].map((title) => ({
      title,
      description: '',
      dueDate: '',
      priority: 'medium' as const,
      category: '',
    }))
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{ fileName: 'phoenix-todos.csv', items }}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery="連絡"
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={5}
        totalCount={5}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain(
      'aria-label="CSV候補をタイトル・説明・カテゴリで検索"',
    )
    expect(markup).toContain('type="search"')
    expect(markup).toContain('value="連絡"')
    expect(markup).toContain('連絡内容を確認')
    expect(markup).not.toContain('週次予定を確認')
    expect(markup).not.toContain('来週の準備')
    expect(markup).toContain(
      '「連絡」で1件を表示中です。登録対象は変わりません。',
    )
    expect(markup).toContain('>5件を登録する</button>')
    expect(markup).not.toContain('残り2件を表示')
  })

  it('finds a CSV candidate by its description', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{
          fileName: 'phoenix-todos.csv',
          items: [
            {
              title: '点検予定を確認する',
              description: '担当者へ連絡して手順を確認する',
              dueDate: '2026-08-12',
              priority: 'high',
              category: '確認',
            },
            {
              title: '資料を整理する',
              description: '保存場所を見直す',
              dueDate: '',
              priority: 'medium',
              category: '',
            },
          ],
        }}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery="担当者"
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={2}
        totalCount={2}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('value="担当者"')
    expect(markup).toContain('点検予定を確認する')
    expect(markup).not.toContain('資料を整理する')
    expect(markup).toContain(
      '「担当者」で1件を表示中です。登録対象は変わりません。',
    )
    expect(markup).toContain('>検索をクリア</button>')
    expect(markup).toContain('>2件を登録する</button>')
  })

  it('finds a CSV candidate by its category', () => {
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{
          fileName: 'phoenix-todos.csv',
          items: [
            {
              title: '点検予定を作成する',
              description: '来週の予定をまとめる',
              dueDate: '2026-08-12',
              priority: 'high',
              category: '設備',
            },
            {
              title: '資料を整理する',
              description: '保存場所を見直す',
              dueDate: '',
              priority: 'medium',
              category: '事務',
            },
          ],
        }}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery="設備"
        excludeDuplicateTitles={false}
        showAllPreviewItems={false}
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set()}
        loadedCount={2}
        totalCount={2}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('value="設備"')
    expect(markup).toContain('点検予定を作成する')
    expect(markup).not.toContain('資料を整理する')
    expect(markup).toContain(
      '「設備」で1件を表示中です。登録対象は変わりません。',
    )
    expect(markup).toContain('<dd>設備</dd>')
    expect(markup).toContain('>2件を登録する</button>')
  })

  it('restores searched CSV items to the registration target', () => {
    const items = [
      '週次予定を確認',
      '共有資料を更新',
      '会議メモを整理',
      '連絡内容を確認',
      '来週の準備',
    ].map((title) => ({
      title,
      description: '',
      dueDate: '',
      priority: 'medium' as const,
      category: '',
    }))
    const renderSearch = (excludedPreviewItemIndexes: ReadonlySet<number>) =>
      renderToStaticMarkup(
        <TodoCsvImportActions
          preview={{ fileName: 'phoenix-todos.csv', items }}
          duplicateTitleIndexes={new Set()}
          csvRepeatedTitleIndexes={new Set()}
          previewSearchQuery="連絡"
          excludeDuplicateTitles={false}
          showAllPreviewItems
          showOnlyDuplicatePreviewItems={false}
          showOnlyIncludedPreviewItems={false}
          excludedPreviewItemIndexes={excludedPreviewItemIndexes}
          loadedCount={5}
          totalCount={5}
          isImporting={false}
          error={null}
          onFileSelect={vi.fn()}
          onExcludeDuplicateTitlesChange={vi.fn()}
          onPreviewSearchQueryChange={vi.fn()}
          onShowAllPreviewItemsChange={vi.fn()}
          onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
          onShowOnlyIncludedPreviewItemsChange={vi.fn()}
          onExcludeAllPreviewItems={vi.fn()}
          onIncludePreviewItems={vi.fn()}
          onPreviewItemExclusionChange={vi.fn()}
          onClearPreviewItemExclusions={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      )

    const excludedMarkup = renderSearch(new Set([0, 1, 2, 3, 4]))
    expect(excludedMarkup).toContain('0件を登録しますか？')
    expect(excludedMarkup).toContain('>検索結果の1件を登録対象に戻す</button>')

    const restoredMarkup = renderSearch(new Set([0, 1, 2, 4]))
    expect(restoredMarkup).toContain('1件を登録しますか？')
    expect(restoredMarkup).toContain('検索結果の1件はすべて登録対象です。')
    expect(restoredMarkup).not.toContain('検索結果の1件を登録対象に戻す')
    expect(restoredMarkup).toContain('>1件を登録する</button>')
  })

  it('excludes searched CSV items from the registration target', () => {
    const items = [
      '週次予定を確認',
      '共有資料を更新',
      '会議メモを整理',
      '連絡内容を確認',
      '来週の準備',
    ].map((title) => ({
      title,
      description: '',
      dueDate: '',
      priority: 'medium' as const,
      category: '',
    }))
    const renderSearch = (excludedPreviewItemIndexes: ReadonlySet<number>) =>
      renderToStaticMarkup(
        <TodoCsvImportActions
          preview={{ fileName: 'phoenix-todos.csv', items }}
          duplicateTitleIndexes={new Set()}
          csvRepeatedTitleIndexes={new Set()}
          previewSearchQuery="連絡"
          excludeDuplicateTitles={false}
          showAllPreviewItems
          showOnlyDuplicatePreviewItems={false}
          showOnlyIncludedPreviewItems={false}
          excludedPreviewItemIndexes={excludedPreviewItemIndexes}
          loadedCount={5}
          totalCount={5}
          isImporting={false}
          error={null}
          onFileSelect={vi.fn()}
          onExcludeDuplicateTitlesChange={vi.fn()}
          onPreviewSearchQueryChange={vi.fn()}
          onShowAllPreviewItemsChange={vi.fn()}
          onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
          onShowOnlyIncludedPreviewItemsChange={vi.fn()}
          onExcludeAllPreviewItems={vi.fn()}
          onIncludePreviewItems={vi.fn()}
          onPreviewItemExclusionChange={vi.fn()}
          onClearPreviewItemExclusions={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      )

    const includedMarkup = renderSearch(new Set())
    expect(includedMarkup).toContain('5件を登録しますか？')
    expect(includedMarkup).toContain(
      '>検索結果の1件を登録対象から外す</button>',
    )

    const excludedMarkup = renderSearch(new Set([3]))
    expect(excludedMarkup).toContain('4件を登録しますか？')
    expect(excludedMarkup).toContain('>検索結果の1件を登録対象に戻す</button>')
    expect(excludedMarkup).not.toContain('検索結果の1件を登録対象から外す')
    expect(excludedMarkup).toContain('>4件を登録する</button>')
  })

  it('shows a reversible empty selection after excluding every CSV item', () => {
    const items = [1, 2, 3, 4, 5].map((number) => ({
      title: `${number}件目のCSV候補`,
      description: '',
      dueDate: '',
      priority: 'medium' as const,
      category: '',
    }))
    const markup = renderToStaticMarkup(
      <TodoCsvImportActions
        preview={{ fileName: 'phoenix-todos.csv', items }}
        duplicateTitleIndexes={new Set()}
        csvRepeatedTitleIndexes={new Set()}
        previewSearchQuery=""
        excludeDuplicateTitles={false}
        showAllPreviewItems
        showOnlyDuplicatePreviewItems={false}
        showOnlyIncludedPreviewItems={false}
        excludedPreviewItemIndexes={new Set([0, 1, 2, 3, 4])}
        loadedCount={5}
        totalCount={5}
        isImporting={false}
        error={null}
        onFileSelect={vi.fn()}
        onExcludeDuplicateTitlesChange={vi.fn()}
        onPreviewSearchQueryChange={vi.fn()}
        onShowAllPreviewItemsChange={vi.fn()}
        onShowOnlyDuplicatePreviewItemsChange={vi.fn()}
        onShowOnlyIncludedPreviewItemsChange={vi.fn()}
        onExcludeAllPreviewItems={vi.fn()}
        onIncludePreviewItems={vi.fn()}
        onPreviewItemExclusionChange={vi.fn()}
        onClearPreviewItemExclusions={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('0件を登録しますか？')
    expect(markup.match(/class="is-excluded"/g)).toHaveLength(5)
    expect(markup).not.toContain('checked=""')
    expect(markup).toContain(
      '全5件を登録対象から外しました。必要な候補はチェックを戻せます。',
    )
    expect(markup).toContain(
      'disabled="">全候補を登録対象から外しました</button>',
    )
    expect(markup).toContain('>個別除外をすべて戻す</button>')
    expect(markup).toContain('disabled="">登録対象がありません</button>')
  })
})

describe('TodoAttentionSummary', () => {
  it('counts only active overdue, today, and high-priority todos', () => {
    const overdueTodo = { ...todo, due_date: '2026-07-22' }
    const todayHighTodo = {
      ...todo,
      id: 'today-high',
      due_date: '2026-07-23',
    }
    const upcomingLowTodo = {
      ...todo,
      id: 'upcoming-low',
      due_date: '2026-07-24',
      priority: 'low' as const,
    }
    const completedHighTodo = {
      ...todo,
      id: 'completed-high',
      due_date: '2026-07-22',
      is_completed: true,
    }

    expect(
      getTodoAttentionCounts(
        [overdueTodo, todayHighTodo, upcomingLowTodo, completedHighTodo],
        '2026-07-23',
      ),
    ).toEqual({ overdue: 1, today: 1, highPriority: 2 })
  })

  it('renders three readable alert buttons and disables zero counts', () => {
    const markup = renderToStaticMarkup(
      <TodoAttentionSummary
        counts={{ overdue: 1, today: 0, highPriority: 2 }}
        onShowOverdue={vi.fn()}
        onShowToday={vi.fn()}
        onShowHighPriority={vi.fn()}
      />,
    )

    expect(markup).toContain('期限・優先度アラート')
    expect(markup).toContain('<strong>1件</strong><span>期限切れ</span>')
    expect(markup).toContain('<button type="button" class="today" disabled="">')
    expect(markup).toContain('<strong>2件</strong><span>優先度 高</span>')
    expect(markup).toContain('数字を押すと、未完了の該当ToDoだけを表示します。')
  })
})

describe('TodoProgressSummary', () => {
  it('calculates total, active, completed, and rounded completion rate', () => {
    const todos = [
      todo,
      { ...todo, id: 'active-two' },
      { ...todo, id: 'completed-one', is_completed: true },
    ]

    expect(getTodoProgressSummary(todos)).toEqual({
      total: 3,
      active: 2,
      completed: 1,
      completionRate: 33,
    })
    expect(getTodoProgressSummary([])).toEqual({
      total: 0,
      active: 0,
      completed: 0,
      completionRate: 0,
    })
  })

  it('renders progress and status buttons with accessible values', () => {
    const markup = renderToStaticMarkup(
      <TodoProgressSummary
        summary={{ total: 5, active: 3, completed: 2, completionRate: 40 }}
        onShowActive={vi.fn()}
        onShowCompleted={vi.fn()}
      />,
    )

    expect(markup).toContain('ToDo進捗')
    expect(markup).toContain('40% 完了')
    expect(markup).toContain('aria-label="ToDo完了率"')
    expect(markup).toContain('aria-valuenow="40"')
    expect(markup).toContain('style="width:40%"')
    expect(markup).toContain('<strong>3件</strong><span>未完了</span>')
    expect(markup).toContain('<strong>2件</strong><span>完了</span>')
    expect(markup).toContain('5件の進み具合です。')
  })
})

describe('ToDo search and status filters', () => {
  const completedTodo: Todo = {
    ...todo,
    id: '45e36285-21b9-4bc0-adb9-e5ae61d12a14',
    title: '月次レポートを作成',
    description: '投資記録を確認する',
    category: '資産',
    is_completed: true,
  }

  it('matches normalized title and description text', () => {
    const todos = [todo, completedTodo]

    expect(filterTodos(todos, 'ＰＨＯＥＮＩＸ', 'all')).toEqual([todo])
    expect(filterTodos(todos, '投資記録', 'all')).toEqual([completedTodo])
    expect(filterTodos(todos, '学習', 'all')).toEqual([todo])
  })

  it('filters completed and active todos independently', () => {
    const todos = [todo, completedTodo]

    expect(filterTodos(todos, '', 'active')).toEqual([todo])
    expect(filterTodos(todos, '', 'completed')).toEqual([completedTodo])
    expect(filterTodos(todos, '一致しない', 'all')).toEqual([])
  })

  it('counts only search, filter, and sort settings changed from defaults', () => {
    expect(
      getTodoViewChangeCount({
        query: '設備',
        statusFilter: 'active',
        dueFilter: 'overdue',
        priorityFilter: 'high',
        pinnedFilter: 'pinned',
        categoryFilter: 'category:%E5%AD%A6%E7%BF%92',
        sortOption: 'newest',
      }),
    ).toBe(7)
    expect(
      getTodoViewChangeCount({
        query: '   ',
        statusFilter: 'all',
        dueFilter: 'all',
        priorityFilter: 'all',
        pinnedFilter: 'all',
        categoryFilter: 'all',
        sortOption: 'due',
      }),
    ).toBe(0)
  })

  it('filters high, medium, and low priority with the other conditions', () => {
    const mediumTodo = {
      ...todo,
      id: 'medium',
      priority: 'medium' as const,
    }
    const lowTodo = {
      ...completedTodo,
      id: 'low',
      priority: 'low' as const,
    }
    const todos = [todo, mediumTodo, lowTodo]

    expect(filterTodos(todos, '', 'all', 'all', '2026-07-23', 'high')).toEqual([
      todo,
    ])
    expect(
      filterTodos(todos, '', 'active', 'all', '2026-07-23', 'medium'),
    ).toEqual([mediumTodo])
    expect(
      filterTodos(todos, '', 'active', 'all', '2026-07-23', 'low'),
    ).toEqual([])
  })

  it('filters pinned and unpinned todos while preserving other conditions', () => {
    const pinnedTodo = {
      ...todo,
      id: 'pinned-filter-target',
      is_pinned: true,
      priority: 'medium' as const,
    }
    const todos = [todo, pinnedTodo]

    expect(
      filterTodos(
        todos,
        '',
        'active',
        'all',
        '2026-07-23',
        'medium',
        'all',
        'pinned',
      ),
    ).toEqual([pinnedTodo])
    expect(
      filterTodos(
        todos,
        '',
        'active',
        'all',
        '2026-07-23',
        'high',
        'all',
        'unpinned',
      ),
    ).toEqual([todo])
  })

  it('builds unique category options and filters named or uncategorized todos', () => {
    const secondLearningTodo = {
      ...todo,
      id: 'second-learning',
      title: '学習計画を更新',
      priority: 'low' as const,
    }
    const assetTodo = {
      ...todo,
      id: 'asset',
      title: '資産計画を確認',
      category: '資産',
    }
    const uncategorizedTodo = {
      ...todo,
      id: 'uncategorized',
      title: '分類前',
      category: null,
    }
    const todos = [todo, secondLearningTodo, assetTodo, uncategorizedTodo]
    const options = getTodoCategoryFilterOptions(todos)

    expect(options.map((option) => option.label)).toEqual([
      'すべて',
      'カテゴリなし',
      '学習',
      '資産',
    ])
    expect(
      filterTodos(
        todos,
        '',
        'all',
        'all',
        '2026-07-23',
        'all',
        options[2].value,
      ),
    ).toEqual([todo, secondLearningTodo])
    expect(
      filterTodos(
        todos,
        '学習計画',
        'active',
        'all',
        '2026-07-23',
        'low',
        options[2].value,
      ),
    ).toEqual([secondLearningTodo])
    expect(
      filterTodos(
        todos,
        '',
        'all',
        'all',
        '2026-07-23',
        'all',
        'uncategorized',
      ),
    ).toEqual([uncategorizedTodo])
  })

  it('classifies and filters active todos by their due date', () => {
    const overdueTodo = { ...todo, due_date: '2026-07-22' }
    const todayTodo = { ...todo, id: 'today', due_date: '2026-07-23' }
    const upcomingTodo = { ...todo, id: 'upcoming', due_date: '2026-07-24' }
    const sevenDaysLaterTodo = {
      ...todo,
      id: 'seven-days-later',
      due_date: '2026-07-30',
    }
    const eightDaysLaterTodo = {
      ...todo,
      id: 'eight-days-later',
      due_date: '2026-07-31',
    }
    const noDueTodo = { ...todo, id: 'none', due_date: null }
    const todos = [
      overdueTodo,
      todayTodo,
      upcomingTodo,
      sevenDaysLaterTodo,
      eightDaysLaterTodo,
      noDueTodo,
      completedTodo,
    ]

    expect(getTodoDueState(overdueTodo, '2026-07-23')).toBe('overdue')
    expect(getTodoDueState(todayTodo, '2026-07-23')).toBe('today')
    expect(getTodoDueState(upcomingTodo, '2026-07-23')).toBe('upcoming')
    expect(getTodoDueState(noDueTodo, '2026-07-23')).toBe('none')
    expect(getTodoDueState(completedTodo, '2026-07-23')).toBe('completed')
    expect(filterTodos(todos, '', 'all', 'overdue', '2026-07-23')).toEqual([
      overdueTodo,
    ])
    expect(filterTodos(todos, '', 'all', 'today', '2026-07-23')).toEqual([
      todayTodo,
    ])
    expect(filterTodos(todos, '', 'all', 'next7days', '2026-07-23')).toEqual([
      todayTodo,
      upcomingTodo,
      sevenDaysLaterTodo,
    ])
    expect(filterTodos(todos, '', 'active', 'none', '2026-07-23')).toEqual([
      noDueTodo,
    ])
    expect(
      filterTodos(todos, '', 'completed', 'overdue', '2026-07-23'),
    ).toEqual([])
  })

  it('formats the browser local date without a UTC conversion', () => {
    expect(getLocalDateString(new Date(2026, 6, 3, 0, 15))).toBe('2026-07-03')
    expect(formatTodoUpdatedAt('2026-08-03T20:15:00')).toBe(
      '2026年8月3日 20:15',
    )
    expect(formatTodoUpdatedAt('invalid')).toBe('日時不明')
  })

  it('sorts todos by due date, newest, and oldest without mutating input', () => {
    const oldestTodo = {
      ...todo,
      id: 'oldest',
      title: '最初に登録',
      due_date: null,
      priority: 'low' as const,
      created_at: '2026-07-20T00:00:00Z',
    }
    const newestTodo = {
      ...todo,
      id: 'newest',
      title: '最後に登録',
      due_date: '2026-07-25',
      priority: 'medium' as const,
      created_at: '2026-07-24T00:00:00Z',
    }
    const completedWithEarlierDueDate = {
      ...todo,
      id: 'completed',
      title: '完了済み',
      due_date: '2026-07-21',
      priority: 'high' as const,
      is_completed: true,
      created_at: '2026-07-21T00:00:00Z',
    }
    const todos = [oldestTodo, newestTodo, completedWithEarlierDueDate]

    expect(sortTodos(todos, 'due').map((item) => item.id)).toEqual([
      'newest',
      'oldest',
      'completed',
    ])
    expect(sortTodos(todos, 'newest').map((item) => item.id)).toEqual([
      'newest',
      'completed',
      'oldest',
    ])
    expect(sortTodos(todos, 'oldest').map((item) => item.id)).toEqual([
      'oldest',
      'completed',
      'newest',
    ])
    expect(todos.map((item) => item.id)).toEqual([
      'oldest',
      'newest',
      'completed',
    ])
  })

  it('sorts active todos by high, medium, and low priority before completed items', () => {
    const highTodo = { ...todo, id: 'high', priority: 'high' as const }
    const mediumTodo = { ...todo, id: 'medium', priority: 'medium' as const }
    const lowTodo = { ...todo, id: 'low', priority: 'low' as const }
    const completedHighTodo = {
      ...todo,
      id: 'completed-high',
      priority: 'high' as const,
      is_completed: true,
    }

    expect(
      sortTodos(
        [lowTodo, completedHighTodo, mediumTodo, highTodo],
        'priority',
      ).map((item) => item.id),
    ).toEqual(['high', 'medium', 'low', 'completed-high'])
  })

  it('sorts the most recently updated Todo first without mutating input', () => {
    const oldestUpdate = {
      ...todo,
      id: 'oldest-update',
      updated_at: '2026-08-03T18:00:00Z',
    }
    const newestUpdate = {
      ...todo,
      id: 'newest-update',
      updated_at: '2026-08-03T20:30:00Z',
    }
    const middleUpdate = {
      ...todo,
      id: 'middle-update',
      updated_at: '2026-08-03T19:15:00Z',
    }
    const todos = [oldestUpdate, newestUpdate, middleUpdate]

    expect(sortTodos(todos, 'updated').map((item) => item.id)).toEqual([
      'newest-update',
      'middle-update',
      'oldest-update',
    ])
    expect(todos.map((item) => item.id)).toEqual([
      'oldest-update',
      'newest-update',
      'middle-update',
    ])
  })

  it('keeps a pinned Todo first for every sort option', () => {
    const pinnedTodo = {
      ...todo,
      id: 'pinned',
      is_pinned: true,
      due_date: null,
      priority: 'low' as const,
      created_at: '2026-07-20T00:00:00Z',
      updated_at: '2026-07-20T00:00:00Z',
    }
    const normalTodo = {
      ...todo,
      id: 'normal',
      due_date: '2026-07-21',
      priority: 'high' as const,
      created_at: '2026-08-03T00:00:00Z',
      updated_at: '2026-08-03T00:00:00Z',
    }

    for (const option of [
      'due',
      'priority',
      'updated',
      'newest',
      'oldest',
    ] as const) {
      expect(sortTodos([normalTodo, pinnedTodo], option)[0]?.id).toBe('pinned')
    }
  })

  it('renders an accessible search, filters, count, and clear action', () => {
    const markup = renderToStaticMarkup(
      <TodoFilterControls
        query="設備"
        statusFilter="active"
        dueFilter="overdue"
        priorityFilter="medium"
        pinnedFilter="unpinned"
        pinnedCount={1}
        categoryFilter="category:%E5%AD%A6%E7%BF%92"
        categoryFilterOptions={[
          { value: 'all', label: 'すべて' },
          { value: 'uncategorized', label: 'カテゴリなし' },
          {
            value: 'category:%E5%AD%A6%E7%BF%92',
            label: '学習',
          },
        ]}
        sortOption="newest"
        visibleCount={1}
        loadedCount={2}
        activeViewChangeCount={7}
        onQueryChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onDueFilterChange={vi.fn()}
        onPriorityFilterChange={vi.fn()}
        onPinnedFilterChange={vi.fn()}
        onCategoryFilterChange={vi.fn()}
        onSortOptionChange={vi.fn()}
        onResetView={vi.fn()}
      />,
    )

    expect(markup).toContain('id="todo-search"')
    expect(markup).toContain('タイトル・説明・カテゴリを検索')
    expect(markup).toContain('aria-label="状態で絞り込む"')
    expect(markup).toContain('aria-label="期限で絞り込む"')
    expect(markup).toContain('aria-label="優先度で絞り込む"')
    expect(markup).toContain('aria-label="固定状態で絞り込む"')
    expect(markup).toContain('aria-label="カテゴリで絞り込む"')
    expect(markup).toContain('aria-pressed="true">未完了')
    expect(markup).toContain('aria-pressed="true">期限切れ')
    expect(markup).toContain('>7日以内</button>')
    expect(markup).toContain('aria-pressed="true">中')
    expect(markup).toContain('>固定中（1）</button>')
    expect(markup).toContain('aria-pressed="true">通常（1）')
    expect(markup).toContain('aria-pressed="true">学習')
    expect(markup).toContain('id="todo-sort"')
    expect(markup).toContain('<option value="priority">優先度が高い順')
    expect(markup).toContain('<option value="updated">最近更新した順')
    expect(markup).toContain('<option value="newest" selected="">新しい順')
    expect(markup).toContain('2件中 1件を表示')
    expect(markup).toContain('条件をリセット（7）')
    expect(markup).toContain('>クリア</button>')
    expect(markup).toContain(
      '表示条件はこの端末に自動保存されます（検索語を除く）。',
    )
  })

  it('disables reset when the default view is already active', () => {
    const markup = renderToStaticMarkup(
      <TodoFilterControls
        query=""
        statusFilter="all"
        dueFilter="all"
        priorityFilter="all"
        pinnedFilter="all"
        pinnedCount={0}
        categoryFilter="all"
        categoryFilterOptions={[
          { value: 'all', label: 'すべて' },
          { value: 'uncategorized', label: 'カテゴリなし' },
        ]}
        sortOption="due"
        visibleCount={2}
        loadedCount={2}
        activeViewChangeCount={0}
        onQueryChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onDueFilterChange={vi.fn()}
        onPriorityFilterChange={vi.fn()}
        onPinnedFilterChange={vi.fn()}
        onCategoryFilterChange={vi.fn()}
        onSortOptionChange={vi.fn()}
        onResetView={vi.fn()}
      />,
    )

    expect(markup).toContain(
      '<button type="button" class="todo-filter-reset" disabled="">条件をリセット</button>',
    )
  })
})

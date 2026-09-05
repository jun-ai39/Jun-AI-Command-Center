import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Todo } from '../types'
import {
  READY_EQUIPMENT_OPTIONS,
  TEST_EQUIPMENT_ID,
} from '../../work-reports/testFixtures'
import { TodayMaintenanceContent } from './TodayMaintenancePanel'

const todayTodo: Todo = {
  id: 'a48af9d2-e26c-469f-bbeb-2d99ffbd15c2',
  title: '包装機の日常整備',
  description: null,
  due_date: '2026-08-22',
  priority: 'high',
  category: '保全',
  equipment_id: TEST_EQUIPMENT_ID,
  is_pinned: false,
  is_completed: false,
  is_archived: false,
  created_at: '2026-08-20T15:00:00Z',
  updated_at: '2026-08-20T15:00:00Z',
}

const overdueTodo: Todo = {
  ...todayTodo,
  id: '7aa91dc1-a532-4e65-9953-19943c31e1d8',
  title: 'コンベアーの給油',
  due_date: '2026-08-21',
  priority: 'medium',
}

describe('TodayMaintenanceContent', () => {
  it('separates today and overdue work with direct completion controls', () => {
    const markup = renderToStaticMarkup(
      <TodayMaintenanceContent
        targetDate="2026-08-22"
        state={{
          phase: 'ready',
          data: {
            target_date: '2026-08-22',
            today_items: [todayTodo],
            overdue_items: [overdueTodo],
          },
        }}
        mutatingTodoIds={new Set([todayTodo.id])}
        mutationError={null}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onComplete={vi.fn()}
        onReload={vi.fn()}
        onOpenScheduleManagement={vi.fn()}
      />,
    )

    expect(markup).toContain('MANAGE / STEP 101')
    expect(markup).toContain('今日の保全予定')
    expect(markup).toContain('要実施 2件')
    expect(markup).toContain('コンベアーの給油')
    expect(markup).toContain('包装機の日常整備')
    expect(markup).toContain('期限超過')
    expect(markup).toContain('本日期限')
    expect(markup).toContain('優先度 高・期限 2026年8月22日')
    expect(markup).toContain('対象設備：菓子パン / 包装機 No.2')
    expect(markup).toContain('包装機の日常整備を完了にする')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('class="today-maintenance-manage-link"')
    expect(markup).toContain('保全予定の登録・詳細管理へ')
  })

  it('shows a clear state when no work is due', () => {
    const markup = renderToStaticMarkup(
      <TodayMaintenanceContent
        targetDate="2026-08-22"
        state={{
          phase: 'ready',
          data: {
            target_date: '2026-08-22',
            today_items: [],
            overdue_items: [],
          },
        }}
        mutatingTodoIds={new Set()}
        mutationError={null}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onComplete={vi.fn()}
        onReload={vi.fn()}
        onOpenScheduleManagement={vi.fn()}
      />,
    )

    expect(markup).toContain('予定なし')
    expect(markup).toContain('期限を過ぎた予定はありません。')
    expect(markup).toContain('本日期限の予定はありません。')
    expect(markup).toContain('今日までに実施する未完了予定はありません。')
  })

  it('keeps normal work visible without an administrator management link', () => {
    const markup = renderToStaticMarkup(
      <TodayMaintenanceContent
        targetDate="2026-08-22"
        state={{
          phase: 'ready',
          data: {
            target_date: '2026-08-22',
            today_items: [todayTodo],
            overdue_items: [],
          },
        }}
        mutatingTodoIds={new Set()}
        mutationError={null}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onComplete={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(markup).toContain('今日の保全予定')
    expect(markup).toContain('包装機の日常整備を完了にする')
    expect(markup).not.toContain('保全予定の登録・詳細管理へ')
  })

  it('provides recovery after a loading failure', () => {
    const markup = renderToStaticMarkup(
      <TodayMaintenanceContent
        targetDate="2026-08-22"
        state={{ phase: 'error' }}
        mutatingTodoIds={new Set()}
        mutationError={null}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onComplete={vi.fn()}
        onReload={vi.fn()}
        onOpenScheduleManagement={vi.fn()}
      />,
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('今日の保全予定を読み込めませんでした。')
    expect(markup).toContain('もう一度読み込む')
  })
})

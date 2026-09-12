import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { WorkReport } from '../types'
import {
  READY_EQUIPMENT_OPTIONS,
  TEST_DEPARTMENT_ID,
  TEST_EQUIPMENT_ID,
} from '../testFixtures'
import {
  WorkReportHistoryList,
  WorkReportHistoryPanel,
} from './WorkReportHistoryPanel'

const report: WorkReport = {
  id: '9b73f331-d416-41c8-b5e2-6f3e53b7ac31',
  work_date: '2026-08-21',
  department_id: TEST_DEPARTMENT_ID,
  equipment_id: TEST_EQUIPMENT_ID,
  department_name: '菓子パン',
  equipment_name: '包装機',
  equipment_number: 'No.2',
  phenomenon: '搬送部から異音',
  cause: null,
  work_content: '安全な範囲で外観を確認',
  progress: 'follow_up',
  is_legacy: false,
  legacy_category: null,
  legacy_work_hours: null,
  legacy_notes: null,
  created_at: '2026-08-21T01:00:00+00:00',
  updated_at: '2026-08-21T01:00:00+00:00',
}

describe('WorkReportHistoryList', () => {
  it('shows the Ver.1.0 report details and counts', () => {
    const markup = renderToStaticMarkup(
      <WorkReportHistoryList items={[report]} total={7} />,
    )
    expect(markup).toContain('保存済み合計 <strong>7件</strong>')
    expect(markup).toContain('搬送部から異音')
    expect(markup).toContain('原因</dt><dd>未特定')
    expect(markup).toContain('安全な範囲で外観を確認')
    expect(markup).toContain('経過確認')
    expect(markup).not.toContain('旧形式の詳細を表示')
  })

  it('labels one combined basic and detailed search result', () => {
    const markup = renderToStaticMarkup(
      <WorkReportHistoryList
        items={[report]}
        total={3}
        activeFilterLabels={[
          '2026年8月21日',
          '菓子パン',
          '作業内容「外観」',
          '経過確認',
        ]}
      />,
    )
    expect(markup).toContain(
      '2026年8月21日・菓子パン・作業内容「外観」・経過確認の検索結果',
    )
    expect(markup).toContain('残り <strong>2件</strong>')
  })

  it('keeps former fields only inside legacy details', () => {
    const markup = renderToStaticMarkup(
      <WorkReportHistoryList
        items={[
          {
            ...report,
            phenomenon: null,
            is_legacy: true,
            legacy_category: 'maintenance',
            legacy_work_hours: 1.5,
            legacy_notes: '架空部品の入荷待ち',
          },
        ]}
        total={1}
      />,
    )
    expect(markup).toContain('旧形式日報（現象・原因は未登録）')
    expect(markup).toContain('旧形式の詳細を表示')
    expect(markup).toContain('カテゴリ：整備・修理')
    expect(markup).toContain('作業時間：1.5時間')
    expect(markup).toContain('備考：架空部品の入荷待ち')
  })

  it('shows the edit action when editing is enabled', () => {
    const markup = renderToStaticMarkup(
      <WorkReportHistoryList items={[report]} total={1} onEdit={vi.fn()} />,
    )
    expect(markup).toContain('この日報を編集')
  })
})

describe('WorkReportHistoryPanel', () => {
  it('shows one basic search with progress kept under detailed conditions', () => {
    const markup = renderToStaticMarkup(
      <WorkReportHistoryPanel
        refreshToken={0}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onReloadEquipmentOptions={vi.fn()}
      />,
    )
    expect(markup).toContain('MANAGE / HISTORY')
    expect(markup).toContain('履歴を探す')
    expect(markup).toContain('id="work-report-history-date"')
    expect(markup).toContain('id="work-report-history-department"')
    expect(markup).toContain('id="work-report-history-content"')
    expect(markup).toContain('id="work-report-history-progress"')
    expect(markup).toContain(
      '作業日・部門・作業内容を自由に組み合わせて検索できます。',
    )
    expect(markup).toContain('詳細条件（進捗）')
    expect(markup).toContain('この条件で検索')
    expect(markup).toContain('条件をすべて解除')
    expect(markup).toContain('要対応の日報')
    expect(markup).toContain('要対応の日報件数を読み込んでいます')
    expect(markup).toContain('tabindex="-1"')
    expect(markup).not.toContain('カテゴリで日報を絞り込み')
  })

  it('keeps the remaining search fields usable when department loading fails', () => {
    const markup = renderToStaticMarkup(
      <WorkReportHistoryPanel
        refreshToken={0}
        equipmentOptionsState={{ phase: 'error' }}
        onReloadEquipmentOptions={vi.fn()}
      />,
    )

    expect(markup).toContain('部門を読み込めませんでした。')
    expect(markup).toContain('部門を再読み込み')
    expect(markup).toContain('id="work-report-history-department"')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('id="work-report-history-content"')
  })

  it('shows only the attention summary before an attention status is selected', () => {
    const markup = renderToStaticMarkup(
      <WorkReportHistoryPanel
        refreshToken={0}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onReloadEquipmentOptions={vi.fn()}
        mode="attention"
      />,
    )

    expect(markup).toContain('id="work-report-attention-screen-title"')
    expect(markup).toContain('要対応の日報')
    expect(markup).toContain('継続対応・経過確認')
    expect(markup).toContain('ここに対象日報を表示します')
    expect(markup).not.toContain('id="work-report-history-date"')
    expect(markup).not.toContain('最新の日報を読み込んでいます')
  })

  it('keeps the attention summary out of the dedicated history search screen', () => {
    const markup = renderToStaticMarkup(
      <WorkReportHistoryPanel
        refreshToken={0}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onReloadEquipmentOptions={vi.fn()}
        mode="search"
      />,
    )

    expect(markup).toContain('id="work-report-history-title"')
    expect(markup).toContain('id="work-report-history-date"')
    expect(markup).toContain('最新の日報を読み込んでいます')
    expect(markup).not.toContain('要対応の日報件数を読み込んでいます')
  })
})

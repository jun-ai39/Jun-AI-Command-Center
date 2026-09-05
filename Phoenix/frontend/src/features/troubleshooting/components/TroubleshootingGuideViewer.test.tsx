import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type {
  TroubleshootingGuide,
  TroubleshootingGuideSummary,
} from '../types'
import { TroubleshootingGuideViewer } from './TroubleshootingGuideViewer'

const questionId = '71000000-0000-4000-8000-000000000001'
const completeId = '71000000-0000-4000-8000-000000000002'
const handoffId = '71000000-0000-4000-8000-000000000003'

const summary: TroubleshootingGuideSummary = {
  id: '70000000-0000-4000-8000-000000000001',
  equipment_id: '30000000-0000-4000-8000-000000000001',
  symptom: 'コンベアーが動かない',
  start_step_id: questionId,
  display_order: 10,
  is_active: true,
  created_at: '2026-08-25T01:00:00+00:00',
  updated_at: '2026-08-25T01:00:00+00:00',
}

const guide: TroubleshootingGuide = {
  ...summary,
  steps: [
    {
      step_id: questionId,
      step_type: 'question',
      prompt: '運転スイッチは入っていますか？',
      check_method: '操作盤の外側から表示を確認する',
      caution_note: '盤を開けない',
    },
    {
      step_id: completeId,
      step_type: 'complete',
      prompt: '運転担当者へ状態を共有してください。',
      check_method: null,
      caution_note: null,
    },
    {
      step_id: handoffId,
      step_type: 'handoff',
      prompt: '経験者へ引き継いでください。',
      check_method: null,
      caution_note: '会社の安全手順を優先する',
    },
  ],
  branches: [
    {
      branch_id: '72000000-0000-4000-8000-000000000001',
      from_step_id: questionId,
      answer: 'yes',
      to_step_id: completeId,
    },
    {
      branch_id: '72000000-0000-4000-8000-000000000002',
      from_step_id: questionId,
      answer: 'no',
      to_step_id: handoffId,
    },
    {
      branch_id: '72000000-0000-4000-8000-000000000003',
      from_step_id: questionId,
      answer: 'unknown',
      to_step_id: handoffId,
    },
  ],
}

const actions = {
  onReloadList: vi.fn(),
  onSelectGuide: vi.fn(),
  onClearGuide: vi.fn(),
}

describe('TroubleshootingGuideViewer', () => {
  it('shows a simple symptom list before starting a guide', () => {
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideViewer
        {...actions}
        listState={{ phase: 'ready', items: [summary], total: 1 }}
        detailState={{ phase: 'idle' }}
      />,
    )

    expect(markup).toContain('GUIDE / STEP 112')
    expect(markup).toContain('トラブルシューティング')
    expect(markup).toContain('利用できる症状 1件')
    expect(markup).toContain('発生している症状を選んでください')
    expect(markup).toContain('コンベアーが動かない')
    expect(markup).toContain('確認を始める')
  })

  it('shows only the current question and its three answers', () => {
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideViewer
        {...actions}
        onStartWorkReport={vi.fn()}
        listState={{ phase: 'ready', items: [summary], total: 1 }}
        detailState={{ phase: 'ready', guide }}
      />,
    )

    expect(markup).toContain('確認 1')
    expect(markup).toContain('運転スイッチは入っていますか？')
    expect(markup).toContain('操作盤の外側から表示を確認する')
    expect(markup).toContain('盤を開けない')
    expect(markup).toContain('YES')
    expect(markup).toContain('NO')
    expect(markup).toContain('不明・判断できない')
    expect(markup).toContain('最初から確認')
    expect(markup).toContain('症状一覧へ戻る')
    expect(markup).not.toContain('経験者へ引き継いでください。')
    expect(markup).not.toContain('この内容で作業日報を入力')
  })

  it('offers a work-report handoff only at a terminal step', () => {
    const terminalGuide: TroubleshootingGuide = {
      ...guide,
      start_step_id: completeId,
    }
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideViewer
        {...actions}
        onStartWorkReport={vi.fn()}
        listState={{ phase: 'ready', items: [summary], total: 1 }}
        detailState={{ phase: 'ready', guide: terminalGuide }}
      />,
    )

    expect(markup).toContain('確認完了')
    expect(markup).toContain('この内容で作業日報を入力')
  })

  it('shows independent loading, empty, and list failure states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <TroubleshootingGuideViewer
        {...actions}
        listState={{ phase: 'loading' }}
        detailState={{ phase: 'idle' }}
      />,
    )
    const emptyMarkup = renderToStaticMarkup(
      <TroubleshootingGuideViewer
        {...actions}
        listState={{ phase: 'ready', items: [], total: 0 }}
        detailState={{ phase: 'idle' }}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <TroubleshootingGuideViewer
        {...actions}
        listState={{ phase: 'error' }}
        detailState={{ phase: 'idle' }}
      />,
    )

    expect(loadingMarkup).toContain('トラブル対応ガイドを読み込んでいます')
    expect(emptyMarkup).toContain(
      'この設備のトラブル対応ガイドはまだ登録されていません',
    )
    expect(errorMarkup).toContain('トラブル対応ガイドを読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })

  it('shows recovery actions when one selected guide fails', () => {
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideViewer
        {...actions}
        listState={{ phase: 'ready', items: [summary], total: 1 }}
        detailState={{ phase: 'error', guideId: summary.id }}
      />,
    )

    expect(markup).toContain('選択したガイドを読み込めませんでした')
    expect(markup).toContain('もう一度読み込む')
    expect(markup).toContain('症状一覧へ戻る')
  })
})

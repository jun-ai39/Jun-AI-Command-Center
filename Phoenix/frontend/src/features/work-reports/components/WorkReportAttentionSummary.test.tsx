import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { WorkReportAttentionSummary } from './WorkReportAttentionSummary'

describe('WorkReportAttentionSummary', () => {
  it('shows total, continued, and follow-up counts', () => {
    const markup = renderToStaticMarkup(
      <WorkReportAttentionSummary
        state={{
          phase: 'ready',
          summary: {
            continued_count: 2,
            follow_up_count: 1,
            attention_count: 3,
          },
        }}
        activeProgress="continued"
        onReload={vi.fn()}
        onSelectProgress={vi.fn()}
      />,
    )

    expect(markup).toContain('要対応の日報')
    expect(markup).toContain('保存済み全日報を対象')
    expect(markup).toContain('要対応合計</dt><dd>3件')
    expect(markup).toContain('継続対応</dt><dd><button')
    expect(markup).toContain('継続対応 2件を履歴で確認')
    expect(markup).toContain('経過確認 1件を履歴で確認')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('対象日報を見る')
    expect(markup).toContain('要対応件数を更新')
  })

  it('disables a progress action when there are no matching reports', () => {
    const markup = renderToStaticMarkup(
      <WorkReportAttentionSummary
        state={{
          phase: 'ready',
          summary: {
            continued_count: 0,
            follow_up_count: 1,
            attention_count: 1,
          },
        }}
        activeProgress={null}
        onReload={vi.fn()}
        onSelectProgress={vi.fn()}
      />,
    )

    expect(markup).toContain(
      'disabled="" aria-pressed="false" aria-label="継続対応 0件を履歴で確認"',
    )
    expect(markup).toContain('対象なし')
  })

  it('shows a retry action when loading the summary fails', () => {
    const markup = renderToStaticMarkup(
      <WorkReportAttentionSummary
        state={{ phase: 'error' }}
        activeProgress={null}
        onReload={vi.fn()}
        onSelectProgress={vi.fn()}
      />,
    )

    expect(markup).toContain('件数を読み込めませんでした')
    expect(markup).toContain('件数をもう一度読み込む')
    expect(markup).toContain('role="alert"')
  })
})

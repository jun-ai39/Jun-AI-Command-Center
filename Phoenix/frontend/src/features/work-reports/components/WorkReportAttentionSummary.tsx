import type {
  WorkReportAttentionProgress,
  WorkReportAttentionSummaryState,
} from '../types'
import './WorkReportAttentionSummary.css'

type WorkReportAttentionSummaryProps = {
  readonly state: WorkReportAttentionSummaryState
  readonly activeProgress: WorkReportAttentionProgress | null
  readonly onReload: () => void
  readonly onSelectProgress: (progress: WorkReportAttentionProgress) => void
}

export function WorkReportAttentionSummary({
  state,
  activeProgress,
  onReload,
  onSelectProgress,
}: WorkReportAttentionSummaryProps) {
  return (
    <section
      className="work-report-attention-summary"
      aria-labelledby="work-report-attention-summary-title"
      aria-live="polite"
    >
      <div className="work-report-attention-summary-heading">
        <div>
          <p className="eyebrow">ATTENTION SUMMARY</p>
          <h3 id="work-report-attention-summary-title">要対応の日報</h3>
          <p>保存済み全日報を対象に集計します。</p>
        </div>
        <button
          className="work-report-attention-summary-refresh"
          type="button"
          disabled={state.phase === 'loading'}
          onClick={onReload}
        >
          要対応件数を更新
        </button>
      </div>

      {state.phase === 'loading' && (
        <p className="work-report-attention-summary-state" role="status">
          要対応の日報件数を読み込んでいます…
        </p>
      )}
      {state.phase === 'error' && (
        <div
          className="work-report-attention-summary-state is-error"
          role="alert"
        >
          <p>件数を読み込めませんでした。Phoenix APIを確認してください。</p>
          <button
            className="work-report-attention-summary-refresh"
            type="button"
            onClick={onReload}
          >
            件数をもう一度読み込む
          </button>
        </div>
      )}
      {state.phase === 'ready' && (
        <dl className="work-report-attention-summary-counts">
          <div className="is-total">
            <dt>要対応合計</dt>
            <dd>{state.summary.attention_count}件</dd>
          </div>
          <div
            className={
              activeProgress === 'continued' ? 'is-selected' : undefined
            }
          >
            <dt>継続対応</dt>
            <dd>
              <button
                className="work-report-attention-summary-action"
                type="button"
                disabled={state.summary.continued_count === 0}
                aria-pressed={activeProgress === 'continued'}
                aria-label={`継続対応 ${state.summary.continued_count}件を履歴で確認`}
                onClick={() => onSelectProgress('continued')}
              >
                <strong>{state.summary.continued_count}件</strong>
                <small>
                  {state.summary.continued_count === 0
                    ? '対象なし'
                    : '対象日報を見る'}
                </small>
              </button>
            </dd>
          </div>
          <div
            className={
              activeProgress === 'follow_up' ? 'is-selected' : undefined
            }
          >
            <dt>経過確認</dt>
            <dd>
              <button
                className="work-report-attention-summary-action"
                type="button"
                disabled={state.summary.follow_up_count === 0}
                aria-pressed={activeProgress === 'follow_up'}
                aria-label={`経過確認 ${state.summary.follow_up_count}件を履歴で確認`}
                onClick={() => onSelectProgress('follow_up')}
              >
                <strong>{state.summary.follow_up_count}件</strong>
                <small>
                  {state.summary.follow_up_count === 0
                    ? '対象なし'
                    : '対象日報を見る'}
                </small>
              </button>
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}

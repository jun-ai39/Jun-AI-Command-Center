import { useState } from 'react'

import {
  advanceTroubleshootingFlow,
  getTroubleshootingStep,
  startTroubleshootingFlow,
} from '../troubleshootingFlow'
import type {
  TroubleshootingAnswer,
  TroubleshootingGuide,
  TroubleshootingGuideDetailState,
  TroubleshootingGuideListState,
} from '../types'
import './TroubleshootingGuideViewer.css'

type TroubleshootingGuideViewerProps = {
  readonly listState: TroubleshootingGuideListState
  readonly detailState: TroubleshootingGuideDetailState
  readonly onReloadList: () => void
  readonly onSelectGuide: (guideId: string) => void
  readonly onClearGuide: () => void
  readonly onStartWorkReport?: (guide: TroubleshootingGuide) => void
}

type ActiveGuideProps = {
  readonly guide: TroubleshootingGuide
  readonly onReturnToList: () => void
  readonly onStartWorkReport?: (guide: TroubleshootingGuide) => void
}

const ANSWER_OPTIONS: readonly {
  readonly value: TroubleshootingAnswer
  readonly label: string
}[] = [
  { value: 'yes', label: 'YES' },
  { value: 'no', label: 'NO' },
  { value: 'unknown', label: '不明・判断できない' },
]

function ActiveGuide({
  guide,
  onReturnToList,
  onStartWorkReport,
}: ActiveGuideProps) {
  const [flow, setFlow] = useState(() => startTroubleshootingFlow(guide))
  const [flowError, setFlowError] = useState(false)
  const step = getTroubleshootingStep(guide, flow.currentStepId)

  const restart = () => {
    setFlow(startTroubleshootingFlow(guide))
    setFlowError(false)
  }

  const answer = (selectedAnswer: TroubleshootingAnswer) => {
    const nextFlow = advanceTroubleshootingFlow(guide, flow, selectedAnswer)
    if (!nextFlow) {
      setFlowError(true)
      return
    }
    setFlow(nextFlow)
  }

  if (!step || flowError) {
    return (
      <div className="troubleshooting-flow-error" role="alert">
        <strong>このガイドを続けられません。</strong>
        <p>操作を止め、経験者へ引き継いでください。</p>
        <button type="button" onClick={onReturnToList}>
          症状一覧へ戻る
        </button>
      </div>
    )
  }

  const isQuestion = step.step_type === 'question'
  const isHandoff = step.step_type === 'handoff'
  return (
    <div
      className={`troubleshooting-flow-step ${isQuestion ? 'is-question' : isHandoff ? 'is-handoff' : 'is-complete'}`}
    >
      <div className="troubleshooting-flow-status">
        <span>
          {isQuestion
            ? `確認 ${flow.answeredCount + 1}`
            : isHandoff
              ? '引継ぎ'
              : '確認完了'}
        </span>
        <small>症状：{guide.symptom}</small>
      </div>
      <h5>{step.prompt}</h5>
      {step.check_method && (
        <div className="troubleshooting-check-method">
          <strong>確認方法</strong>
          <p>{step.check_method}</p>
        </div>
      )}
      {step.caution_note && (
        <div className="troubleshooting-caution">
          <strong>注意・安全境界</strong>
          <p>{step.caution_note}</p>
        </div>
      )}
      {isQuestion ? (
        <div className="troubleshooting-answer-buttons">
          {ANSWER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === 'unknown' ? 'is-unknown' : ''}
              onClick={() => answer(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="troubleshooting-terminal-note">
          {isHandoff
            ? 'これ以上は進めず、表示内容と確認結果を経験者へ伝えてください。'
            : '安全な確認範囲はここまでです。必要に応じて結果を関係者へ共有してください。'}
        </p>
      )}
      {!isQuestion && onStartWorkReport && (
        <button
          className="troubleshooting-work-report-button"
          type="button"
          onClick={() => onStartWorkReport(guide)}
        >
          この内容で作業日報を入力
        </button>
      )}
      <div className="troubleshooting-flow-actions">
        <button type="button" onClick={restart}>
          最初から確認
        </button>
        <button type="button" onClick={onReturnToList}>
          症状一覧へ戻る
        </button>
      </div>
    </div>
  )
}

export function TroubleshootingGuideViewer({
  listState,
  detailState,
  onReloadList,
  onSelectGuide,
  onClearGuide,
  onStartWorkReport,
}: TroubleshootingGuideViewerProps) {
  return (
    <div className="equipment-profile-troubleshooting">
      <div className="equipment-profile-history-heading">
        <div>
          <span>GUIDE / TROUBLESHOOTING</span>
          <h4>トラブルシューティング</h4>
        </div>
        {listState.phase === 'ready' && (
          <small>利用できる症状 {listState.items.length}件</small>
        )}
      </div>
      <p className="equipment-profile-guide-intro">
        症状を選び、安全に確認できる項目を1つずつ進めます。会社固有の安全手順を最優先してください。
      </p>

      {listState.phase === 'loading' && (
        <p className="equipment-profile-state" role="status">
          この設備のトラブル対応ガイドを読み込んでいます…
        </p>
      )}
      {listState.phase === 'error' && (
        <div className="equipment-profile-state is-error" role="alert">
          <p>この設備のトラブル対応ガイドを読み込めませんでした。</p>
          <button type="button" onClick={onReloadList}>
            もう一度読み込む
          </button>
        </div>
      )}
      {listState.phase === 'ready' && listState.items.length === 0 && (
        <p className="equipment-profile-state">
          この設備のトラブル対応ガイドはまだ登録されていません。
        </p>
      )}
      {listState.phase === 'ready' &&
        listState.items.length > 0 &&
        detailState.phase === 'idle' && (
          <div className="troubleshooting-symptom-list">
            <p>発生している症状を選んでください。</p>
            <ul>
              {listState.items.map((guide) => (
                <li key={guide.id}>
                  <button type="button" onClick={() => onSelectGuide(guide.id)}>
                    <span>{guide.symptom}</span>
                    <small>確認を始める</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      {listState.phase === 'ready' && detailState.phase === 'loading' && (
        <div className="equipment-profile-state" role="status">
          <p>選択したガイドを読み込んでいます…</p>
          <button type="button" onClick={onClearGuide}>
            症状一覧へ戻る
          </button>
        </div>
      )}
      {listState.phase === 'ready' && detailState.phase === 'error' && (
        <div className="equipment-profile-state is-error" role="alert">
          <p>選択したガイドを読み込めませんでした。</p>
          <div className="troubleshooting-state-actions">
            <button
              type="button"
              onClick={() => onSelectGuide(detailState.guideId)}
            >
              もう一度読み込む
            </button>
            <button type="button" onClick={onClearGuide}>
              症状一覧へ戻る
            </button>
          </div>
        </div>
      )}
      {listState.phase === 'ready' && detailState.phase === 'ready' && (
        <ActiveGuide
          key={detailState.guide.id}
          guide={detailState.guide}
          onReturnToList={onClearGuide}
          onStartWorkReport={onStartWorkReport}
        />
      )}
    </div>
  )
}

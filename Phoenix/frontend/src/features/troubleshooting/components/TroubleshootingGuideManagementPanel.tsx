import { useState } from 'react'

import type { Equipment } from '../../equipment-master/types'
import { useTroubleshootingGuideManagement } from '../hooks/useTroubleshootingGuideManagement'
import type {
  TroubleshootingAnswer,
  TroubleshootingGuide,
  TroubleshootingGuideDetailState,
  TroubleshootingGuideListState,
  TroubleshootingStep,
} from '../types'
import './TroubleshootingGuideManagementPanel.css'
import { TroubleshootingGuideRegistrationForm } from './TroubleshootingGuideRegistrationForm'

type EquipmentLookupState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly equipment: readonly Equipment[] }
  | { readonly phase: 'error' }

type TroubleshootingGuideManagementContentProps = {
  readonly listState: TroubleshootingGuideListState
  readonly detailState: TroubleshootingGuideDetailState
  readonly equipmentState: EquipmentLookupState
  readonly onReloadList: () => void
  readonly onReloadEquipment: () => void
  readonly onSelectGuide: (guideId: string) => void
  readonly onClearGuide: () => void
}

type TroubleshootingGuideManagementPanelProps = {
  readonly equipmentState: EquipmentLookupState
  readonly onReloadEquipment: () => void
}

const ANSWER_LABELS: Readonly<Record<TroubleshootingAnswer, string>> = {
  yes: 'YES',
  no: 'NO',
  unknown: '不明',
}

const ANSWER_ORDER: readonly TroubleshootingAnswer[] = ['yes', 'no', 'unknown']

function getEquipmentLabel(
  equipmentId: string,
  equipmentState: EquipmentLookupState,
): string {
  if (equipmentState.phase === 'loading') return '設備名を確認中…'
  if (equipmentState.phase === 'error') return '設備名を取得できません'
  const item = equipmentState.equipment.find(
    (equipment) => equipment.equipment_id === equipmentId,
  )
  if (!item) return '設備マスターに該当設備がありません'
  return [item.name, item.equipment_number].filter(Boolean).join(' ')
}

function getStepLabels(
  steps: readonly TroubleshootingStep[],
): ReadonlyMap<string, string> {
  const counts = { question: 0, complete: 0, handoff: 0 }
  return new Map(
    steps.map((step) => {
      counts[step.step_type] += 1
      const prefix =
        step.step_type === 'question'
          ? '質問'
          : step.step_type === 'complete'
            ? '完了'
            : '引継ぎ'
      return [step.step_id, `${prefix} ${counts[step.step_type]}`]
    }),
  )
}

function GuideDetail({ guide }: { readonly guide: TroubleshootingGuide }) {
  const equipmentStateCounts = {
    question: guide.steps.filter((step) => step.step_type === 'question')
      .length,
    complete: guide.steps.filter((step) => step.step_type === 'complete')
      .length,
    handoff: guide.steps.filter((step) => step.step_type === 'handoff').length,
  }
  const labels = getStepLabels(guide.steps)
  const stepById = new Map(guide.steps.map((step) => [step.step_id, step]))

  return (
    <div className="troubleshooting-management-detail">
      <div className="troubleshooting-management-counts" aria-label="構成件数">
        <div>
          <span>質問</span>
          <strong>{equipmentStateCounts.question}</strong>
          <small>件</small>
        </div>
        <div>
          <span>完了</span>
          <strong>{equipmentStateCounts.complete}</strong>
          <small>件</small>
        </div>
        <div>
          <span>引継ぎ</span>
          <strong>{equipmentStateCounts.handoff}</strong>
          <small>件</small>
        </div>
      </div>

      <ol className="troubleshooting-management-steps">
        {guide.steps.map((step) => {
          const outgoingBranches = ANSWER_ORDER.map((answer) =>
            guide.branches.find(
              (branch) =>
                branch.from_step_id === step.step_id &&
                branch.answer === answer,
            ),
          ).filter((branch) => branch !== undefined)
          return (
            <li key={step.step_id}>
              <div className="troubleshooting-management-step-heading">
                <span className={`is-${step.step_type}`}>
                  {labels.get(step.step_id)}
                </span>
                {step.step_id === guide.start_step_id && (
                  <small>開始位置</small>
                )}
              </div>
              <strong>{step.prompt}</strong>
              {step.check_method && (
                <p>
                  <span>確認方法</span>
                  {step.check_method}
                </p>
              )}
              {step.caution_note && (
                <p className="is-caution">
                  <span>注意・安全境界</span>
                  {step.caution_note}
                </p>
              )}
              {outgoingBranches.length > 0 && (
                <dl>
                  {outgoingBranches.map((branch) => {
                    const target = stepById.get(branch.to_step_id)
                    return (
                      <div key={branch.branch_id}>
                        <dt>{ANSWER_LABELS[branch.answer]}</dt>
                        <dd>
                          {labels.get(branch.to_step_id)}：{target?.prompt}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function TroubleshootingGuideManagementContent({
  listState,
  detailState,
  equipmentState,
  onReloadList,
  onReloadEquipment,
  onSelectGuide,
  onClearGuide,
}: TroubleshootingGuideManagementContentProps) {
  if (listState.phase === 'loading') {
    return (
      <p className="troubleshooting-management-state" role="status">
        トラブルシューティングガイドを読み込んでいます…
      </p>
    )
  }

  if (listState.phase === 'error') {
    return (
      <div className="troubleshooting-management-state is-error" role="alert">
        <strong>ガイド一覧を読み込めませんでした</strong>
        <p>FastAPIの起動状態と接続先を確認してください。</p>
        <button type="button" onClick={onReloadList}>
          もう一度読み込む
        </button>
      </div>
    )
  }

  if (listState.items.length === 0) {
    return (
      <p className="troubleshooting-management-state">
        トラブルシューティングガイドはまだ登録されていません。
      </p>
    )
  }

  if (detailState.phase === 'loading') {
    return (
      <div className="troubleshooting-management-state" role="status">
        <p>選択したガイドの内容を読み込んでいます…</p>
        <button type="button" onClick={onClearGuide}>
          一覧へ戻る
        </button>
      </div>
    )
  }

  if (detailState.phase === 'error') {
    return (
      <div className="troubleshooting-management-state is-error" role="alert">
        <strong>選択したガイドを読み込めませんでした</strong>
        <div className="troubleshooting-management-actions">
          <button
            type="button"
            onClick={() => onSelectGuide(detailState.guideId)}
          >
            もう一度読み込む
          </button>
          <button type="button" onClick={onClearGuide}>
            一覧へ戻る
          </button>
        </div>
      </div>
    )
  }

  if (detailState.phase === 'ready') {
    return (
      <div className="troubleshooting-management-workspace">
        <div className="troubleshooting-management-selected">
          <div>
            <span>対象設備</span>
            <strong>
              {getEquipmentLabel(
                detailState.guide.equipment_id,
                equipmentState,
              )}
            </strong>
          </div>
          <div>
            <span>症状</span>
            <strong>{detailState.guide.symptom}</strong>
          </div>
          <span
            className={`troubleshooting-management-status ${detailState.guide.is_active ? 'is-active' : 'is-inactive'}`}
          >
            {detailState.guide.is_active ? '使用中' : '使用停止'}
          </span>
        </div>
        <GuideDetail guide={detailState.guide} />
        <button
          className="troubleshooting-management-back"
          type="button"
          onClick={onClearGuide}
        >
          ガイド一覧へ戻る
        </button>
      </div>
    )
  }

  return (
    <div className="troubleshooting-management-list">
      <div className="troubleshooting-management-list-heading">
        <div>
          <strong>登録済みガイド</strong>
          <span>
            登録{listState.total}件／表示{listState.items.length}件
          </span>
        </div>
        {equipmentState.phase === 'error' && (
          <button type="button" onClick={onReloadEquipment}>
            設備名を再読み込み
          </button>
        )}
      </div>
      {listState.items.length < listState.total && (
        <p className="troubleshooting-management-limit-note">
          登録数が100件を超えているため、先頭100件を表示しています。
        </p>
      )}
      <ul>
        {listState.items.map((guide) => (
          <li key={guide.id}>
            <div>
              <span>
                {getEquipmentLabel(guide.equipment_id, equipmentState)}
              </span>
              <strong>{guide.symptom}</strong>
            </div>
            <span
              className={`troubleshooting-management-status ${guide.is_active ? 'is-active' : 'is-inactive'}`}
            >
              {guide.is_active ? '使用中' : '使用停止'}
            </span>
            <button type="button" onClick={() => onSelectGuide(guide.id)}>
              内容を確認
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TroubleshootingGuideManagementPanel({
  equipmentState,
  onReloadEquipment,
}: TroubleshootingGuideManagementPanelProps) {
  const { listState, detailState, reloadList, selectGuide, clearGuide } =
    useTroubleshootingGuideManagement()
  const [isCreating, setIsCreating] = useState(false)
  const [createdSymptom, setCreatedSymptom] = useState<string | null>(null)
  const activeEquipment =
    equipmentState.phase === 'ready' ? equipmentState.equipment : []

  function startCreating() {
    clearGuide()
    setCreatedSymptom(null)
    setIsCreating(true)
  }

  function handleSaved(guide: TroubleshootingGuide) {
    setCreatedSymptom(guide.symptom)
    setIsCreating(false)
    reloadList()
  }

  return (
    <section
      className="admin-settings-tool troubleshooting-management"
      aria-labelledby="troubleshooting-management-title"
    >
      <div className="admin-settings-tool-heading">
        <div>
          <small>ADMIN GUIDE</small>
          <h2 id="troubleshooting-management-title">
            トラブルシューティングガイド管理
          </h2>
        </div>
        <p>登録済みガイドの確認と、安全な質問分岐の新規登録を行います。</p>
      </div>
      {!isCreating && (
        <div className="troubleshooting-management-toolbar">
          <div>
            <button
              type="button"
              disabled={activeEquipment.length === 0}
              onClick={startCreating}
            >
              新しいガイドを登録
            </button>
            {activeEquipment.length === 0 && (
              <small>使用中の設備を読み込むと登録できます。</small>
            )}
          </div>
          {createdSymptom && (
            <p role="status">
              {listState.phase === 'loading'
                ? `「${createdSymptom}」を保存しました。一覧を更新しています。`
                : listState.phase === 'ready'
                  ? `「${createdSymptom}」を保存し、一覧へ反映しました。`
                  : `「${createdSymptom}」は保存済みです。一覧を再読み込みしてください。`}
            </p>
          )}
        </div>
      )}
      {isCreating ? (
        <TroubleshootingGuideRegistrationForm
          equipment={activeEquipment}
          onCancel={() => setIsCreating(false)}
          onSaved={handleSaved}
        />
      ) : (
        <TroubleshootingGuideManagementContent
          listState={listState}
          detailState={detailState}
          equipmentState={equipmentState}
          onReloadList={reloadList}
          onReloadEquipment={onReloadEquipment}
          onSelectGuide={selectGuide}
          onClearGuide={clearGuide}
        />
      )}
    </section>
  )
}

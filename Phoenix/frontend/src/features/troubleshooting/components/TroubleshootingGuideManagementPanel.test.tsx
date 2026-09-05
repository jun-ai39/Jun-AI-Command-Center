import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Equipment } from '../../equipment-master/types'
import type {
  TroubleshootingGuide,
  TroubleshootingGuideSummary,
} from '../types'
import {
  TroubleshootingGuideManagementContent,
  TroubleshootingGuideManagementPanel,
} from './TroubleshootingGuideManagementPanel'

const equipment: Equipment = {
  equipment_id: '30000000-0000-4000-8000-000000000001',
  department_id: '10000000-0000-4000-8000-000000000001',
  manufacturer_id: '20000000-0000-4000-8000-000000000001',
  name: '包装機',
  equipment_number: 'No.2',
  model_number: 'TEST-200',
  photo_path: null,
  is_active: true,
  created_at: '2026-08-25T01:00:00+00:00',
  updated_at: '2026-08-25T01:00:00+00:00',
}
const questionId = '71000000-0000-4000-8000-000000000001'
const completeId = '71000000-0000-4000-8000-000000000002'
const handoffId = '71000000-0000-4000-8000-000000000003'
const summary: TroubleshootingGuideSummary = {
  id: '70000000-0000-4000-8000-000000000001',
  equipment_id: equipment.equipment_id,
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
  onReloadEquipment: vi.fn(),
  onSelectGuide: vi.fn(),
  onClearGuide: vi.fn(),
}
const equipmentState = { phase: 'ready', equipment: [equipment] } as const

describe('TroubleshootingGuideManagementContent', () => {
  it('shows registered guides with equipment, symptom, and active state', () => {
    const inactiveSummary = {
      ...summary,
      id: '70000000-0000-4000-8000-000000000002',
      symptom: '包装フィルムが送られない',
      is_active: false,
    }
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideManagementContent
        {...actions}
        equipmentState={equipmentState}
        listState={{
          phase: 'ready',
          items: [summary, inactiveSummary],
          total: 2,
        }}
        detailState={{ phase: 'idle' }}
      />,
    )

    expect(markup).toContain('登録済みガイド')
    expect(markup).toContain('登録2件／表示2件')
    expect(markup).toContain('包装機 No.2')
    expect(markup).toContain('コンベアーが動かない')
    expect(markup).toContain('包装フィルムが送られない')
    expect(markup).toContain('使用中')
    expect(markup).toContain('使用停止')
    expect(markup).toContain('内容を確認')
  })

  it('shows step counts, safety notes, and all branch destinations', () => {
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideManagementContent
        {...actions}
        equipmentState={equipmentState}
        listState={{ phase: 'ready', items: [summary], total: 1 }}
        detailState={{ phase: 'ready', guide }}
      />,
    )

    expect(markup).toContain('対象設備')
    expect(markup).toContain('質問')
    expect(markup).toContain('完了')
    expect(markup).toContain('引継ぎ')
    expect(markup).toContain('開始位置')
    expect(markup).toContain('運転スイッチは入っていますか？')
    expect(markup).toContain('操作盤の外側から表示を確認する')
    expect(markup).toContain('盤を開けない')
    expect(markup).toContain('YES')
    expect(markup).toContain('NO')
    expect(markup).toContain('不明')
    expect(markup).toContain('完了 1：運転担当者へ状態を共有してください。')
    expect(markup).toContain('引継ぎ 1：経験者へ引き継いでください。')
    expect(markup).toContain('ガイド一覧へ戻る')
  })

  it('shows loading, empty, list failure, and detail failure states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <TroubleshootingGuideManagementContent
        {...actions}
        equipmentState={equipmentState}
        listState={{ phase: 'loading' }}
        detailState={{ phase: 'idle' }}
      />,
    )
    const emptyMarkup = renderToStaticMarkup(
      <TroubleshootingGuideManagementContent
        {...actions}
        equipmentState={equipmentState}
        listState={{ phase: 'ready', items: [], total: 0 }}
        detailState={{ phase: 'idle' }}
      />,
    )
    const listErrorMarkup = renderToStaticMarkup(
      <TroubleshootingGuideManagementContent
        {...actions}
        equipmentState={equipmentState}
        listState={{ phase: 'error' }}
        detailState={{ phase: 'idle' }}
      />,
    )
    const detailErrorMarkup = renderToStaticMarkup(
      <TroubleshootingGuideManagementContent
        {...actions}
        equipmentState={equipmentState}
        listState={{ phase: 'ready', items: [summary], total: 1 }}
        detailState={{ phase: 'error', guideId: summary.id }}
      />,
    )

    expect(loadingMarkup).toContain('ガイドを読み込んでいます')
    expect(emptyMarkup).toContain('まだ登録されていません')
    expect(listErrorMarkup).toContain('ガイド一覧を読み込めませんでした')
    expect(listErrorMarkup).toContain('もう一度読み込む')
    expect(detailErrorMarkup).toContain('選択したガイドを読み込めませんでした')
    expect(detailErrorMarkup).toContain('一覧へ戻る')
  })

  it('keeps the guide list available when equipment labels fail', () => {
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideManagementContent
        {...actions}
        equipmentState={{ phase: 'error' }}
        listState={{ phase: 'ready', items: [summary], total: 1 }}
        detailState={{ phase: 'idle' }}
      />,
    )

    expect(markup).toContain('設備名を取得できません')
    expect(markup).toContain('設備名を再読み込み')
    expect(markup).toContain('コンベアーが動かない')
  })
})

describe('TroubleshootingGuideManagementPanel', () => {
  it('adds the STEP 115 registration entry without exposing the form yet', () => {
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideManagementPanel
        equipmentState={equipmentState}
        onReloadEquipment={vi.fn()}
      />,
    )

    expect(markup).toContain('ADMIN GUIDE / STEP 115')
    expect(markup).toContain('新しいガイドを登録')
    expect(markup).toContain('ガイドを読み込んでいます')
    expect(markup).not.toContain('id="troubleshooting-registration-equipment"')
  })
})

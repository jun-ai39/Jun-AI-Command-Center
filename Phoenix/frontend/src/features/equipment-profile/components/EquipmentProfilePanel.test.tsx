import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { EquipmentChangeHistory } from '../../equipment-change-histories/types'
import type { Equipment } from '../../equipment-master/types'
import type { InspectionRecord } from '../../inspection-records/types'
import type { InspectionTemplateItem } from '../../inspection-templates/types'
import type { TroubleshootingGuideSummary } from '../../troubleshooting/types'
import type { WorkReport } from '../../work-reports/types'
import { EquipmentProfileContent } from './EquipmentProfilePanel'

const equipment: Equipment = {
  equipment_id: '30000000-0000-4000-8000-000000000001',
  department_id: '10000000-0000-4000-8000-000000000001',
  manufacturer_id: '20000000-0000-4000-8000-000000000001',
  name: '包装機',
  equipment_number: 'No.2',
  model_number: 'TEST-200',
  photo_path: null,
  is_active: true,
  created_at: '2026-08-20T01:00:00+00:00',
  updated_at: '2026-08-20T01:00:00+00:00',
}

const report: WorkReport = {
  id: '9b73f331-d416-41c8-b5e2-6f3e53b7ac31',
  work_date: '2026-08-21',
  department_id: equipment.department_id,
  equipment_id: equipment.equipment_id,
  department_name: '菓子パン',
  equipment_name: '包装機',
  equipment_number: 'No.2',
  phenomenon: '搬送部から周期的な異音',
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

const changeHistory: EquipmentChangeHistory = {
  change_history_id: '80000000-0000-4000-8000-000000000001',
  equipment_id: equipment.equipment_id,
  changed_on: '2026-08-26',
  improvement_point: 'チェーンガイドの搬送安定化',
  change_details: '架空の樹脂ガイド形状を変更し、蛇行を抑制した。',
  work_report_id: report.id,
  created_at: '2026-08-26T01:00:00+00:00',
  updated_at: '2026-08-26T01:00:00+00:00',
}

const inspection: InspectionRecord = {
  id: '50000000-0000-4000-8000-000000000001',
  inspection_date: '2026-08-22',
  equipment_id: equipment.equipment_id,
  equipment_name: equipment.name,
  equipment_number: equipment.equipment_number,
  cycle: 'daily',
  period_key: '2026-08-22',
  overall_judgment: 'abnormal',
  items: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      template_item_id: '40000000-0000-4000-8000-000000000001',
      name: 'モーター電流',
      input_type: 'number',
      number_value: 16.2,
      status_value: null,
      unit: 'A',
      normal_min: 10,
      normal_max: 15,
      normal_state: null,
      judgment: 'abnormal',
      display_order: 10,
    },
    {
      id: '60000000-0000-4000-8000-000000000002',
      template_item_id: '40000000-0000-4000-8000-000000000002',
      name: 'ベルト状態',
      input_type: 'status',
      number_value: null,
      status_value: 'normal',
      unit: null,
      normal_min: null,
      normal_max: null,
      normal_state: '亀裂・緩みなし',
      judgment: 'normal',
      display_order: 20,
    },
  ],
  created_at: '2026-08-22T01:00:00+00:00',
  updated_at: '2026-08-22T01:00:00+00:00',
}

const dailyGuide: InspectionTemplateItem = {
  id: '40000000-0000-4000-8000-000000000001',
  equipment_id: equipment.equipment_id,
  cycle: 'daily',
  name: 'モーター電流',
  input_type: 'number',
  unit: 'A',
  normal_min: 10,
  normal_max: 15,
  normal_state: null,
  check_method: '操作盤の電流表示を正面から確認する',
  caution_note: '異常値の場合は経験者へ引き継ぐ',
  display_order: 10,
  is_active: true,
  created_at: '2026-08-24T01:00:00+00:00',
  updated_at: '2026-08-24T01:00:00+00:00',
}

const weeklyGuide: InspectionTemplateItem = {
  ...dailyGuide,
  id: '40000000-0000-4000-8000-000000000002',
  cycle: 'weekly',
  name: 'ベルト状態',
  input_type: 'status',
  unit: null,
  normal_min: null,
  normal_max: null,
  normal_state: '亀裂・緩みなし',
  check_method: null,
  caution_note: null,
  display_order: 20,
}

const troubleshootingGuide: TroubleshootingGuideSummary = {
  id: '70000000-0000-4000-8000-000000000001',
  equipment_id: equipment.equipment_id,
  symptom: 'コンベアーが動かない',
  start_step_id: '71000000-0000-4000-8000-000000000001',
  display_order: 10,
  is_active: true,
  created_at: '2026-08-25T01:00:00+00:00',
  updated_at: '2026-08-25T01:00:00+00:00',
}

const baseProps = {
  equipment,
  departmentName: '菓子パン',
  manufacturerName: '架空Aメーカー',
  changeHistoriesState: {
    phase: 'ready',
    items: [changeHistory],
    total: 3,
  } as const,
  changeHistorySaveState: { phase: 'idle' } as const,
  inspectionsState: {
    phase: 'ready',
    items: [inspection],
    total: 4,
  } as const,
  guidesState: {
    phase: 'ready',
    items: [dailyGuide, weeklyGuide],
    total: 2,
  } as const,
  troubleshootingListState: {
    phase: 'ready',
    items: [troubleshootingGuide],
    total: 1,
  } as const,
  troubleshootingDetailState: { phase: 'idle' } as const,
  onReloadChangeHistories: vi.fn(),
  onSaveChangeHistory: vi.fn(async () => null),
  onResetChangeHistorySave: vi.fn(),
  onReloadReports: vi.fn(),
  onReloadInspections: vi.fn(),
  onReloadGuides: vi.fn(),
  onReloadTroubleshooting: vi.fn(),
  onSelectTroubleshootingGuide: vi.fn(),
  onClearTroubleshootingGuide: vi.fn(),
  onClose: vi.fn(),
}

describe('EquipmentProfileContent', () => {
  it('shows equipment identity and its latest linked work reports', () => {
    const markup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [report], total: 7 }}
      />,
    )

    expect(markup).toContain('KNOWLEDGE / EQUIPMENT PROFILE')
    expect(markup).toContain('設備カルテ')
    expect(markup).toContain('包装機 No.2')
    expect(markup).toContain('菓子パン')
    expect(markup).toContain('架空Aメーカー')
    expect(markup).toContain('TEST-200')
    expect(markup).toContain('使用中')
    expect(markup).toContain('設備写真')
    expect(markup).toContain('未登録')
    expect(markup).toContain('登録7件／最新1件')
    expect(markup).toContain('搬送部から周期的な異音')
    expect(markup).toContain('安全な範囲で外観を確認')
    expect(markup).toContain('経過確認')
    expect(markup).toContain('INSPECTION RECORDS')
    expect(markup).toContain('この設備の最新点検記録')
    expect(markup).toContain('登録4件／最新1件')
    expect(markup).toContain('毎日点検')
    expect(markup).toContain('総合：異常')
    expect(markup).toContain('点検結果を表示（2項目）')
    expect(markup).toContain('モーター電流')
    expect(markup).toContain('16.2 A')
    expect(markup).toContain('正常範囲：10 ～ 15 A')
    expect(markup).toContain('ベルト状態')
    expect(markup).toContain('正常状態：亀裂・緩みなし')
    expect(markup).toContain('GUIDE / TROUBLESHOOTING')
    expect(markup).toContain('トラブルシューティング')
    expect(markup).toContain('コンベアーが動かない')
    expect(markup).toContain('確認を始める')
    expect(markup).toContain('GUIDE / INSPECTION')
    expect(markup).toContain('この設備の点検作業ガイド')
    expect(markup).toContain('登録2件／表示2件')
    expect(markup).toContain('毎日点検')
    expect(markup).toContain('毎週点検')
    expect(markup).toContain('毎月点検')
    expect(markup).toContain('操作盤の電流表示を正面から確認する')
    expect(markup).toContain('異常値の場合は経験者へ引き継ぐ')
    expect(markup).toContain('この周期のガイドは未登録です')
    expect(markup).not.toContain('ガイドを編集')
    expect(markup).toContain('KNOWLEDGE / CHANGE HISTORY')
    expect(markup).toContain('この設備の改良・変更履歴')
    expect(markup).toContain('登録3件／最新1件')
    expect(markup).toContain('チェーンガイドの搬送安定化')
    expect(markup).toContain('架空の樹脂ガイド形状を変更し、蛇行を抑制した。')
    expect(markup).toContain('関連日報あり')
    expect(markup).toContain('改良・変更を記録')
    expect(markup).toContain('id="equipment-change-history-date"')
    expect(markup).toContain('id="equipment-change-history-point"')
    expect(markup).toContain('id="equipment-change-history-details"')
    expect(markup).toContain('id="equipment-change-history-report"')
    expect(markup).toContain('改良・変更履歴を保存')
  })

  it('shows photo management only when the admin screen enables it', () => {
    const adminMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        equipment={{
          ...equipment,
          photo_path: '0123456789abcdef0123456789abcdef.jpg',
        }}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        canManagePhoto
        onEquipmentPhotoChanged={vi.fn()}
      />,
    )
    const generalMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
      />,
    )

    expect(adminMarkup).toContain('写真を差し替える')
    expect(adminMarkup).toContain('写真を削除')
    expect(adminMarkup).toContain('accept="image/jpeg,image/png,image/webp"')
    expect(adminMarkup).toContain('JPEG・PNG・WebP／10MB以下')
    expect(generalMarkup).not.toContain('写真を登録する')
    expect(generalMarkup).not.toContain('写真を削除')
  })

  it('shows saved feedback and blocks new histories for inactive equipment', () => {
    const savedMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [report], total: 1 }}
        changeHistorySaveState={{ phase: 'saved', history: changeHistory }}
      />,
    )
    const inactiveMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        equipment={{ ...equipment, is_active: false }}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
      />,
    )
    expect(savedMarkup).toContain(
      '改良・変更履歴を保存し、設備カルテを更新しました。',
    )
    expect(inactiveMarkup).toContain(
      '使用停止中の設備には新しい改良・変更履歴を登録できません。',
    )
    expect(inactiveMarkup).not.toContain('id="equipment-change-history-point"')
  })

  it('shows an explicit empty state for equipment without change histories', () => {
    const markup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        changeHistoriesState={{ phase: 'ready', items: [], total: 0 }}
      />,
    )
    expect(markup).toContain('この設備の改良・変更履歴はまだありません。')
    expect(markup).toContain('登録0件／最新0件')
  })

  it('shows independent change-history loading and failure recovery states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        changeHistoriesState={{ phase: 'loading' }}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        changeHistoriesState={{ phase: 'error' }}
      />,
    )
    expect(loadingMarkup).toContain('改良・変更履歴を読み込んでいます')
    expect(errorMarkup).toContain('改良・変更履歴を読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })

  it('shows an explicit empty state for equipment without reports', () => {
    const markup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
      />,
    )
    expect(markup).toContain('この設備に紐づく作業日報はまだありません。')
    expect(markup).toContain('登録0件／最新0件')
  })

  it('shows an explicit empty state for equipment without inspections', () => {
    const markup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        inspectionsState={{ phase: 'ready', items: [], total: 0 }}
      />,
    )
    expect(markup).toContain('この設備に紐づく点検記録はまだありません。')
    expect(markup).toContain('登録0件／最新0件')
  })

  it('shows loading and failure recovery states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'loading' }}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'error' }}
      />,
    )
    expect(loadingMarkup).toContain('この設備の日報を読み込んでいます')
    expect(errorMarkup).toContain('この設備の日報を読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })

  it('shows independent inspection loading and failure recovery states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        inspectionsState={{ phase: 'loading' }}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        inspectionsState={{ phase: 'error' }}
      />,
    )
    expect(loadingMarkup).toContain('この設備の点検記録を読み込んでいます')
    expect(errorMarkup).toContain('この設備の点検記録を読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })

  it('shows an explicit empty state for equipment without inspection guides', () => {
    const markup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        guidesState={{ phase: 'ready', items: [], total: 0 }}
      />,
    )
    expect(markup).toContain(
      'この設備の点検作業ガイドはまだ登録されていません。',
    )
    expect(markup).toContain('登録0件／表示0件')
  })

  it('shows independent guide loading and failure recovery states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        guidesState={{ phase: 'loading' }}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <EquipmentProfileContent
        {...baseProps}
        reportsState={{ phase: 'ready', items: [], total: 0 }}
        guidesState={{ phase: 'error' }}
      />,
    )
    expect(loadingMarkup).toContain('点検作業ガイドを読み込んでいます')
    expect(errorMarkup).toContain('点検作業ガイドを読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })
})

it('connects an abnormal history card to the work report handoff', () => {
  const onStartWorkReport = vi.fn()
  const markup = renderToStaticMarkup(
    <EquipmentProfileContent
      {...baseProps}
      reportsState={{ phase: 'ready', items: [], total: 0 }}
      onStartWorkReport={onStartWorkReport}
    />,
  )
  expect(markup).toContain('作業日報へ引き継ぐ')
  expect(markup).toContain('自動では登録されません')
  expect(onStartWorkReport).not.toHaveBeenCalled()
})

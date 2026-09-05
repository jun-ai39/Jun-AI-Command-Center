import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Equipment } from '../../equipment-master/types'
import { TroubleshootingGuideRegistrationForm } from './TroubleshootingGuideRegistrationForm'

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

describe('TroubleshootingGuideRegistrationForm', () => {
  it('shows the approved four-stage safe registration flow', () => {
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideRegistrationForm
        equipment={[equipment]}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(markup).toContain('ADMIN GUIDE / STEP 115')
    expect(markup).toContain('新しいガイドを登録')
    expect(markup).toContain('基本情報')
    expect(markup).toContain('質問と分岐')
    expect(markup).toContain('完了・引継ぎ')
    expect(markup).toContain('保存前確認')
    expect(markup).toContain('id="troubleshooting-registration-equipment"')
    expect(markup).toContain('包装機 No.2')
    expect(markup).toContain('id="troubleshooting-registration-symptom"')
    expect(markup).toContain('id="troubleshooting-question-1-prompt"')
    expect(markup).toContain('YESの行き先')
    expect(markup).toContain('NOの行き先')
    expect(markup).toContain('不明の行き先')
    expect(markup).toContain('引継ぎ（固定）')
    expect(markup).toContain('質問を追加')
    expect(markup).toContain('1ガイド最大10問')
    expect(markup).toContain('この内容で登録')
    expect(markup).toContain('キャンセル')
    expect(markup).not.toContain('質問 2・')
  })

  it('starts with required fields incomplete and save disabled', () => {
    const markup = renderToStaticMarkup(
      <TroubleshootingGuideRegistrationForm
        equipment={[equipment]}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(markup).toContain('必須項目を入力してください')
    expect(markup).toContain('入力後に「分岐を再確認」を押してください')
    expect(markup).toMatch(/<button[^>]*class="is-primary"[^>]*disabled=""/)
    expect(markup).not.toContain('対象設備を選択してください。')
  })
})

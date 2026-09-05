import { describe, expect, it } from 'vitest'

import {
  buildTroubleshootingGuideCreateInput,
  COMPLETE_TARGET,
  HANDOFF_TARGET,
  validateTroubleshootingGuideForm,
  type TroubleshootingGuideFormValues,
} from './troubleshootingGuideForm'

const equipmentId = '30000000-0000-4000-8000-000000000001'

function validValues(): TroubleshootingGuideFormValues {
  return {
    equipmentId,
    symptom: '  コンベアーが動かない  ',
    displayOrder: 10,
    isActive: true,
    questions: [
      {
        key: 'question-1',
        prompt: '  運転スイッチは入っていますか？  ',
        checkMethod: ' 操作盤の外側から確認する ',
        cautionNote: ' 盤を開けない ',
        yesTarget: 'question-2',
        noTarget: COMPLETE_TARGET,
      },
      {
        key: 'question-2',
        prompt: '電源表示は点灯していますか？',
        checkMethod: '',
        cautionNote: '',
        yesTarget: COMPLETE_TARGET,
        noTarget: HANDOFF_TARGET,
      },
    ],
    completePrompt: ' 安全確認後に運転担当者へ共有してください。 ',
    handoffPrompt: ' 経験者へ引き継いでください。 ',
    handoffCaution: ' 会社の安全手順を優先してください。 ',
  }
}

describe('troubleshooting guide form validation', () => {
  it('accepts a reachable forward-only graph with complete and handoff exits', () => {
    expect(validateTroubleshootingGuideForm(validValues())).toEqual([])
  })

  it('rejects required blanks, unreachable questions, and missing completion routes', () => {
    const values = validValues()
    const errors = validateTroubleshootingGuideForm({
      ...values,
      equipmentId: '',
      symptom: '',
      questions: [
        {
          ...values.questions[0],
          prompt: '',
          yesTarget: HANDOFF_TARGET,
          noTarget: HANDOFF_TARGET,
        },
        values.questions[1],
      ],
      completePrompt: '',
      handoffPrompt: '',
      handoffCaution: '',
    })

    expect(errors).toContain('対象設備を選択してください。')
    expect(errors).toContain('症状を入力してください。')
    expect(errors).toContain('質問1の質問文を入力してください。')
    expect(errors).toContain('質問2へ到達する分岐がありません。')
    expect(errors).toContain('完了へ到達するYESまたはNOの分岐がありません。')
    expect(errors).toContain('完了時の表示内容を入力してください。')
    expect(errors).toContain('引継ぎ内容を入力してください。')
    expect(errors).toContain('引継ぎ時の安全上の注意を入力してください。')
  })

  it('rejects backwards targets so cycles cannot be submitted', () => {
    const values = validValues()
    const errors = validateTroubleshootingGuideForm({
      ...values,
      questions: [
        values.questions[0],
        { ...values.questions[1], yesTarget: 'question-1' },
      ],
    })

    expect(errors).toContain('質問2のYESの行き先が無効です。')
  })
})

describe('troubleshooting guide create payload', () => {
  it('builds stable step references and forces every unknown route to handoff', () => {
    const ids = [
      '71000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000003',
      '71000000-0000-4000-8000-000000000004',
    ]
    const payload = buildTroubleshootingGuideCreateInput(validValues(), () =>
      ids.shift()!,
    )

    expect(payload.symptom).toBe('コンベアーが動かない')
    expect(payload.start_step_id).toBe('71000000-0000-4000-8000-000000000001')
    expect(payload.steps).toHaveLength(4)
    expect(payload.branches).toHaveLength(6)
    expect(payload.steps[0]).toMatchObject({
      prompt: '運転スイッチは入っていますか？',
      check_method: '操作盤の外側から確認する',
      caution_note: '盤を開けない',
    })
    expect(payload.steps[1]).toMatchObject({
      check_method: null,
      caution_note: null,
    })
    expect(
      payload.branches.filter((branch) => branch.answer === 'unknown'),
    ).toEqual([
      expect.objectContaining({
        to_step_id: '71000000-0000-4000-8000-000000000004',
      }),
      expect.objectContaining({
        to_step_id: '71000000-0000-4000-8000-000000000004',
      }),
    ])
  })

  it('refuses to build a payload before form validation succeeds', () => {
    expect(() =>
      buildTroubleshootingGuideCreateInput({
        ...validValues(),
        symptom: '',
      }),
    ).toThrow('症状を入力してください。')
  })
})

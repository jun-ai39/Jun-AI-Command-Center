import { describe, expect, it } from 'vitest'

import { TEST_DEPARTMENT_ID, TEST_EQUIPMENT_ID } from './testFixtures'
import { createDefaultWorkReportDraft } from './workReportDraft'
import {
  createGuideHandoffDraft,
  needsGuideHandoffConfirmation,
} from './workReportGuideHandoff'

describe('createGuideHandoffDraft', () => {
  it('prefills only the equipment identity and symptom', () => {
    expect(
      createGuideHandoffDraft(
        {
          departmentId: TEST_DEPARTMENT_ID,
          equipmentId: TEST_EQUIPMENT_ID,
          phenomenon: '  コンベアーが動かない  ',
        },
        '2026-08-26',
      ),
    ).toEqual({
      workDate: '2026-08-26',
      departmentId: TEST_DEPARTMENT_ID,
      equipmentId: TEST_EQUIPMENT_ID,
      phenomenon: 'コンベアーが動かない',
      cause: '',
      workContent: '',
      progress: '',
    })
  })

  it('requires a choice before replacing unsaved input', () => {
    const emptyDraft = createDefaultWorkReportDraft()
    const existingDraft = {
      ...emptyDraft,
      phenomenon: '入力途中の別の現象',
    }

    expect(needsGuideHandoffConfirmation(existingDraft, false)).toBe(true)
    expect(needsGuideHandoffConfirmation(emptyDraft, false)).toBe(false)
    expect(needsGuideHandoffConfirmation(existingDraft, true)).toBe(false)
  })

  it('prefills an abnormal inspection handoff for human review', () => {
    expect(
      createGuideHandoffDraft({
        source: 'inspection',
        workDate: '2026-09-16',
        departmentId: TEST_DEPARTMENT_ID,
        equipmentId: TEST_EQUIPMENT_ID,
        phenomenon: '毎日点検で異常を確認：ベルト状態',
        workContent: ' 点検異常を確認し、必要な対応を引き継ぐ。 ',
        progress: 'continued',
      }),
    ).toEqual({
      workDate: '2026-09-16',
      departmentId: TEST_DEPARTMENT_ID,
      equipmentId: TEST_EQUIPMENT_ID,
      phenomenon: '毎日点検で異常を確認：ベルト状態',
      cause: '',
      workContent: '点検異常を確認し、必要な対応を引き継ぐ。',
      progress: 'continued',
    })
  })
})

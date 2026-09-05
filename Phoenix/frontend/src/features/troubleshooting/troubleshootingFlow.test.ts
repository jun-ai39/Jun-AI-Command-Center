import { describe, expect, it } from 'vitest'

import type { TroubleshootingGuide } from './types'
import {
  advanceTroubleshootingFlow,
  getTroubleshootingStep,
  startTroubleshootingFlow,
} from './troubleshootingFlow'

const questionId = '71000000-0000-4000-8000-000000000001'
const completeId = '71000000-0000-4000-8000-000000000002'
const handoffId = '71000000-0000-4000-8000-000000000003'

const guide: TroubleshootingGuide = {
  id: '70000000-0000-4000-8000-000000000001',
  equipment_id: '30000000-0000-4000-8000-000000000001',
  symptom: 'コンベアーが動かない',
  start_step_id: questionId,
  display_order: 10,
  is_active: true,
  created_at: '2026-08-25T01:00:00+00:00',
  updated_at: '2026-08-25T01:00:00+00:00',
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
      prompt: '運転担当者へ状態を共有する',
      check_method: null,
      caution_note: null,
    },
    {
      step_id: handoffId,
      step_type: 'handoff',
      prompt: '経験者へ引き継ぐ',
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

describe('troubleshooting flow', () => {
  it('starts at the declared step and follows YES to completion', () => {
    const started = startTroubleshootingFlow(guide)
    const completed = advanceTroubleshootingFlow(guide, started, 'yes')

    expect(started).toEqual({ currentStepId: questionId, answeredCount: 0 })
    expect(completed).toEqual({
      currentStepId: completeId,
      answeredCount: 1,
    })
    expect(getTroubleshootingStep(guide, completeId)?.step_type).toBe(
      'complete',
    )
  })

  it('sends unknown answers to the handoff terminal', () => {
    const handedOff = advanceTroubleshootingFlow(
      guide,
      startTroubleshootingFlow(guide),
      'unknown',
    )

    expect(handedOff?.currentStepId).toBe(handoffId)
    expect(getTroubleshootingStep(guide, handoffId)?.step_type).toBe('handoff')
  })

  it('does not advance from a terminal or through a missing branch', () => {
    expect(
      advanceTroubleshootingFlow(
        guide,
        { currentStepId: completeId, answeredCount: 1 },
        'yes',
      ),
    ).toBeNull()
    expect(
      advanceTroubleshootingFlow(
        { ...guide, branches: [] },
        startTroubleshootingFlow(guide),
        'yes',
      ),
    ).toBeNull()
  })
})

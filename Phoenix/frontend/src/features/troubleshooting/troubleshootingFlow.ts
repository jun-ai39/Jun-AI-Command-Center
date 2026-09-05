import type {
  TroubleshootingAnswer,
  TroubleshootingGuide,
  TroubleshootingStep,
} from './types'

export type TroubleshootingFlowState = {
  readonly currentStepId: string
  readonly answeredCount: number
}

export function startTroubleshootingFlow(
  guide: TroubleshootingGuide,
): TroubleshootingFlowState {
  return { currentStepId: guide.start_step_id, answeredCount: 0 }
}

export function getTroubleshootingStep(
  guide: TroubleshootingGuide,
  stepId: string,
): TroubleshootingStep | null {
  return guide.steps.find((step) => step.step_id === stepId) ?? null
}

export function advanceTroubleshootingFlow(
  guide: TroubleshootingGuide,
  state: TroubleshootingFlowState,
  answer: TroubleshootingAnswer,
): TroubleshootingFlowState | null {
  const currentStep = getTroubleshootingStep(guide, state.currentStepId)
  if (currentStep?.step_type !== 'question') return null
  const branch = guide.branches.find(
    (item) =>
      item.from_step_id === currentStep.step_id && item.answer === answer,
  )
  if (!branch || !getTroubleshootingStep(guide, branch.to_step_id)) return null
  return {
    currentStepId: branch.to_step_id,
    answeredCount: state.answeredCount + 1,
  }
}

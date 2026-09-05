import type { TroubleshootingGuideCreateInput } from './types'

export const MAX_TROUBLESHOOTING_QUESTIONS = 10
export const COMPLETE_TARGET = 'complete'
export const HANDOFF_TARGET = 'handoff'

export type TroubleshootingQuestionDraft = {
  readonly key: string
  readonly prompt: string
  readonly checkMethod: string
  readonly cautionNote: string
  readonly yesTarget: string
  readonly noTarget: string
}

export type TroubleshootingGuideFormValues = {
  readonly equipmentId: string
  readonly symptom: string
  readonly displayOrder: number
  readonly isActive: boolean
  readonly questions: readonly TroubleshootingQuestionDraft[]
  readonly completePrompt: string
  readonly handoffPrompt: string
  readonly handoffCaution: string
}

type UuidFactory = () => string

function createUuidV4(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hexadecimal = [...bytes].map((byte) =>
    byte.toString(16).padStart(2, '0'),
  )
  return [
    hexadecimal.slice(0, 4).join(''),
    hexadecimal.slice(4, 6).join(''),
    hexadecimal.slice(6, 8).join(''),
    hexadecimal.slice(8, 10).join(''),
    hexadecimal.slice(10).join(''),
  ].join('-')
}

function isTextLengthValid(value: string, maximumLength: number): boolean {
  return value.trim().length <= maximumLength
}

function getAllowedTargets(
  questions: readonly TroubleshootingQuestionDraft[],
  questionIndex: number,
): ReadonlySet<string> {
  return new Set([
    ...questions.slice(questionIndex + 1).map((question) => question.key),
    COMPLETE_TARGET,
    HANDOFF_TARGET,
  ])
}

export function createInitialTroubleshootingGuideFormValues(): TroubleshootingGuideFormValues {
  return {
    equipmentId: '',
    symptom: '',
    displayOrder: 10,
    isActive: true,
    questions: [
      {
        key: 'question-1',
        prompt: '',
        checkMethod: '',
        cautionNote: '',
        yesTarget: COMPLETE_TARGET,
        noTarget: HANDOFF_TARGET,
      },
    ],
    completePrompt: '',
    handoffPrompt: '',
    handoffCaution: '',
  }
}

export function validateTroubleshootingGuideForm(
  values: TroubleshootingGuideFormValues,
): readonly string[] {
  const errors: string[] = []
  if (!values.equipmentId) errors.push('対象設備を選択してください。')
  const symptom = values.symptom.trim()
  if (!symptom) errors.push('症状を入力してください。')
  else if (!isTextLengthValid(symptom, 200)) {
    errors.push('症状は200文字以内で入力してください。')
  }
  if (
    !Number.isInteger(values.displayOrder) ||
    values.displayOrder < 0 ||
    values.displayOrder > 9999
  ) {
    errors.push('表示順は0から9999までの整数で入力してください。')
  }
  if (
    values.questions.length < 1 ||
    values.questions.length > MAX_TROUBLESHOOTING_QUESTIONS
  ) {
    errors.push(
      `質問は1件以上${MAX_TROUBLESHOOTING_QUESTIONS}件以下にしてください。`,
    )
  }

  const keys = new Set(values.questions.map((question) => question.key))
  if (keys.size !== values.questions.length) {
    errors.push('質問の内部識別子が重複しています。')
  }
  values.questions.forEach((question, index) => {
    const prompt = question.prompt.trim()
    if (!prompt) errors.push(`質問${index + 1}の質問文を入力してください。`)
    else if (!isTextLengthValid(prompt, 500)) {
      errors.push(`質問${index + 1}の質問文は500文字以内にしてください。`)
    }
    if (!isTextLengthValid(question.checkMethod, 500)) {
      errors.push(`質問${index + 1}の確認方法は500文字以内にしてください。`)
    }
    if (!isTextLengthValid(question.cautionNote, 500)) {
      errors.push(`質問${index + 1}の注意事項は500文字以内にしてください。`)
    }
    const allowedTargets = getAllowedTargets(values.questions, index)
    if (!allowedTargets.has(question.yesTarget)) {
      errors.push(`質問${index + 1}のYESの行き先が無効です。`)
    }
    if (!allowedTargets.has(question.noTarget)) {
      errors.push(`質問${index + 1}のNOの行き先が無効です。`)
    }
  })

  const completePrompt = values.completePrompt.trim()
  if (!completePrompt) errors.push('完了時の表示内容を入力してください。')
  else if (!isTextLengthValid(completePrompt, 500)) {
    errors.push('完了時の表示内容は500文字以内にしてください。')
  }
  const handoffPrompt = values.handoffPrompt.trim()
  if (!handoffPrompt) errors.push('引継ぎ内容を入力してください。')
  else if (!isTextLengthValid(handoffPrompt, 500)) {
    errors.push('引継ぎ内容は500文字以内にしてください。')
  }
  const handoffCaution = values.handoffCaution.trim()
  if (!handoffCaution) errors.push('引継ぎ時の安全上の注意を入力してください。')
  else if (!isTextLengthValid(handoffCaution, 500)) {
    errors.push('引継ぎ時の安全上の注意は500文字以内にしてください。')
  }

  if (values.questions.length > 0 && keys.size === values.questions.length) {
    const questionByKey = new Map(
      values.questions.map((question) => [question.key, question]),
    )
    const reachable = new Set<string>([values.questions[0].key])
    const pending = [values.questions[0].key]
    while (pending.length > 0) {
      const key = pending.shift()
      if (!key) continue
      const question = questionByKey.get(key)
      if (!question) continue
      for (const target of [question.yesTarget, question.noTarget]) {
        if (questionByKey.has(target) && !reachable.has(target)) {
          reachable.add(target)
          pending.push(target)
        }
      }
    }
    values.questions.forEach((question, index) => {
      if (!reachable.has(question.key)) {
        errors.push(`質問${index + 1}へ到達する分岐がありません。`)
      }
    })
    const hasReachableComplete = [...reachable].some((key) => {
      const question = questionByKey.get(key)
      return (
        question?.yesTarget === COMPLETE_TARGET ||
        question?.noTarget === COMPLETE_TARGET
      )
    })
    if (!hasReachableComplete) {
      errors.push('完了へ到達するYESまたはNOの分岐がありません。')
    }
  }
  return errors
}

function optionalText(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

export function buildTroubleshootingGuideCreateInput(
  values: TroubleshootingGuideFormValues,
  uuidFactory: UuidFactory = createUuidV4,
): TroubleshootingGuideCreateInput {
  const errors = validateTroubleshootingGuideForm(values)
  if (errors.length > 0) {
    throw new Error(errors[0])
  }

  const questionIds = new Map(
    values.questions.map((question) => [question.key, uuidFactory()]),
  )
  const completeStepId = uuidFactory()
  const handoffStepId = uuidFactory()
  const targetId = (target: string): string => {
    if (target === COMPLETE_TARGET) return completeStepId
    if (target === HANDOFF_TARGET) return handoffStepId
    const stepId = questionIds.get(target)
    if (!stepId) throw new Error('質問の行き先を解決できません。')
    return stepId
  }

  return {
    equipment_id: values.equipmentId,
    symptom: values.symptom.trim(),
    start_step_id: questionIds.get(values.questions[0].key)!,
    display_order: values.displayOrder,
    is_active: values.isActive,
    steps: [
      ...values.questions.map((question) => ({
        step_id: questionIds.get(question.key)!,
        step_type: 'question' as const,
        prompt: question.prompt.trim(),
        check_method: optionalText(question.checkMethod),
        caution_note: optionalText(question.cautionNote),
      })),
      {
        step_id: completeStepId,
        step_type: 'complete' as const,
        prompt: values.completePrompt.trim(),
        check_method: null,
        caution_note: null,
      },
      {
        step_id: handoffStepId,
        step_type: 'handoff' as const,
        prompt: values.handoffPrompt.trim(),
        check_method: null,
        caution_note: values.handoffCaution.trim(),
      },
    ],
    branches: values.questions.flatMap((question) => {
      const fromStepId = questionIds.get(question.key)!
      return [
        {
          from_step_id: fromStepId,
          answer: 'yes' as const,
          to_step_id: targetId(question.yesTarget),
        },
        {
          from_step_id: fromStepId,
          answer: 'no' as const,
          to_step_id: targetId(question.noTarget),
        },
        {
          from_step_id: fromStepId,
          answer: 'unknown' as const,
          to_step_id: handoffStepId,
        },
      ]
    }),
  }
}

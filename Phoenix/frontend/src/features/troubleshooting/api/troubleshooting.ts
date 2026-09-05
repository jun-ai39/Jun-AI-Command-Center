import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type {
  TroubleshootingAnswer,
  TroubleshootingBranch,
  TroubleshootingGuide,
  TroubleshootingGuideCreateInput,
  TroubleshootingGuideListResponse,
  TroubleshootingGuideSummary,
  TroubleshootingStep,
  TroubleshootingStepType,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REQUIRED_ANSWERS = new Set<TroubleshootingAnswer>([
  'yes',
  'no',
  'unknown',
])

type TroubleshootingRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

type TroubleshootingListRequestOptions = TroubleshootingRequestOptions & {
  readonly isActive?: boolean
}

export class TroubleshootingApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'TroubleshootingApiError'
    this.status = status
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  return configuredUrl || DEFAULT_API_BASE_URL
}

function removeTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isRequiredText(
  value: unknown,
  maximumLength: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 1 &&
    value.trim().length <= maximumLength
  )
}

function isOptionalText(
  value: unknown,
  maximumLength: number,
): value is string | null {
  return value === null || isRequiredText(value, maximumLength)
}

function isStepType(value: unknown): value is TroubleshootingStepType {
  return value === 'question' || value === 'complete' || value === 'handoff'
}

function isAnswer(value: unknown): value is TroubleshootingAnswer {
  return value === 'yes' || value === 'no' || value === 'unknown'
}

function isGuideSummary(value: unknown): value is TroubleshootingGuideSummary {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isUuid(record.id) &&
    isUuid(record.equipment_id) &&
    isRequiredText(record.symptom, 200) &&
    isUuid(record.start_step_id) &&
    Number.isInteger(record.display_order) &&
    Number(record.display_order) >= 0 &&
    Number(record.display_order) <= 9999 &&
    typeof record.is_active === 'boolean' &&
    isIsoTimestamp(record.created_at) &&
    isIsoTimestamp(record.updated_at)
  )
}

function isStep(value: unknown): value is TroubleshootingStep {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isUuid(record.step_id) &&
    isStepType(record.step_type) &&
    isRequiredText(record.prompt, 500) &&
    isOptionalText(record.check_method, 500) &&
    isOptionalText(record.caution_note, 500)
  )
}

function isBranch(value: unknown): value is TroubleshootingBranch {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isUuid(record.branch_id) &&
    isUuid(record.from_step_id) &&
    isAnswer(record.answer) &&
    isUuid(record.to_step_id)
  )
}

function hasValidGraph(guide: TroubleshootingGuide): boolean {
  const stepById = new Map(guide.steps.map((step) => [step.step_id, step]))
  if (
    stepById.size !== guide.steps.length ||
    !stepById.has(guide.start_step_id)
  ) {
    return false
  }

  const branchIds = new Set<string>()
  const outgoing = new Map<
    string,
    Map<TroubleshootingAnswer, TroubleshootingBranch>
  >()
  guide.steps.forEach((step) => outgoing.set(step.step_id, new Map()))
  for (const branch of guide.branches) {
    if (
      branchIds.has(branch.branch_id) ||
      !stepById.has(branch.from_step_id) ||
      !stepById.has(branch.to_step_id)
    ) {
      return false
    }
    branchIds.add(branch.branch_id)
    const answers = outgoing.get(branch.from_step_id)
    if (!answers || answers.has(branch.answer)) return false
    answers.set(branch.answer, branch)
  }

  for (const step of guide.steps) {
    const answers = outgoing.get(step.step_id)
    if (!answers) return false
    if (step.step_type === 'question') {
      if (
        answers.size !== REQUIRED_ANSWERS.size ||
        [...REQUIRED_ANSWERS].some((answer) => !answers.has(answer))
      ) {
        return false
      }
      const unknownTarget = stepById.get(answers.get('unknown')!.to_step_id)
      if (unknownTarget?.step_type !== 'handoff') return false
    } else if (answers.size !== 0) {
      return false
    }
  }

  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (stepId: string): boolean => {
    if (visiting.has(stepId)) return false
    if (visited.has(stepId)) return true
    visiting.add(stepId)
    const targets = outgoing.get(stepId)
    if (!targets) return false
    for (const branch of targets.values()) {
      if (!visit(branch.to_step_id)) return false
    }
    visiting.delete(stepId)
    visited.add(stepId)
    return true
  }
  return visit(guide.start_step_id) && visited.size === guide.steps.length
}

function isGuide(value: unknown): value is TroubleshootingGuide {
  if (!isGuideSummary(value)) return false
  const record = value as unknown as Record<string, unknown>
  if (
    !Array.isArray(record.steps) ||
    record.steps.length < 1 ||
    record.steps.length > 100 ||
    !record.steps.every(isStep) ||
    !Array.isArray(record.branches) ||
    record.branches.length > 300 ||
    !record.branches.every(isBranch)
  ) {
    return false
  }
  return hasValidGraph(value as TroubleshootingGuide)
}

function isGuideListResponse(
  value: unknown,
): value is TroubleshootingGuideListResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    record.items.every(isGuideSummary) &&
    Number.isInteger(record.total) &&
    Number(record.total) >= 0 &&
    Number.isInteger(record.limit) &&
    Number(record.limit) >= 1 &&
    Number(record.limit) <= 100 &&
    Number.isInteger(record.offset) &&
    Number(record.offset) >= 0 &&
    record.items.length <= Number(record.limit) &&
    record.items.length <= Number(record.total)
  )
}

async function fetchTroubleshootingGuideList(
  query: URLSearchParams,
  options: TroubleshootingListRequestOptions,
): Promise<TroubleshootingGuideListResponse> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(
    `${baseUrl}/troubleshooting-guides?${query}`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new TroubleshootingApiError(
      `Troubleshooting API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isGuideListResponse(payload)) {
    throw new TroubleshootingApiError(
      'Troubleshooting API returned an invalid list response',
    )
  }
  return payload
}

export async function fetchTroubleshootingGuides(
  equipmentId: string,
  options: TroubleshootingListRequestOptions = {},
): Promise<TroubleshootingGuideListResponse> {
  if (!isUuid(equipmentId)) {
    throw new TroubleshootingApiError('Troubleshooting equipment ID is invalid')
  }
  const query = new URLSearchParams({
    equipment_id: equipmentId,
    limit: '100',
    offset: '0',
  })
  if (options.isActive !== undefined) {
    query.set('is_active', String(options.isActive))
  }
  const payload = await fetchTroubleshootingGuideList(query, options)
  if (
    payload.items.some(
      (guide) =>
        guide.equipment_id !== equipmentId ||
        (options.isActive !== undefined &&
          guide.is_active !== options.isActive),
    )
  ) {
    throw new TroubleshootingApiError(
      'Troubleshooting API returned an invalid list response',
    )
  }
  return payload
}

export async function fetchTroubleshootingGuideCatalog(
  options: TroubleshootingListRequestOptions = {},
): Promise<TroubleshootingGuideListResponse> {
  const query = new URLSearchParams({ limit: '100', offset: '0' })
  if (options.isActive !== undefined) {
    query.set('is_active', String(options.isActive))
  }
  const payload = await fetchTroubleshootingGuideList(query, options)
  if (
    options.isActive !== undefined &&
    payload.items.some((guide) => guide.is_active !== options.isActive)
  ) {
    throw new TroubleshootingApiError(
      'Troubleshooting API returned an invalid list response',
    )
  }
  return payload
}

export async function fetchTroubleshootingGuide(
  guideId: string,
  options: TroubleshootingRequestOptions = {},
): Promise<TroubleshootingGuide> {
  if (!isUuid(guideId)) {
    throw new TroubleshootingApiError('Troubleshooting guide ID is invalid')
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(
    `${baseUrl}/troubleshooting-guides/${guideId}`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new TroubleshootingApiError(
      `Troubleshooting API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isGuide(payload) || payload.id !== guideId) {
    throw new TroubleshootingApiError(
      'Troubleshooting API returned an invalid guide response',
    )
  }
  return payload
}

export async function createTroubleshootingGuide(
  input: TroubleshootingGuideCreateInput,
  options: TroubleshootingRequestOptions = {},
): Promise<TroubleshootingGuide> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(
    `${baseUrl}/troubleshooting-guides`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new TroubleshootingApiError(
      `Troubleshooting API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (
    !isGuide(payload) ||
    payload.equipment_id !== input.equipment_id ||
    payload.symptom !== input.symptom.trim() ||
    payload.start_step_id !== input.start_step_id ||
    payload.display_order !== input.display_order ||
    payload.is_active !== input.is_active
  ) {
    throw new TroubleshootingApiError(
      'Troubleshooting API returned an invalid guide response',
    )
  }
  return payload
}

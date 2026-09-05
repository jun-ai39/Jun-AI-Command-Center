import type { InspectionTemplateItem } from '../inspection-templates/types'
import type { InspectionJudgment, InspectionRecordItemInput } from './types'

export type InspectionValueMap = Readonly<Record<string, string>>

export const MAX_INSPECTION_ABSOLUTE_VALUE = 999_999_999

export function getInspectionLiveJudgment(
  item: InspectionTemplateItem,
  value: string,
): InspectionJudgment | null {
  if (item.input_type === 'status') {
    return value === 'normal' || value === 'abnormal' ? value : null
  }
  if (value.trim() === '') return null
  const numberValue = Number(value)
  if (
    !Number.isFinite(numberValue) ||
    item.normal_min === null ||
    item.normal_max === null
  ) {
    return null
  }
  return item.normal_min <= numberValue && numberValue <= item.normal_max
    ? 'normal'
    : 'abnormal'
}

export function buildInspectionRecordItems(
  items: readonly InspectionTemplateItem[],
  values: InspectionValueMap,
):
  | { readonly ok: true; readonly items: readonly InspectionRecordItemInput[] }
  | { readonly ok: false; readonly errors: readonly string[] } {
  const errors: string[] = []
  const inputs: InspectionRecordItemInput[] = []

  items.forEach((item) => {
    const value = values[item.id]?.trim() ?? ''
    if (item.input_type === 'number') {
      const numberValue = Number(value)
      if (
        value === '' ||
        !Number.isFinite(numberValue) ||
        Math.abs(numberValue) > MAX_INSPECTION_ABSOLUTE_VALUE
      ) {
        errors.push(`${item.name}の数値を正しく入力してください。`)
        return
      }
      inputs.push({
        templateItemId: item.id,
        numberValue,
        statusValue: null,
      })
      return
    }

    if (value !== 'normal' && value !== 'abnormal') {
      errors.push(`${item.name}の判定を選択してください。`)
      return
    }
    inputs.push({
      templateItemId: item.id,
      numberValue: null,
      statusValue: value,
    })
  })

  return errors.length > 0 ? { ok: false, errors } : { ok: true, items: inputs }
}

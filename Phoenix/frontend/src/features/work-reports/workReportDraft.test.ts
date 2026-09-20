import { describe, expect, it, vi } from 'vitest'

import type { WorkReportFormValues } from './types'
import { TEST_DEPARTMENT_ID, TEST_EQUIPMENT_ID } from './testFixtures'
import {
  clearWorkReportDraft,
  createDefaultWorkReportDraft,
  isWorkReportDraftEmpty,
  loadWorkReportDraft,
  saveWorkReportDraft,
  WORK_REPORT_DRAFT_STORAGE_KEY,
} from './workReportDraft'

const defaultDate = '2026-08-21'
const draft: WorkReportFormValues = {
  workDate: '2026-08-20',
  departmentId: TEST_DEPARTMENT_ID,
  equipmentId: TEST_EQUIPMENT_ID,
  phenomenon: '搬送部から異音',
  cause: 'ベルト張力の低下',
  workContent: '架空設備のベルト張力を調整',
  progress: 'completed',
}

describe('Work report draft', () => {
  it('saves, restores, and clears unfinished seven-field input', () => {
    let storedValue: string | null = null
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn((_key: string, value: string) => {
        storedValue = value
      }),
      removeItem: vi.fn(() => {
        storedValue = null
      }),
    }

    expect(saveWorkReportDraft(draft, storage)).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      WORK_REPORT_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    )
    expect(loadWorkReportDraft(storage, defaultDate)).toEqual(draft)
    expect(clearWorkReportDraft(storage)).toBe(true)
    expect(loadWorkReportDraft(storage, defaultDate)).toEqual(
      createDefaultWorkReportDraft(defaultDate),
    )
  })

  it('removes storage when the form returns to its default', () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() }
    const emptyDraft = createDefaultWorkReportDraft(defaultDate)
    expect(isWorkReportDraftEmpty(emptyDraft, defaultDate)).toBe(true)
    expect(saveWorkReportDraft(emptyDraft, storage, defaultDate)).toBe(true)
    expect(storage.removeItem).toHaveBeenCalledWith(
      WORK_REPORT_DRAFT_STORAGE_KEY,
    )
  })

  it('safely imports progress from the former result draft field', () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          workDate: '2026-08-20',
          departmentId: TEST_DEPARTMENT_ID,
          equipmentId: TEST_EQUIPMENT_ID,
          workContent: '旧下書きの作業内容',
          result: 'continued',
        }),
      ),
    }
    expect(loadWorkReportDraft(storage, defaultDate)).toEqual({
      workDate: '2026-08-20',
      departmentId: TEST_DEPARTMENT_ID,
      equipmentId: TEST_EQUIPMENT_ID,
      phenomenon: '',
      cause: '',
      workContent: '旧下書きの作業内容',
      progress: 'continued',
    })
  })

  it('falls back safely when stored JSON is broken or storage is blocked', () => {
    expect(
      loadWorkReportDraft({ getItem: vi.fn(() => '{broken') }, defaultDate),
    ).toEqual(createDefaultWorkReportDraft(defaultDate))
    expect(
      saveWorkReportDraft(draft, {
        setItem: vi.fn(() => {
          throw new Error('blocked')
        }),
        removeItem: vi.fn(),
      }),
    ).toBe(false)
  })
})

it('retains the source inspection when restoring a draft', () => {
  const linked = {
    ...draft,
    sourceInspectionId: '50000000-0000-4000-8000-000000000001',
  }
  const storage = { getItem: () => JSON.stringify(linked) }
  expect(loadWorkReportDraft(storage, defaultDate)).toEqual(linked)
})

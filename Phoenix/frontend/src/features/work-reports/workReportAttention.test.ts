import { describe, expect, it } from 'vitest'

import { createAttentionProgressSearchFilters } from './workReportAttention'

describe('createAttentionProgressSearchFilters', () => {
  it('keeps only the selected attention progress', () => {
    expect(createAttentionProgressSearchFilters('continued')).toEqual({
      workDate: null,
      departmentId: null,
      workContentQuery: null,
      progress: 'continued',
    })
    expect(createAttentionProgressSearchFilters('follow_up')).toEqual({
      workDate: null,
      departmentId: null,
      workContentQuery: null,
      progress: 'follow_up',
    })
  })
})

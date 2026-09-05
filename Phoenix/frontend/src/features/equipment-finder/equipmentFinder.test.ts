import { describe, expect, it } from 'vitest'

import type { EquipmentFinderData } from './types'
import {
  buildEquipmentFinderGroups,
  filterEquipmentForKeyword,
} from './equipmentFinder'

const timestamp = '2026-08-22T01:00:00+00:00'
const data: EquipmentFinderData = {
  departments: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      name: '菓子パン',
      display_order: 10,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      name: '食パン',
      display_order: 20,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ],
  manufacturers: [
    {
      id: '20000000-0000-4000-8000-000000000001',
      name: '架空Aメーカー',
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      name: '架空B工業',
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ],
  equipment: [
    {
      equipment_id: '30000000-0000-4000-8000-000000000001',
      department_id: '10000000-0000-4000-8000-000000000001',
      manufacturer_id: '20000000-0000-4000-8000-000000000001',
      name: '包装機',
      equipment_number: 'No.2',
      model_number: 'TEST-200',
      photo_path: null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      equipment_id: '30000000-0000-4000-8000-000000000002',
      department_id: '10000000-0000-4000-8000-000000000002',
      manufacturer_id: '20000000-0000-4000-8000-000000000002',
      name: 'ミキサー',
      equipment_number: 'M-1',
      model_number: 'MIX-50',
      photo_path: null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ],
}

describe('equipment finder', () => {
  it.each([
    ['包装機', '30000000-0000-4000-8000-000000000001'],
    ['ｎｏ．２', '30000000-0000-4000-8000-000000000001'],
    ['架空Aメーカー', '30000000-0000-4000-8000-000000000001'],
    ['test-200', '30000000-0000-4000-8000-000000000001'],
    ['架空a test', '30000000-0000-4000-8000-000000000001'],
    ['MIX-50', '30000000-0000-4000-8000-000000000002'],
  ])('finds equipment with keyword %s', (keyword, equipmentId) => {
    expect(
      filterEquipmentForKeyword(data, keyword).map((item) => item.equipment_id),
    ).toEqual([equipmentId])
  })

  it('returns an empty list for an unmatched keyword', () => {
    expect(filterEquipmentForKeyword(data, '存在しない設備')).toEqual([])
  })

  it('builds department and manufacturer branches from matches only', () => {
    const matches = filterEquipmentForKeyword(data, '包装機')
    const groups = buildEquipmentFinderGroups(data, matches)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.department.name).toBe('菓子パン')
    expect(groups[0]?.manufacturerGroups[0]?.manufacturer.name).toBe(
      '架空Aメーカー',
    )
    expect(groups[0]?.manufacturerGroups[0]?.equipment).toEqual(matches)
  })
})

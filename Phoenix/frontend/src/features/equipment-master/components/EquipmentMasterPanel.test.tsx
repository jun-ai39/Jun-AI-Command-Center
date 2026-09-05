import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../hooks/useEquipmentMaster', () => ({
  useEquipmentMaster: () => {
    const timestamp = '2026-08-20T01:00:00+00:00'
    const department = {
      id: '10000000-0000-4000-8000-000000000001',
      name: '菓子パン',
      display_order: 10,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    }
    const manufacturer = {
      id: '20000000-0000-4000-8000-000000000001',
      name: '架空Aメーカー',
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    }
    const equipment = {
      equipment_id: '30000000-0000-4000-8000-000000000002',
      department_id: department.id,
      manufacturer_id: manufacturer.id,
      name: '包装機',
      equipment_number: 'No.2',
      model_number: 'TEST-200',
      photo_path: null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    }
    return {
      state: {
        phase: 'ready',
        data: {
          departments: [department],
          departmentTotal: 6,
          manufacturers: [manufacturer],
          manufacturerTotal: 1,
          equipment: [equipment],
          equipmentTotal: 1,
        },
      },
      manufacturerSaveState: { phase: 'idle' },
      equipmentSaveState: { phase: 'idle' },
      reload: vi.fn(),
      saveManufacturer: vi.fn(),
      saveEquipment: vi.fn(),
      resetManufacturerSave: vi.fn(),
      resetEquipmentSave: vi.fn(),
    }
  },
}))

import { EquipmentMasterPanel } from './EquipmentMasterPanel'

describe('EquipmentMasterPanel', () => {
  it('shows the two-step registration flow and active equipment tree', () => {
    const markup = renderToStaticMarkup(<EquipmentMasterPanel />)

    expect(markup).toContain('ADMIN DATA / STEP 92')
    expect(markup).toContain('メーカーを登録')
    expect(markup).toContain('id="equipment-master-manufacturer-name"')
    expect(markup).toContain('設備を登録')
    expect(markup).toContain('id="equipment-master-department"')
    expect(markup).toContain('id="equipment-master-equipment-name"')
    expect(markup).toContain('菓子パン')
    expect(markup).toContain('架空Aメーカー')
    expect(markup).toContain('包装機 No.2')
    expect(markup).toContain('TEST-200')
    expect(markup).toContain('30000000-0000-4000-8000-000000000002')
    expect(markup).toContain('設備カルテを見る')
    expect(markup).toContain('INSPECTION MASTER / STEP 96')
    expect(markup).toContain('設備別点検項目マスター')
    expect(markup).toContain('id="inspection-template-equipment"')
  })
})

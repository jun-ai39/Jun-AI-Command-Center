import type { WorkReportEquipmentOptionsState } from './types'

export const TEST_DEPARTMENT_ID = '10000000-0000-4000-8000-000000000001'
export const TEST_MANUFACTURER_ID = '20000000-0000-4000-8000-000000000001'
export const TEST_EQUIPMENT_ID = '30000000-0000-4000-8000-000000000001'

export const READY_EQUIPMENT_OPTIONS: WorkReportEquipmentOptionsState = {
  phase: 'ready',
  departments: [
    {
      id: TEST_DEPARTMENT_ID,
      name: '菓子パン',
      display_order: 10,
      is_active: true,
      created_at: '2026-08-20T01:00:00+00:00',
      updated_at: '2026-08-20T01:00:00+00:00',
    },
  ],
  equipment: [
    {
      equipment_id: TEST_EQUIPMENT_ID,
      department_id: TEST_DEPARTMENT_ID,
      manufacturer_id: TEST_MANUFACTURER_ID,
      name: '包装機',
      equipment_number: 'No.2',
      model_number: 'TEST-200',
      photo_path: null,
      is_active: true,
      created_at: '2026-08-20T01:00:00+00:00',
      updated_at: '2026-08-20T01:00:00+00:00',
    },
  ],
}

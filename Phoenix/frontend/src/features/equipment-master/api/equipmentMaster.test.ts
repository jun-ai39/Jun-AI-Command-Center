import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createEquipment,
  createManufacturer,
  EquipmentMasterApiError,
  fetchActiveDepartments,
  fetchActiveEquipment,
  fetchActiveManufacturers,
  fetchDepartments,
  fetchManufacturers,
} from './equipmentMaster'

afterEach(() => {
  vi.unstubAllGlobals()
})

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

function listResponse(item: unknown) {
  return { items: [item], total: 1, limit: 100, offset: 0 }
}

describe('equipment master list API', () => {
  it('loads master lists and active work-report choices', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(listResponse(department)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(listResponse(manufacturer)), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(listResponse(equipment)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(listResponse(department)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(listResponse(manufacturer)), {
          status: 200,
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchDepartments({ baseUrl: 'https://api.example.test/' }),
    ).resolves.toEqual(listResponse(department))
    await expect(
      fetchManufacturers({ baseUrl: 'https://api.example.test/' }),
    ).resolves.toEqual(listResponse(manufacturer))
    await expect(
      fetchActiveEquipment({ baseUrl: 'https://api.example.test/' }),
    ).resolves.toEqual(listResponse(equipment))
    await expect(
      fetchActiveDepartments({ baseUrl: 'https://api.example.test/' }),
    ).resolves.toEqual(listResponse(department))
    await expect(
      fetchActiveManufacturers({ baseUrl: 'https://api.example.test/' }),
    ).resolves.toEqual(listResponse(manufacturer))

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/departments?limit=100&offset=0',
      'https://api.example.test/manufacturers?limit=100&offset=0',
      'https://api.example.test/equipment?limit=100&offset=0&is_active=true',
      'https://api.example.test/departments?limit=100&offset=0&is_active=true',
      'https://api.example.test/manufacturers?limit=100&offset=0&is_active=true',
    ])
  })

  it('rejects an invalid master response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify(listResponse({ ...department, id: 'invalid' })),
            { status: 200 },
          ),
        ),
    )

    await expect(
      fetchDepartments({ baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(EquipmentMasterApiError)
  })
})

describe('equipment master create API', () => {
  it('registers a normalized manufacturer', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(manufacturer), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createManufacturer(
        { name: '  架空Aメーカー  ' },
        { baseUrl: 'https://api.example.test/' },
      ),
    ).resolves.toEqual(manufacturer)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/manufacturers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '架空Aメーカー', is_active: true }),
      }),
    )
  })

  it('registers normalized equipment without a photo', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(equipment), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createEquipment(
        {
          departmentId: department.id,
          manufacturerId: manufacturer.id,
          name: '  包装機  ',
          equipmentNumber: '  No.2  ',
          modelNumber: '  TEST-200  ',
        },
        { baseUrl: 'https://api.example.test/' },
      ),
    ).resolves.toEqual(equipment)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/equipment',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          department_id: department.id,
          manufacturer_id: manufacturer.id,
          name: '包装機',
          equipment_number: 'No.2',
          model_number: 'TEST-200',
          photo_path: null,
          is_active: true,
        }),
      }),
    )
  })

  it('preserves a conflict status for a duplicate manufacturer', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 409 })),
    )

    await expect(
      createManufacturer(
        { name: '架空Aメーカー' },
        { baseUrl: 'https://api.example.test' },
      ),
    ).rejects.toMatchObject({ status: 409 })
  })
})

import type {
  Department,
  Equipment,
  EquipmentMasterCollection,
  Manufacturer,
} from '../types'
import { getEquipmentDisplayName } from './equipmentMasterView'

type ManufacturerGroup = {
  readonly manufacturer: Manufacturer | null
  readonly equipment: readonly Equipment[]
}

type DepartmentGroup = {
  readonly department: Department
  readonly manufacturerGroups: readonly ManufacturerGroup[]
  readonly equipmentCount: number
}

type EquipmentTreeProps = {
  readonly data: EquipmentMasterCollection
  readonly latestEquipment: Equipment | null
  readonly onOpenProfile: (equipment: Equipment) => void
}

function buildDepartmentGroups(
  data: EquipmentMasterCollection,
): readonly DepartmentGroup[] {
  const manufacturerById = new Map(
    data.manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]),
  )
  return data.departments
    .filter((department) => department.is_active)
    .map((department) => {
      const departmentEquipment = data.equipment.filter(
        (item) => item.department_id === department.id && item.is_active,
      )
      const equipmentByManufacturer = new Map<string, Equipment[]>()
      departmentEquipment.forEach((item) => {
        const items = equipmentByManufacturer.get(item.manufacturer_id) ?? []
        items.push(item)
        equipmentByManufacturer.set(item.manufacturer_id, items)
      })
      const manufacturerGroups = [...equipmentByManufacturer.entries()]
        .map(([manufacturerId, equipment]) => ({
          manufacturer: manufacturerById.get(manufacturerId) ?? null,
          equipment,
        }))
        .sort((left, right) =>
          (left.manufacturer?.name ?? '未登録メーカー').localeCompare(
            right.manufacturer?.name ?? '未登録メーカー',
            'ja',
          ),
        )
      return {
        department,
        manufacturerGroups,
        equipmentCount: departmentEquipment.length,
      }
    })
}

export function EquipmentTree({
  data,
  latestEquipment,
  onOpenProfile,
}: EquipmentTreeProps) {
  const departmentGroups = buildDepartmentGroups(data)

  return (
    <article className="equipment-master-tree-card">
      <div className="equipment-master-tree-heading">
        <div>
          <span>EQUIPMENT TREE</span>
          <h4>使用中の設備</h4>
        </div>
        <small>{data.equipment.length}件表示</small>
      </div>
      <div className="equipment-master-tree">
        {departmentGroups.map((group) => (
          <details
            key={group.department.id}
            open={
              group.department.id === latestEquipment?.department_id ||
              group.equipmentCount > 0
            }
          >
            <summary>
              <span>{group.department.name}</span>
              <small>{group.equipmentCount}件</small>
            </summary>
            {group.manufacturerGroups.length === 0 ? (
              <p className="equipment-master-empty-branch">
                登録設備はありません。
              </p>
            ) : (
              group.manufacturerGroups.map((manufacturerGroup) => (
                <div
                  className="equipment-master-manufacturer-group"
                  key={
                    manufacturerGroup.manufacturer?.id ??
                    manufacturerGroup.equipment[0]?.manufacturer_id
                  }
                >
                  <h5>
                    {manufacturerGroup.manufacturer?.name ?? '未登録メーカー'}
                  </h5>
                  <ul>
                    {manufacturerGroup.equipment.map((item) => (
                      <li key={item.equipment_id}>
                        <div>
                          <strong>{getEquipmentDisplayName(item)}</strong>
                          <span>{item.model_number ?? '型式未登録'}</span>
                        </div>
                        <code>{item.equipment_id}</code>
                        <button
                          type="button"
                          onClick={() => onOpenProfile(item)}
                        >
                          設備カルテを見る
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </details>
        ))}
      </div>
    </article>
  )
}

import { useEffect, useMemo, useState } from 'react'

import { EquipmentProfilePanel } from '../../equipment-profile/components/EquipmentProfilePanel'
import { InspectionTemplatePanel } from '../../inspection-templates/components/InspectionTemplatePanel'
import { useEquipmentMaster } from '../hooks/useEquipmentMaster'
import { EquipmentRegistrationForm } from './EquipmentRegistrationForm'
import { EquipmentTree } from './EquipmentTree'
import { ManufacturerRegistrationForm } from './ManufacturerRegistrationForm'
import './EquipmentMasterPanel.css'

type EquipmentMasterPanelProps = {
  readonly onEquipmentSaved?: () => void
  readonly onInspectionTemplateChanged?: () => void
}

export function EquipmentMasterPanel({
  onEquipmentSaved,
  onInspectionTemplateChanged,
}: EquipmentMasterPanelProps) {
  const {
    state,
    manufacturerSaveState,
    equipmentSaveState,
    reload,
    saveManufacturer,
    saveEquipment,
    resetManufacturerSave,
    resetEquipmentSave,
  } = useEquipmentMaster()
  const [preferredManufacturerId, setPreferredManufacturerId] = useState('')
  const [inspectionTemplateRefreshToken, setInspectionTemplateRefreshToken] =
    useState(0)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(
    null,
  )
  const activeDepartments = useMemo(
    () =>
      state.phase === 'ready'
        ? state.data.departments.filter((item) => item.is_active)
        : [],
    [state],
  )
  const activeManufacturers = useMemo(
    () =>
      state.phase === 'ready'
        ? state.data.manufacturers.filter((item) => item.is_active)
        : [],
    [state],
  )

  useEffect(() => {
    if (selectedEquipmentId) {
      document
        .getElementById('equipment-profile')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedEquipmentId])

  async function handleSaveEquipment(
    input: Parameters<typeof saveEquipment>[0],
  ) {
    const saved = await saveEquipment(input)
    if (saved) {
      onEquipmentSaved?.()
    }
    return saved
  }

  function handleInspectionTemplateChanged() {
    setInspectionTemplateRefreshToken((current) => current + 1)
    onInspectionTemplateChanged?.()
  }

  if (state.phase === 'loading') {
    return (
      <section className="equipment-master-panel" aria-busy="true">
        <div className="equipment-master-loading" role="status">
          設備マスターを読み込んでいます…
        </div>
      </section>
    )
  }

  if (state.phase === 'error') {
    return (
      <section className="equipment-master-panel">
        <div className="equipment-master-load-error" role="alert">
          <strong>設備マスターを読み込めませんでした</strong>
          <p>FastAPIの起動状態と接続先を確認してください。</p>
          <button type="button" onClick={reload}>
            もう一度読み込む
          </button>
        </div>
      </section>
    )
  }

  const latestEquipment =
    equipmentSaveState.phase === 'saved' ? equipmentSaveState.item : null
  const selectedEquipment = selectedEquipmentId
    ? (state.data.equipment.find(
        (item) => item.equipment_id === selectedEquipmentId,
      ) ?? null)
    : null
  const selectedDepartment = selectedEquipment
    ? (state.data.departments.find(
        (item) => item.id === selectedEquipment.department_id,
      ) ?? null)
    : null
  const selectedManufacturer = selectedEquipment
    ? (state.data.manufacturers.find(
        (item) => item.id === selectedEquipment.manufacturer_id,
      ) ?? null)
    : null

  return (
    <section
      className="equipment-master-panel"
      aria-labelledby="equipment-master-title"
    >
      <div className="equipment-master-heading">
        <div>
          <p className="eyebrow">ADMIN DATA / STEP 92</p>
          <h3 id="equipment-master-title">設備マスター</h3>
        </div>
        <p>部門 → メーカー → 設備</p>
      </div>

      <div className="equipment-master-counts" aria-label="登録件数">
        <div>
          <span>部門</span>
          <strong>{state.data.departmentTotal}</strong>
          <small>件</small>
        </div>
        <div>
          <span>メーカー</span>
          <strong>{state.data.manufacturerTotal}</strong>
          <small>件</small>
        </div>
        <div>
          <span>使用中設備</span>
          <strong>{state.data.equipmentTotal}</strong>
          <small>件</small>
        </div>
      </div>

      <div className="equipment-master-workspace">
        <div className="equipment-master-forms">
          <ManufacturerRegistrationForm
            saveState={manufacturerSaveState}
            onSave={saveManufacturer}
            onSaved={(manufacturer) =>
              setPreferredManufacturerId(manufacturer.id)
            }
            onResetSave={resetManufacturerSave}
          />
          <EquipmentRegistrationForm
            departments={activeDepartments}
            manufacturers={activeManufacturers}
            preferredManufacturerId={preferredManufacturerId}
            saveState={equipmentSaveState}
            onSave={handleSaveEquipment}
            onResetSave={resetEquipmentSave}
          />
        </div>

        <EquipmentTree
          data={state.data}
          latestEquipment={latestEquipment}
          onOpenProfile={(equipment) =>
            setSelectedEquipmentId(equipment.equipment_id)
          }
        />
      </div>

      <InspectionTemplatePanel
        equipment={state.data.equipment}
        onTemplateChanged={handleInspectionTemplateChanged}
      />

      {selectedEquipment && (
        <EquipmentProfilePanel
          key={selectedEquipment.equipment_id}
          equipment={selectedEquipment}
          departmentName={selectedDepartment?.name ?? '部門未登録'}
          manufacturerName={selectedManufacturer?.name ?? 'メーカー未登録'}
          templateRefreshToken={inspectionTemplateRefreshToken}
          onClose={() => setSelectedEquipmentId(null)}
        />
      )}
    </section>
  )
}

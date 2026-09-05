import { useState } from 'react'

import type { Equipment } from '../../equipment-master/types'
import { getEquipmentDisplayName } from '../../equipment-master/components/equipmentMasterView'
import { useInspectionTemplates } from '../hooks/useInspectionTemplates'
import type {
  InspectionTemplateCollectionState,
  InspectionTemplateCreateInput,
  InspectionTemplateGuideSaveState,
  InspectionTemplateGuideUpdateInput,
  InspectionTemplateItem,
  InspectionTemplateSaveState,
} from '../types'
import { InspectionTemplateForm } from './InspectionTemplateForm'
import { InspectionTemplateList } from './InspectionTemplateList'
import './InspectionTemplatePanel.css'

type InspectionTemplatePanelProps = {
  readonly equipment: readonly Equipment[]
  readonly onTemplateChanged?: () => void
}

type InspectionTemplateWorkspaceContentProps = {
  readonly equipment: Equipment
  readonly state: InspectionTemplateCollectionState
  readonly saveState: InspectionTemplateSaveState
  readonly guideSaveState: InspectionTemplateGuideSaveState
  readonly onSave: (
    input: InspectionTemplateCreateInput,
  ) => Promise<InspectionTemplateItem | null>
  readonly onSaveGuide: (
    input: InspectionTemplateGuideUpdateInput,
  ) => Promise<InspectionTemplateItem | null>
  readonly onResetSave: () => void
  readonly onResetGuideSave: () => void
  readonly onReload: () => void
}

export function InspectionTemplateWorkspaceContent({
  equipment,
  state,
  saveState,
  guideSaveState,
  onSave,
  onSaveGuide,
  onResetSave,
  onResetGuideSave,
  onReload,
}: InspectionTemplateWorkspaceContentProps) {
  return (
    <div className="inspection-template-workspace">
      <InspectionTemplateForm
        equipment={equipment}
        canSave={state.phase === 'ready'}
        saveState={saveState}
        onSave={onSave}
        onResetSave={onResetSave}
      />
      <InspectionTemplateList
        state={state}
        guideSaveState={guideSaveState}
        onReload={onReload}
        onSaveGuide={onSaveGuide}
        onResetGuideSave={onResetGuideSave}
      />
    </div>
  )
}

function InspectionTemplateWorkspace({
  equipment,
  onTemplateChanged,
}: {
  readonly equipment: Equipment
  readonly onTemplateChanged?: () => void
}) {
  const {
    state,
    saveState,
    guideSaveState,
    save,
    resetSave,
    updateGuide,
    resetGuideSave,
    reload,
  } = useInspectionTemplates(equipment.equipment_id)

  async function saveAndNotify(input: InspectionTemplateCreateInput) {
    const item = await save(input)
    if (item) onTemplateChanged?.()
    return item
  }

  async function saveGuideAndNotify(input: InspectionTemplateGuideUpdateInput) {
    const item = await updateGuide(input)
    if (item) onTemplateChanged?.()
    return item
  }

  return (
    <InspectionTemplateWorkspaceContent
      equipment={equipment}
      state={state}
      saveState={saveState}
      guideSaveState={guideSaveState}
      onSave={saveAndNotify}
      onSaveGuide={saveGuideAndNotify}
      onResetSave={resetSave}
      onResetGuideSave={resetGuideSave}
      onReload={reload}
    />
  )
}

export function InspectionTemplatePanel({
  equipment,
  onTemplateChanged,
}: InspectionTemplatePanelProps) {
  const activeEquipment = equipment.filter((item) => item.is_active)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(
    activeEquipment.at(0)?.equipment_id ?? '',
  )
  const selectedEquipment =
    activeEquipment.find((item) => item.equipment_id === selectedEquipmentId) ??
    activeEquipment.at(0)

  return (
    <section
      className="inspection-template-panel"
      aria-labelledby="inspection-template-title"
    >
      <div className="inspection-template-heading">
        <div>
          <p className="eyebrow">INSPECTION MASTER / STEP 96</p>
          <h3 id="inspection-template-title">設備別点検項目マスター</h3>
        </div>
        <p>設備ごとに毎日・毎週・毎月の点検項目を設定</p>
      </div>

      {selectedEquipment ? (
        <>
          <label
            className="inspection-template-equipment-select"
            htmlFor="inspection-template-equipment"
          >
            <span>設定する設備</span>
            <select
              id="inspection-template-equipment"
              value={selectedEquipment.equipment_id}
              onChange={(event) => setSelectedEquipmentId(event.target.value)}
            >
              {activeEquipment.map((item) => (
                <option key={item.equipment_id} value={item.equipment_id}>
                  {getEquipmentDisplayName(item)}
                </option>
              ))}
            </select>
          </label>
          <InspectionTemplateWorkspace
            key={selectedEquipment.equipment_id}
            equipment={selectedEquipment}
            onTemplateChanged={onTemplateChanged}
          />
        </>
      ) : (
        <p className="inspection-template-no-equipment">
          点検項目を設定する前に、使用中の設備を1件登録してください。
        </p>
      )}
    </section>
  )
}

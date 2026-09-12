import { useEffect, useMemo, useState } from 'react'

import { getEquipmentDisplayName } from '../../equipment-master/components/equipmentMasterView'
import type { Equipment } from '../../equipment-master/types'
import { EquipmentProfilePanel } from '../../equipment-profile/components/EquipmentProfilePanel'
import type { WorkReportGuideHandoffInput } from '../../work-reports/types'
import {
  buildEquipmentFinderGroups,
  filterEquipmentForKeyword,
} from '../equipmentFinder'
import { useEquipmentFinder } from '../hooks/useEquipmentFinder'
import type { EquipmentFinderState } from '../types'
import './EquipmentFinderPanel.css'

type EquipmentFinderContentProps = {
  readonly state: EquipmentFinderState
  readonly onReload: () => void
  readonly onStartWorkReport: (input: WorkReportGuideHandoffInput) => void
}

function EquipmentThumbnail({ equipment }: { readonly equipment: Equipment }) {
  const [didFail, setDidFail] = useState(false)
  const photoPath = didFail ? null : equipment.photo_path

  return photoPath ? (
    <img src={photoPath} alt="" onError={() => setDidFail(true)} />
  ) : (
    <span className="equipment-finder-photo-placeholder" aria-hidden="true">
      P
    </span>
  )
}

export function EquipmentFinderContent({
  state,
  onReload,
  onStartWorkReport,
}: EquipmentFinderContentProps) {
  const [keyword, setKeyword] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null,
  )

  const matchingEquipment = useMemo(
    () =>
      state.phase === 'ready'
        ? filterEquipmentForKeyword(state.data, keyword)
        : [],
    [keyword, state],
  )
  const departmentGroups = useMemo(
    () =>
      state.phase === 'ready'
        ? buildEquipmentFinderGroups(state.data, matchingEquipment)
        : [],
    [matchingEquipment, state],
  )

  useEffect(() => {
    if (selectedEquipment === null) {
      return
    }
    document
      .getElementById('equipment-finder-profile')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedEquipment])

  const hasKeyword = keyword.trim().length > 0
  const selectedDepartment =
    state.phase === 'ready' && selectedEquipment
      ? state.data.departments.find(
          (item) => item.id === selectedEquipment.department_id,
        )
      : null
  const selectedManufacturer =
    state.phase === 'ready' && selectedEquipment
      ? state.data.manufacturers.find(
          (item) => item.id === selectedEquipment.manufacturer_id,
        )
      : null

  return (
    <section
      className="equipment-finder-section"
      aria-labelledby="equipment-finder-title"
    >
      <div className="equipment-finder-panel">
        <div className="equipment-finder-heading">
          <div>
            <span>KNOWLEDGE / EQUIPMENT SEARCH</span>
            <h2 id="equipment-finder-title">設備を探す</h2>
          </div>
          <strong>部門 → メーカー → 設備</strong>
        </div>
        <p className="equipment-finder-intro">
          ツリーから設備を選ぶか、設備名・番号・メーカー・型式で検索すると、設備カルテを確認できます。
        </p>

        <div className="equipment-finder-search">
          <label htmlFor="equipment-finder-keyword">キーワード検索</label>
          <div>
            <input
              id="equipment-finder-keyword"
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="例：包装機 No.2 / 架空Aメーカー / TEST-200"
              autoComplete="off"
              disabled={state.phase !== 'ready'}
            />
            {hasKeyword && (
              <button type="button" onClick={() => setKeyword('')}>
                クリア
              </button>
            )}
          </div>
        </div>

        {state.phase === 'loading' && (
          <p className="equipment-finder-state" role="status">
            設備を読み込んでいます…
          </p>
        )}

        {state.phase === 'error' && (
          <div className="equipment-finder-state is-error" role="alert">
            <p>設備を読み込めませんでした。APIの接続状態を確認してください。</p>
            <button type="button" onClick={onReload}>
              もう一度読み込む
            </button>
          </div>
        )}

        {state.phase === 'ready' && state.data.equipment.length === 0 && (
          <p className="equipment-finder-state">
            使用中の設備はまだ登録されていません。
          </p>
        )}

        {state.phase === 'ready' && state.data.equipment.length > 0 && (
          <div className="equipment-finder-results">
            <div className="equipment-finder-result-summary" aria-live="polite">
              <strong>{hasKeyword ? '検索結果' : '使用中の設備'}</strong>
              <span>{matchingEquipment.length}件</span>
            </div>

            {matchingEquipment.length === 0 ? (
              <p className="equipment-finder-no-results">
                該当する設備はありません。キーワードを変えてお試しください。
              </p>
            ) : (
              <div className="equipment-finder-tree">
                {departmentGroups.map((departmentGroup, index) => (
                  <details
                    key={departmentGroup.department.id}
                    open={hasKeyword || index === 0}
                  >
                    <summary>
                      <span>{departmentGroup.department.name}</span>
                      <small>{departmentGroup.equipmentCount}件</small>
                    </summary>
                    <div className="equipment-finder-department-branches">
                      {departmentGroup.manufacturerGroups.map(
                        (manufacturerGroup) => (
                          <section key={manufacturerGroup.manufacturer.id}>
                            <h3>{manufacturerGroup.manufacturer.name}</h3>
                            <ul>
                              {manufacturerGroup.equipment.map((equipment) => (
                                <li key={equipment.equipment_id}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedEquipment(equipment)
                                    }
                                    aria-current={
                                      selectedEquipment?.equipment_id ===
                                      equipment.equipment_id
                                        ? 'true'
                                        : undefined
                                    }
                                  >
                                    <EquipmentThumbnail equipment={equipment} />
                                    <span className="equipment-finder-equipment-copy">
                                      <strong>
                                        {getEquipmentDisplayName(equipment)}
                                      </strong>
                                      <small>
                                        型式：
                                        {equipment.model_number ?? '未登録'}
                                      </small>
                                    </span>
                                    <span className="equipment-finder-open-label">
                                      設備カルテを開く
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ),
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedEquipment && selectedDepartment && selectedManufacturer && (
        <EquipmentProfilePanel
          sectionId="equipment-finder-profile"
          equipment={selectedEquipment}
          departmentName={selectedDepartment.name}
          manufacturerName={selectedManufacturer.name}
          onClose={() => setSelectedEquipment(null)}
          onStartWorkReport={onStartWorkReport}
        />
      )}
    </section>
  )
}

export function EquipmentFinderPanel({
  onStartWorkReport,
}: {
  readonly onStartWorkReport: (input: WorkReportGuideHandoffInput) => void
}) {
  const { state, reload } = useEquipmentFinder()
  return (
    <EquipmentFinderContent
      state={state}
      onReload={reload}
      onStartWorkReport={onStartWorkReport}
    />
  )
}

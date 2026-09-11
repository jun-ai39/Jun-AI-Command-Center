import { useEffect, useId, useRef, useState } from 'react'

import {
  deleteEquipmentPhoto,
  fetchEquipmentPhoto,
  MAX_EQUIPMENT_PHOTO_BYTES,
  uploadEquipmentPhoto,
} from '../../equipment-master/api/equipmentMaster'
import { getEquipmentDisplayName } from '../../equipment-master/components/equipmentMasterView'
import type { Equipment } from '../../equipment-master/types'

const ACCEPTED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type EquipmentPhotoPanelProps = {
  readonly equipment: Equipment
  readonly canManage?: boolean
  readonly onEquipmentChanged?: (equipment: Equipment) => void
}

type PhotoLoadState = 'empty' | 'loading' | 'ready' | 'error'

export function EquipmentPhotoPanel({
  equipment,
  canManage = false,
  onEquipmentChanged,
}: EquipmentPhotoPanelProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photoIdentifier, setPhotoIdentifier] = useState(equipment.photo_path)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<PhotoLoadState>(
    equipment.photo_path ? 'loading' : 'empty',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    readonly kind: 'success' | 'error'
    readonly message: string
  } | null>(null)

  useEffect(() => {
    if (!photoIdentifier) {
      return
    }

    const controller = new AbortController()
    let objectUrl: string | null = null
    void fetchEquipmentPhoto(equipment.equipment_id, {
      signal: controller.signal,
    })
      .then((photo) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(photo)
        setPhotoUrl(objectUrl)
        setLoadState('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPhotoUrl(null)
          setLoadState('error')
        }
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [equipment.equipment_id, photoIdentifier])

  async function handlePhotoSelection(file: File | undefined) {
    if (!file) return
    setFeedback(null)
    if (!ACCEPTED_PHOTO_TYPES.has(file.type)) {
      setFeedback({
        kind: 'error',
        message: 'JPEG・PNG・WebP形式の写真を選択してください。',
      })
      return
    }
    if (file.size > MAX_EQUIPMENT_PHOTO_BYTES) {
      setFeedback({
        kind: 'error',
        message: '写真は10MB以下にしてください。',
      })
      return
    }

    setIsSaving(true)
    try {
      const updated = await uploadEquipmentPhoto(equipment.equipment_id, file)
      setLoadState('loading')
      setPhotoIdentifier(updated.photo_path)
      setFeedback({
        kind: 'success',
        message: equipment.photo_path
          ? '設備写真を差し替えました。'
          : '設備写真を登録しました。',
      })
      onEquipmentChanged?.(updated)
    } catch {
      setFeedback({
        kind: 'error',
        message: '設備写真を保存できませんでした。API接続を確認してください。',
      })
    } finally {
      setIsSaving(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!window.confirm('この設備写真を削除しますか？')) return
    setFeedback(null)
    setIsSaving(true)
    try {
      await deleteEquipmentPhoto(equipment.equipment_id)
      const updated = { ...equipment, photo_path: null }
      setPhotoUrl(null)
      setLoadState('empty')
      setPhotoIdentifier(null)
      setFeedback({ kind: 'success', message: '設備写真を削除しました。' })
      onEquipmentChanged?.(updated)
    } catch {
      setFeedback({
        kind: 'error',
        message: '設備写真を削除できませんでした。API接続を確認してください。',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const hasPhoto = photoIdentifier !== null
  return (
    <div className="equipment-profile-photo">
      <div className="equipment-profile-photo-visual">
        {loadState === 'ready' && photoUrl ? (
          <img
            src={photoUrl}
            alt={`${getEquipmentDisplayName(equipment)}の設備写真`}
          />
        ) : (
          <div className="equipment-profile-photo-placeholder">
            <span aria-hidden="true">P</span>
            <strong>設備写真</strong>
            <small>
              {loadState === 'loading'
                ? '読み込み中…'
                : loadState === 'error'
                  ? '画像を表示できません'
                  : '未登録'}
            </small>
          </div>
        )}
      </div>

      {canManage && (
        <div className="equipment-profile-photo-controls">
          <input
            ref={inputRef}
            id={inputId}
            className="equipment-profile-photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isSaving}
            onChange={(event) =>
              void handlePhotoSelection(event.currentTarget.files?.[0])
            }
          />
          <label className={isSaving ? 'is-disabled' : ''} htmlFor={inputId}>
            {isSaving
              ? '処理中…'
              : hasPhoto
                ? '写真を差し替える'
                : '写真を登録する'}
          </label>
          {hasPhoto && (
            <button type="button" disabled={isSaving} onClick={handleDelete}>
              写真を削除
            </button>
          )}
          <small>JPEG・PNG・WebP／10MB以下</small>
          {feedback && (
            <p className={`is-${feedback.kind}`} role="status">
              {feedback.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

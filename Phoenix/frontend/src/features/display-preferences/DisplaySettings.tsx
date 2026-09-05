import { useState } from 'react'

import './DisplaySettings.css'

import {
  applyDisplayPreferences,
  DEFAULT_DISPLAY_PREFERENCES,
  loadDisplayPreferences,
  resetDisplayPreferences,
  saveDisplayPreferences,
  type DisplayPreferences,
  type PhoenixBackgroundTheme,
  type PhoenixFontSize,
} from './displayPreferences'

const FONT_SIZE_OPTIONS: ReadonlyArray<{
  readonly value: PhoenixFontSize
  readonly label: string
}> = [
  { value: 'standard', label: '標準' },
  { value: 'large', label: '大' },
  { value: 'extra-large', label: '特大' },
]

const BACKGROUND_OPTIONS: ReadonlyArray<{
  readonly value: PhoenixBackgroundTheme
  readonly label: string
}> = [
  { value: 'midnight', label: '深夜ブルー' },
  { value: 'soft-navy', label: 'ソフトネイビー' },
  { value: 'charcoal', label: 'チャコール' },
]

export function DisplaySettings() {
  const [preferences, setPreferences] = useState(loadDisplayPreferences)
  const [storageUnavailable, setStorageUnavailable] = useState(false)

  function updatePreferences(nextPreferences: DisplayPreferences) {
    setPreferences(nextPreferences)
    applyDisplayPreferences(nextPreferences)
    setStorageUnavailable(!saveDisplayPreferences(nextPreferences))
  }

  function resetPreferences() {
    setPreferences(DEFAULT_DISPLAY_PREFERENCES)
    applyDisplayPreferences(DEFAULT_DISPLAY_PREFERENCES)
    setStorageUnavailable(!resetDisplayPreferences())
  }

  return (
    <details className="display-settings">
      <summary>表示設定</summary>
      <div className="display-settings-panel">
        <div className="display-settings-heading">
          <strong>画面の見やすさ</strong>
          <small>このブラウザーに保存</small>
        </div>

        <fieldset>
          <legend>文字サイズ</legend>
          <div className="display-settings-options display-settings-font-options">
            {FONT_SIZE_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="phoenix-font-size"
                  value={option.value}
                  checked={preferences.fontSize === option.value}
                  onChange={() =>
                    updatePreferences({
                      ...preferences,
                      fontSize: option.value,
                    })
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>背景色</legend>
          <div className="display-settings-options display-settings-background-options">
            {BACKGROUND_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="phoenix-background-theme"
                  value={option.value}
                  checked={preferences.backgroundTheme === option.value}
                  onChange={() =>
                    updatePreferences({
                      ...preferences,
                      backgroundTheme: option.value,
                    })
                  }
                />
                <span>
                  <i
                    className={`display-settings-swatch swatch-${option.value}`}
                    aria-hidden="true"
                  />
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          className="display-settings-reset"
          type="button"
          onClick={resetPreferences}
        >
          初期設定に戻す
        </button>

        <p
          className={storageUnavailable ? 'display-settings-warning' : ''}
          role="status"
          aria-live="polite"
        >
          {storageUnavailable
            ? '変更は反映しましたが、ブラウザーへ保存できませんでした。'
            : '選択内容は次回の起動時にも引き継がれます。'}
        </p>
      </div>
    </details>
  )
}

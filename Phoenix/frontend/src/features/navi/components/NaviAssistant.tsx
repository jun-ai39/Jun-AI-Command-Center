import { useState } from 'react'

import naviOfficialVisual from '../../../assets/navi/navi-official.png'

import './NaviAssistant.css'

type NaviAssistantProps = {
  readonly initialExpanded?: boolean
}

export function NaviAssistant({ initialExpanded = false }: NaviAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)

  return (
    <aside className="navi-assistant" aria-label="ナビ常駐アシスタント">
      {isExpanded && (
        <section
          id="navi-assistant-panel"
          className="navi-assistant-panel"
          aria-label="ナビの案内"
        >
          <div className="navi-assistant-panel-visual" aria-hidden="true">
            <img src={naviOfficialVisual} alt="" />
          </div>
          <div className="navi-assistant-panel-copy">
            <span>PHOENIX ASSIST</span>
            <strong>ナビ</strong>
            <p>必要なときに呼んでね。今は静かにそばにいるよ。</p>
            <small>常駐アバター準備完了・AI未接続</small>
          </div>
          <button
            type="button"
            className="navi-assistant-minimize"
            aria-label="ナビを最小化"
            onClick={() => setIsExpanded(false)}
          >
            −
          </button>
        </section>
      )}

      <button
        type="button"
        className="navi-assistant-avatar"
        aria-label={isExpanded ? 'ナビを最小化' : 'ナビを開く'}
        aria-expanded={isExpanded}
        aria-controls="navi-assistant-panel"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="navi-assistant-avatar-visual" aria-hidden="true">
          <img src={naviOfficialVisual} alt="" />
        </span>
        <span className="navi-assistant-avatar-label">
          {isExpanded ? '閉じる' : 'ナビ'}
        </span>
      </button>
    </aside>
  )
}

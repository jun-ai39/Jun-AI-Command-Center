import './OperationsHome.css'

import type { OperationsScreen } from '../operationsNavigation'

type OperationsHomeItem = {
  readonly number: string
  readonly area: 'MANAGE' | 'RECORD' | 'KNOWLEDGE'
  readonly title: string
  readonly description: string
  readonly screen: OperationsScreen
}

const OPERATIONS_HOME_ITEMS: readonly OperationsHomeItem[] = [
  {
    number: '01',
    area: 'MANAGE',
    title: '今日の保全予定',
    description: '本日期限と期限超過の作業を確認する',
    screen: 'today-maintenance',
  },
  {
    number: '02',
    area: 'MANAGE',
    title: '定期点検',
    description: '毎日・毎週・毎月の実施状況を確認する',
    screen: 'inspection',
  },
  {
    number: '03',
    area: 'MANAGE',
    title: '要対応',
    description: '継続対応と経過確認の日報件数を見る',
    screen: 'attention',
  },
  {
    number: '04',
    area: 'RECORD',
    title: '作業日報',
    description: '設備と7項目で今日の作業を記録する',
    screen: 'work-report',
  },
  {
    number: '05',
    area: 'KNOWLEDGE',
    title: '設備を探す',
    description: '設備を選び、設備カルテを確認する',
    screen: 'equipment',
  },
  {
    number: '06',
    area: 'MANAGE',
    title: '履歴を探す',
    description: '日付・部門・作業内容から日報を検索する',
    screen: 'history',
  },
]

export function OperationsHome({
  onOpen,
}: {
  readonly onOpen: (screen: OperationsScreen) => void
}) {
  return (
    <section
      className="operations-home"
      aria-labelledby="operations-home-title"
    >
      <div className="operations-home-intro">
        <p className="eyebrow">PHOENIX OS / HOME</p>
        <h1 id="operations-home-title">設備保全ホーム</h1>
        <p>今日やることを確認し、必要な記録や設備情報へ迷わず進めます。</p>
      </div>

      <nav aria-label="設備保全の中核機能">
        <ul className="operations-home-grid">
          {OPERATIONS_HOME_ITEMS.map((item) => (
            <li key={item.number}>
              <button
                type="button"
                className={`operations-home-card is-${item.area.toLowerCase()}`}
                data-screen={item.screen}
                aria-label={`${item.title}を開く`}
                onClick={() => onOpen(item.screen)}
              >
                <span className="operations-home-card-number">
                  {item.number}
                </span>
                <span className="operations-home-card-copy">
                  <small>{item.area}</small>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
                <span
                  className="operations-home-card-action"
                  aria-hidden="true"
                >
                  開く
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import App, {
  AuthenticatedAppSession,
  PhoenixOperationsApp,
  type OperationsView,
} from './App'
import type { AuthenticatedUser } from './features/auth/types'

const AUTHENTICATED_USER: AuthenticatedUser = {
  id: 'a1000000-0000-4000-8000-000000000001',
  username: 'jun.admin',
  role: 'admin',
  is_active: true,
  created_at: '2026-08-28T00:00:00+00:00',
}

const NORMAL_USER: AuthenticatedUser = {
  ...AUTHENTICATED_USER,
  id: 'a1000000-0000-4000-8000-000000000002',
  username: 'jun.operator',
  role: 'user',
}

function renderOperations(initialScreen: OperationsView = 'home'): string {
  return renderToStaticMarkup(
    <PhoenixOperationsApp
      initialScreen={initialScreen}
      authenticatedUser={AUTHENTICATED_USER}
      onLogout={() => undefined}
    />,
  )
}

describe('App operations screens', () => {
  it('checks the local session before mounting operations', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('ログイン状態を確認しています')
    expect(markup).toContain('Phoenix APIへ確認中')
    expect(markup).not.toContain('設備保全ホーム')
    expect(markup).not.toContain('id="work-report-content"')
  })

  it('starts the authenticated user on the lightweight operations home', () => {
    const markup = renderOperations()

    expect(markup).toContain('PHOENIX OS / STEP 104')
    expect(markup).toContain('設備保全ホーム')
    expect(markup).toContain('aria-label="設備保全の中核機能"')
    expect(markup.match(/data-screen=/g)).toHaveLength(6)
    expect(markup).toContain('管理・設定')
    expect(markup).toContain(
      'バックアップ・保全予定・設備・点検・ガイドの高度な設定',
    )
    expect(markup).not.toContain('id="work-report-content"')
    expect(markup).not.toContain('id="inspection-record-date"')
    expect(markup).not.toContain('id="equipment-finder-keyword"')
    expect(markup).not.toContain('id="work-report-history-date"')
    expect(markup).not.toContain('保全予定の管理')
    expect(markup).not.toContain('トラブルシューティングガイド管理')
    expect(markup).toContain('jun.admin')
    expect(markup).toContain('管理者')
    expect(markup).toContain('ログアウト')
    expect(markup).toContain('表示設定')
    expect(markup).toContain('文字サイズ')
    expect(markup).toContain('背景色')
  })

  it('shows database backup only inside an opened administrator area', () => {
    const adminMarkup = renderToStaticMarkup(
      <PhoenixOperationsApp
        authenticatedUser={AUTHENTICATED_USER}
        initialAdminSettingsOpen
        onLogout={() => undefined}
      />,
    )
    const userMarkup = renderToStaticMarkup(
      <PhoenixOperationsApp
        authenticatedUser={NORMAL_USER}
        initialAdminSettingsOpen
        onLogout={() => undefined}
      />,
    )

    expect(adminMarkup).toContain('ADMIN TOOL / STEP 132')
    expect(adminMarkup).toContain('データベースのバックアップ')
    expect(adminMarkup).toContain('保全予定の管理')
    expect(userMarkup).not.toContain('管理・設定')
    expect(userMarkup).not.toContain('ADMIN TOOL / STEP 132')
    expect(userMarkup).not.toContain('データベースのバックアップ')
    expect(userMarkup).not.toContain('保全予定の管理')
    expect(userMarkup).toContain('表示設定')
  })

  it('renders only the selected work report screen with a home action', () => {
    const markup = renderOperations('work-report')

    expect(markup).toContain('aria-label="選択中の機能"')
    expect(markup).toContain('設備保全ホームへ戻る')
    expect(markup).toContain('id="work-report-content"')
    expect(markup).toContain('id="work-report-department"')
    expect(markup).toContain('id="work-report-equipment"')
    expect(markup).toContain('入力内容を確認')
    expect(markup).not.toContain('PHOENIX OS / STEP 104')
    expect(markup).not.toContain('id="inspection-record-date"')
    expect(markup).not.toContain('id="equipment-finder-keyword"')
    expect(markup).not.toContain('id="work-report-history-date"')
  })

  it('keeps inspection status and inspection entry in one selected screen', () => {
    const markup = renderOperations('inspection')

    expect(markup).toContain('MANAGE / STEP 100')
    expect(markup).toContain('定期点検')
    expect(markup).toContain('id="inspection-record-date"')
    expect(markup).toContain('id="inspection-record-equipment"')
    expect(markup).toContain('id="inspection-record-cycle"')
    expect(markup).not.toContain('id="work-report-content"')
    expect(markup).not.toContain('id="equipment-finder-keyword"')
  })

  it('separates attention work from the basic history search', () => {
    const attentionMarkup = renderOperations('attention')
    const historyMarkup = renderOperations('history')

    expect(attentionMarkup).toContain('id="work-report-attention-screen-title"')
    expect(attentionMarkup).toContain('要対応の日報')
    expect(attentionMarkup).not.toContain('id="work-report-history-date"')
    expect(historyMarkup).toContain('id="work-report-history-title"')
    expect(historyMarkup).toContain('id="work-report-history-date"')
    expect(historyMarkup).not.toContain(
      'id="work-report-attention-summary-title"',
    )
  })

  it('keeps equipment search as its own knowledge screen', () => {
    const markup = renderOperations('equipment')

    expect(markup).toContain('KNOWLEDGE / STEP 99')
    expect(markup).toContain('id="equipment-finder-keyword"')
    expect(markup).not.toContain('id="work-report-content"')
    expect(markup).not.toContain('id="inspection-record-date"')
  })

  it('shows a recoverable logout failure without unmounting operations', () => {
    const markup = renderToStaticMarkup(
      <PhoenixOperationsApp
        authenticatedUser={AUTHENTICATED_USER}
        logoutFailed
        onLogout={() => undefined}
      />,
    )

    expect(markup).toContain('設備保全ホーム')
    expect(markup).toContain('ログアウトできませんでした')
    expect(markup).toContain('role="alert"')
  })

  it('keeps the selected operations screen mounted behind reauthentication', () => {
    const markup = renderToStaticMarkup(
      <AuthenticatedAppSession
        initialScreen="work-report"
        authenticatedUser={AUTHENTICATED_USER}
        reauthenticationRequired
        isLoggingIn={false}
        loginFailure={null}
        onLogin={vi.fn().mockResolvedValue(true)}
        isLoggingOut={false}
        logoutFailed={false}
        onLogout={() => undefined}
      />,
    )

    expect(markup).toContain('id="work-report-content"')
    expect(markup).toContain('class="session-preserved-operations"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('inert=""')
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('セッションの有効期限が切れました')
    expect(markup).toContain('期限切れになった通信は自動再送しません')
  })
})

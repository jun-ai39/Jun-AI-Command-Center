import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  AuthCheckingScreen,
  AuthUnavailableScreen,
  LoginScreen,
} from './AuthAccessScreen'

describe('authentication access screens', () => {
  it('shows a distinct session-checking state', () => {
    const markup = renderToStaticMarkup(<AuthCheckingScreen />)

    expect(markup).toContain('ログイン状態を確認しています')
    expect(markup).toContain('role="status"')
    expect(markup).not.toContain('id="auth-password"')
  })

  it('shows a retry action when the API is unavailable', () => {
    const markup = renderToStaticMarkup(
      <AuthUnavailableScreen onRetry={() => undefined} />,
    )

    expect(markup).toContain('Phoenix APIに接続できません')
    expect(markup).toContain('ログイン失敗ではなく')
    expect(markup).toContain('もう一度接続する')
  })

  it('renders a password field without a saved value', () => {
    const markup = renderToStaticMarkup(
      <LoginScreen
        isSubmitting={false}
        failure={null}
        onLogin={vi.fn().mockResolvedValue(true)}
      />,
    )

    expect(markup).toContain('id="auth-username"')
    expect(markup).toContain('id="auth-password"')
    expect(markup).toContain('type="password"')
    expect(markup).toContain('autoComplete="current-password"')
    expect(markup).toContain('パスワードをブラウザの保存領域へ記録')
    expect(markup).not.toContain('localStorage')
  })

  it('distinguishes credential rejection from an API outage', () => {
    const credentialMarkup = renderToStaticMarkup(
      <LoginScreen
        isSubmitting={false}
        failure="credentials"
        onLogin={vi.fn().mockResolvedValue(false)}
      />,
    )
    const unavailableMarkup = renderToStaticMarkup(
      <LoginScreen
        isSubmitting={false}
        failure="unavailable"
        onLogin={vi.fn().mockResolvedValue(false)}
      />,
    )

    expect(credentialMarkup).toContain(
      'ユーザー名またはパスワードを確認してください',
    )
    expect(unavailableMarkup).toContain('Phoenix APIへ接続できません')
  })

  it('explains safe manual recovery when reauthentication is required', () => {
    const markup = renderToStaticMarkup(
      <LoginScreen
        mode="reauthentication"
        initialUsername="jun.admin"
        isSubmitting={false}
        failure={null}
        onLogin={vi.fn().mockResolvedValue(true)}
      />,
    )

    expect(markup).toContain('セッションの有効期限が切れました')
    expect(markup).toContain('作業画面と入力内容を保持しています')
    expect(markup).toContain('期限切れになった通信は自動再送しません')
    expect(markup).toContain('value="jun.admin"')
    expect(markup).toContain('再ログイン')
  })
})

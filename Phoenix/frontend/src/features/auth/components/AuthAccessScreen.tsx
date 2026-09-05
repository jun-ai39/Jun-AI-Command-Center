import { useState, type FormEvent, type ReactNode } from 'react'

import './AuthAccessScreen.css'

import type { LoginCredentials, LoginFailure } from '../types'

type AuthFrameProps = {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly children: ReactNode
}

function AuthFrame({ eyebrow, title, description, children }: AuthFrameProps) {
  return (
    <div className="auth-shell">
      <header className="auth-brand" aria-label="Phoenix OS">
        <span className="auth-brand-mark" aria-hidden="true">
          P
        </span>
        <span>
          <strong>PHOENIX OS</strong>
          <small>JUN AI COMMAND CENTER</small>
        </span>
      </header>
      <main className="auth-main">
        <section className="auth-card" aria-labelledby="auth-screen-title">
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="auth-screen-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </section>
      </main>
      <footer className="auth-footer">
        <p>今日の行動が、未来の資産を生む。</p>
        <small>Project Phoenix</small>
      </footer>
    </div>
  )
}

export function AuthCheckingScreen() {
  return (
    <AuthFrame
      eyebrow="LOCAL AUTHENTICATION"
      title="ログイン状態を確認しています"
      description="Phoenixのローカルセッションを安全に確認しています。"
    >
      <div className="auth-progress" role="status" aria-live="polite">
        <span aria-hidden="true" />
        Phoenix APIへ確認中
      </div>
    </AuthFrame>
  )
}

type AuthUnavailableScreenProps = {
  readonly onRetry: () => void
}

export function AuthUnavailableScreen({ onRetry }: AuthUnavailableScreenProps) {
  return (
    <AuthFrame
      eyebrow="CONNECTION REQUIRED"
      title="Phoenix APIに接続できません"
      description="認証の成否を確認できないため、業務画面は開いていません。バックエンドの起動状態を確認してください。"
    >
      <div className="auth-alert" role="alert">
        ログイン失敗ではなく、APIとの通信に失敗しています。
      </div>
      <button className="auth-primary-button" type="button" onClick={onRetry}>
        もう一度接続する
      </button>
    </AuthFrame>
  )
}

type LoginScreenProps = {
  readonly isSubmitting: boolean
  readonly failure: LoginFailure | null
  readonly onLogin: (credentials: LoginCredentials) => Promise<boolean>
  readonly mode?: 'initial' | 'reauthentication'
  readonly initialUsername?: string
}

export function LoginScreen({
  isSubmitting,
  failure,
  onLogin,
  mode = 'initial',
  initialUsername = '',
}: LoginScreenProps) {
  const [username, setUsername] = useState(initialUsername)
  const [password, setPassword] = useState('')
  const isReauthentication = mode === 'reauthentication'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const succeeded = await onLogin({
      username: username.trim(),
      password,
    })
    setPassword('')
    if (succeeded) setUsername('')
  }

  return (
    <AuthFrame
      eyebrow={
        isReauthentication
          ? 'SESSION EXPIRED / STEP 131'
          : 'LOCAL ACCESS / STEP 129'
      }
      title={
        isReauthentication
          ? 'セッションの有効期限が切れました'
          : 'Phoenixへログイン'
      }
      description={
        isReauthentication
          ? '作業画面と入力内容を保持しています。続けるには、もう一度ログインしてください。'
          : 'このPCに作成した管理者アカウントでログインしてください。'
      }
    >
      {isReauthentication && (
        <p className="auth-session-notice" role="alert">
          期限切れになった通信は自動再送しません。再ログイン後、保存操作をもう一度実行してください。
        </p>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="auth-username">
          ユーザー名
          <input
            id="auth-username"
            name="username"
            type="text"
            autoComplete="username"
            maxLength={50}
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
        <label htmlFor="auth-password">
          パスワード
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        {failure === 'credentials' && (
          <p className="auth-alert" role="alert">
            ユーザー名またはパスワードを確認してください。
          </p>
        )}
        {failure === 'unavailable' && (
          <p className="auth-alert" role="alert">
            Phoenix
            APIへ接続できません。起動状態を確認して、もう一度お試しください。
          </p>
        )}

        <button
          className="auth-primary-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? isReauthentication
              ? '再ログイン中…'
              : 'ログイン中…'
            : isReauthentication
              ? '再ログイン'
              : 'ログイン'}
        </button>
      </form>
      <p className="auth-privacy-note">
        パスワードをブラウザの保存領域へ記録する機能は使用していません。
      </p>
    </AuthFrame>
  )
}

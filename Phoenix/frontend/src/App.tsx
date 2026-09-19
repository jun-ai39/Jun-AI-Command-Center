import { useCallback, useEffect, useRef, useState } from 'react'

import './App.css'

import {
  AuthCheckingScreen,
  AuthUnavailableScreen,
  LoginScreen,
} from './features/auth/components/AuthAccessScreen'
import { useAuthSession } from './features/auth/hooks/useAuthSession'
import type { AuthenticatedUser } from './features/auth/types'
import { DatabaseBackupPanel } from './features/backups/components/DatabaseBackupPanel'
import { DisplaySettings } from './features/display-preferences/DisplaySettings'
import { EquipmentFinderPanel } from './features/equipment-finder/components/EquipmentFinderPanel'
import { EquipmentMasterPanel } from './features/equipment-master/components/EquipmentMasterPanel'
import { OperationsHome } from './features/home/components/OperationsHome'
import {
  OPERATIONS_SCREEN_LABELS,
  type OperationsScreen,
} from './features/home/operationsNavigation'
import { InspectionRecordPanel } from './features/inspection-records/components/InspectionRecordPanel'
import type { InspectionRecordEntrySelection } from './features/inspection-records/types'
import { InspectionStatusPanel } from './features/inspection-status/components/InspectionStatusPanel'
import type { InspectionScheduleStatusItem } from './features/inspection-status/types'
import { NaviAssistant } from './features/navi/components/NaviAssistant'
import { useHealthStatus } from './features/system/hooks/useHealthStatus'
import type { HealthConnectionState } from './features/system/types'
import { TodayMaintenancePanel } from './features/todos/components/TodayMaintenancePanel'
import { TodoPanel } from './features/todos/components/TodoPanel'
import { TroubleshootingGuideManagementPanel } from './features/troubleshooting/components/TroubleshootingGuideManagementPanel'
import {
  WorkReportPanel,
  type WorkReportPanelHandle,
} from './features/work-reports/components/WorkReportPanel'
import { WorkReportHistoryPanel } from './features/work-reports/components/WorkReportHistoryPanel'
import { useWorkReportEquipmentOptions } from './features/work-reports/hooks/useWorkReportEquipmentOptions'
import type { WorkReportGuideHandoffInput } from './features/work-reports/types'

function getConnectionLabel(state: HealthConnectionState): string {
  switch (state.phase) {
    case 'loading':
      return 'API確認中'
    case 'online':
      return `API正常 / v${state.health.version}`
    case 'offline':
      return 'API接続失敗'
  }
}

export type OperationsView = 'home' | OperationsScreen

type PhoenixOperationsAppProps = {
  readonly initialScreen?: OperationsView
  readonly initialAdminSettingsOpen?: boolean
  readonly authenticatedUser: AuthenticatedUser
  readonly isLoggingOut?: boolean
  readonly logoutFailed?: boolean
  readonly onLogout: () => void
}

export function PhoenixOperationsApp({
  initialScreen = 'home',
  initialAdminSettingsOpen = false,
  authenticatedUser,
  isLoggingOut = false,
  logoutFailed = false,
  onLogout,
}: PhoenixOperationsAppProps) {
  const healthState = useHealthStatus()
  const {
    state: workReportEquipmentOptionsState,
    reload: reloadWorkReportEquipmentOptions,
  } = useWorkReportEquipmentOptions()
  const [activeScreen, setActiveScreen] =
    useState<OperationsView>(initialScreen)
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(
    initialAdminSettingsOpen,
  )
  const [
    maintenanceManagementOpenRequest,
    setMaintenanceManagementOpenRequest,
  ] = useState(0)
  const [inspectionStatusRefreshToken, setInspectionStatusRefreshToken] =
    useState(0)
  const [inspectionTemplateRefreshToken, setInspectionTemplateRefreshToken] =
    useState(0)
  const [inspectionEntryRequest, setInspectionEntryRequest] = useState<{
    readonly requestId: number
    readonly selection: InspectionRecordEntrySelection
  } | null>(null)
  const [todoRefreshToken, setTodoRefreshToken] = useState(0)
  const [workReportRefreshToken, setWorkReportRefreshToken] = useState(0)
  const screenRootRef = useRef<HTMLDivElement>(null)
  const workReportPanelRef = useRef<WorkReportPanelHandle>(null)
  const pendingGuideHandoffRef = useRef<WorkReportGuideHandoffInput | null>(
    null,
  )

  const connectWorkReportPanel = useCallback(
    (panel: WorkReportPanelHandle | null) => {
      workReportPanelRef.current = panel
      const pendingHandoff = pendingGuideHandoffRef.current
      if (!panel || !pendingHandoff) return
      pendingGuideHandoffRef.current = null
      panel.startGuideWorkReport(pendingHandoff)
    },
    [],
  )

  useEffect(() => {
    const target = screenRootRef.current
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeScreen])

  useEffect(() => {
    if (
      activeScreen !== 'home' ||
      !isAdminSettingsOpen ||
      maintenanceManagementOpenRequest === 0
    ) {
      return
    }

    const target = document.getElementById('maintenance-schedule-management')
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeScreen, isAdminSettingsOpen, maintenanceManagementOpenRequest])

  useEffect(() => {
    if (activeScreen !== 'inspection' || !inspectionEntryRequest) return

    const target = document.getElementById('inspection-record-section')
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeScreen, inspectionEntryRequest])

  function openOperationsScreen(screen: OperationsScreen) {
    setIsAdminSettingsOpen(false)
    setActiveScreen(screen)
  }

  function openHome() {
    setActiveScreen('home')
  }

  function openMaintenanceScheduleManagement() {
    setActiveScreen('home')
    setIsAdminSettingsOpen(true)
    setMaintenanceManagementOpenRequest((current) => current + 1)
  }

  function startInspection(item: InspectionScheduleStatusItem) {
    setActiveScreen('inspection')
    setInspectionEntryRequest((current) => ({
      requestId: (current?.requestId ?? 0) + 1,
      selection: {
        equipmentId: item.equipment_id,
        departmentName: item.department_name,
        equipmentName: item.equipment_name,
        equipmentNumber: item.equipment_number,
        cycle: item.cycle,
      },
    }))
  }

  function startGuideWorkReport(input: WorkReportGuideHandoffInput) {
    if (workReportPanelRef.current) {
      workReportPanelRef.current.startGuideWorkReport(input)
    } else {
      pendingGuideHandoffRef.current = input
    }
    openOperationsScreen('work-report')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#main"
          aria-label="Phoenix OS ホーム"
          onClick={openHome}
        >
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span>
            <strong>PHOENIX OS</strong>
            <small>JUN AI COMMAND CENTER</small>
          </span>
        </a>
        <div className="topbar-actions">
          <p
            className={`system-status system-${healthState.phase}`}
            role="status"
            aria-live="polite"
          >
            <span className="status-dot" aria-hidden="true" />
            {getConnectionLabel(healthState)}
          </p>
          <DisplaySettings />
          <div className="signed-in-user">
            <span className="signed-in-user-mark" aria-hidden="true">
              {authenticatedUser.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="signed-in-user-detail">
              <small>
                {authenticatedUser.role === 'admin' ? '管理者' : '一般ユーザー'}
              </small>
              <strong>{authenticatedUser.username}</strong>
            </span>
            <button type="button" onClick={onLogout} disabled={isLoggingOut}>
              {isLoggingOut ? '終了中…' : 'ログアウト'}
            </button>
          </div>
        </div>
      </header>

      {logoutFailed && (
        <p className="session-operation-error" role="alert">
          ログアウトできませんでした。API接続を確認して、もう一度お試しください。
        </p>
      )}

      <main id="main">
        <div ref={screenRootRef} className="operations-screen" tabIndex={-1}>
          {activeScreen === 'home' ? (
            <>
              <OperationsHome onOpen={openOperationsScreen} />

              {authenticatedUser.role === 'admin' && (
                <details
                  className="admin-settings"
                  open={isAdminSettingsOpen}
                  onToggle={(event) =>
                    setIsAdminSettingsOpen(event.currentTarget.open)
                  }
                >
                  <summary>
                    <span>
                      <small>ADMIN ONLY</small>
                      <strong>管理・設定</strong>
                    </span>
                    <span className="admin-settings-summary-detail">
                      バックアップ・保全予定・設備・点検・ガイドの高度な設定
                    </span>
                  </summary>
                  {isAdminSettingsOpen && (
                    <div className="admin-settings-content">
                      <DatabaseBackupPanel />
                      <section
                        id="maintenance-schedule-management"
                        className="admin-settings-tool"
                        tabIndex={-1}
                        aria-labelledby="maintenance-schedule-management-title"
                      >
                        <div className="admin-settings-tool-heading">
                          <div>
                            <small>ADMIN TOOL / MAINTENANCE</small>
                            <h2 id="maintenance-schedule-management-title">
                              保全予定の管理
                            </h2>
                          </div>
                          <p>
                            CSV・固定・一括操作など、通常利用者には不要な高度操作をまとめています。
                          </p>
                        </div>
                        <TodoPanel
                          refreshToken={todoRefreshToken}
                          equipmentOptionsState={
                            workReportEquipmentOptionsState
                          }
                          onReloadEquipmentOptions={
                            reloadWorkReportEquipmentOptions
                          }
                        />
                      </section>
                      <EquipmentMasterPanel
                        onEquipmentSaved={reloadWorkReportEquipmentOptions}
                        onInspectionTemplateChanged={() =>
                          setInspectionTemplateRefreshToken(
                            (current) => current + 1,
                          )
                        }
                      />
                      <TroubleshootingGuideManagementPanel
                        equipmentState={workReportEquipmentOptionsState}
                        onReloadEquipment={reloadWorkReportEquipmentOptions}
                      />
                    </div>
                  )}
                </details>
              )}
            </>
          ) : (
            <>
              <nav
                className="operations-screen-navigation"
                aria-label="選択中の機能"
              >
                <button type="button" onClick={openHome}>
                  <span aria-hidden="true">←</span>
                  設備保全ホームへ戻る
                </button>
                <strong>{OPERATIONS_SCREEN_LABELS[activeScreen]}</strong>
              </nav>

              {activeScreen === 'today-maintenance' && (
                <TodayMaintenancePanel
                  onScheduleCompleted={() =>
                    setTodoRefreshToken((current) => current + 1)
                  }
                  onOpenScheduleManagement={
                    authenticatedUser.role === 'admin'
                      ? openMaintenanceScheduleManagement
                      : undefined
                  }
                  equipmentOptionsState={workReportEquipmentOptionsState}
                />
              )}

              {activeScreen === 'inspection' && (
                <>
                  <InspectionStatusPanel
                    refreshToken={inspectionStatusRefreshToken}
                    onStartInspection={startInspection}
                  />
                  <InspectionRecordPanel
                    key={inspectionEntryRequest?.requestId ?? 0}
                    equipmentOptionsState={workReportEquipmentOptionsState}
                    onReloadEquipmentOptions={reloadWorkReportEquipmentOptions}
                    selection={inspectionEntryRequest?.selection}
                    templateRefreshToken={inspectionTemplateRefreshToken}
                    onSaved={() =>
                      setInspectionStatusRefreshToken((current) => current + 1)
                    }
                    onStartWorkReport={startGuideWorkReport}
                  />
                </>
              )}

              {activeScreen === 'equipment' && (
                <EquipmentFinderPanel
                  onStartWorkReport={startGuideWorkReport}
                />
              )}

              {activeScreen === 'work-report' && (
                <WorkReportPanel
                  ref={connectWorkReportPanel}
                  onSaved={() =>
                    setWorkReportRefreshToken((current) => current + 1)
                  }
                  equipmentOptionsState={workReportEquipmentOptionsState}
                  onReloadEquipmentOptions={reloadWorkReportEquipmentOptions}
                />
              )}

              {(activeScreen === 'attention' || activeScreen === 'history') && (
                <WorkReportHistoryPanel
                  key={activeScreen}
                  mode={activeScreen === 'attention' ? 'attention' : 'search'}
                  refreshToken={workReportRefreshToken}
                  equipmentOptionsState={workReportEquipmentOptionsState}
                  onReloadEquipmentOptions={reloadWorkReportEquipmentOptions}
                />
              )}
            </>
          )}
        </div>
      </main>

      <footer>
        <p>今日の行動が、未来の資産を生む。</p>
        <small>Project Phoenix</small>
      </footer>

      <NaviAssistant />
    </div>
  )
}

type AppProps = {
  readonly initialScreen?: OperationsView
}

type AuthenticatedAppSessionProps = {
  readonly initialScreen: OperationsView
  readonly authenticatedUser: AuthenticatedUser
  readonly reauthenticationRequired: boolean
  readonly isLoggingIn: boolean
  readonly loginFailure: Parameters<typeof LoginScreen>[0]['failure']
  readonly onLogin: Parameters<typeof LoginScreen>[0]['onLogin']
  readonly isLoggingOut: boolean
  readonly logoutFailed: boolean
  readonly onLogout: () => void
}

export function AuthenticatedAppSession({
  initialScreen,
  authenticatedUser,
  reauthenticationRequired,
  isLoggingIn,
  loginFailure,
  onLogin,
  isLoggingOut,
  logoutFailed,
  onLogout,
}: AuthenticatedAppSessionProps) {
  return (
    <>
      <div
        className="session-preserved-operations"
        aria-hidden={reauthenticationRequired || undefined}
        inert={reauthenticationRequired || undefined}
      >
        <PhoenixOperationsApp
          initialScreen={initialScreen}
          authenticatedUser={authenticatedUser}
          isLoggingOut={isLoggingOut}
          logoutFailed={logoutFailed}
          onLogout={onLogout}
        />
      </div>
      {reauthenticationRequired && (
        <section
          className="auth-session-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="セッション期限切れ"
        >
          <LoginScreen
            mode="reauthentication"
            initialUsername={authenticatedUser.username}
            isSubmitting={isLoggingIn}
            failure={loginFailure}
            onLogin={onLogin}
          />
        </section>
      )}
    </>
  )
}

function App({ initialScreen = 'home' }: AppProps) {
  const auth = useAuthSession()

  switch (auth.state.phase) {
    case 'checking':
      return <AuthCheckingScreen />
    case 'unavailable':
      return <AuthUnavailableScreen onRetry={auth.retrySessionCheck} />
    case 'signed-out':
      return (
        <LoginScreen
          isSubmitting={auth.isLoggingIn}
          failure={auth.loginFailure}
          onLogin={auth.login}
        />
      )
    case 'signed-in':
    case 'reauth-required':
      return (
        <AuthenticatedAppSession
          initialScreen={initialScreen}
          authenticatedUser={auth.state.user}
          reauthenticationRequired={auth.state.phase === 'reauth-required'}
          isLoggingIn={auth.isLoggingIn}
          loginFailure={auth.loginFailure}
          onLogin={auth.login}
          isLoggingOut={auth.isLoggingOut}
          logoutFailed={auth.logoutFailed}
          onLogout={() => void auth.logout()}
        />
      )
  }
}

export default App

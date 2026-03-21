import { useCallback, useEffect, useState } from 'react'
import { Check, X, AlertCircle, RefreshCw, ArrowRight, Terminal } from 'lucide-react'
import { tokens } from '../design-system/tokens'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

interface OnboardingProps {
  onReady: () => void
}

interface AuthStatus {
  cliFound: boolean
  tokenFound: boolean
  tokenExpired: boolean
  expiresAt?: string
}

type CheckState = 'loading' | 'pass' | 'fail' | 'warn'

function getCheckState(status: AuthStatus | null, field: keyof Pick<AuthStatus, 'cliFound' | 'tokenFound'>): CheckState {
  if (!status) return 'loading'
  return status[field] ? 'pass' : 'fail'
}

function getExpiryState(status: AuthStatus | null): CheckState {
  if (!status) return 'loading'
  if (!status.tokenFound) return 'fail'
  return status.tokenExpired ? 'warn' : 'pass'
}

function StatusIcon({ state }: { state: CheckState }): React.JSX.Element {
  switch (state) {
    case 'loading':
      return <Spinner size="sm" />
    case 'pass':
      return <Check size={16} color={tokens.color.success} />
    case 'fail':
      return <X size={16} color={tokens.color.danger} />
    case 'warn':
      return <AlertCircle size={16} color={tokens.color.warning} />
  }
}

function getInstruction(status: AuthStatus | null): string | null {
  if (!status) return null
  if (!status.cliFound) return 'Install Claude Code CLI and add it to your PATH'
  if (!status.tokenFound) return 'Run `claude login` in your terminal'
  if (status.tokenExpired) return 'Run `claude login` to refresh your session'
  return null
}

export function Onboarding({ onReady }: OnboardingProps): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [checking, setChecking] = useState(true)

  const runCheck = useCallback(async () => {
    setChecking(true)
    try {
      const result = await window.api.authStatus()
      setStatus(result)
      if (result.cliFound && result.tokenFound && !result.tokenExpired) {
        onReady()
      }
    } catch {
      setStatus({ cliFound: false, tokenFound: false, tokenExpired: false })
    } finally {
      setChecking(false)
    }
  }, [onReady])

  useEffect(() => {
    runCheck()
  }, [runCheck])

  const cliState = getCheckState(status, 'cliFound')
  const tokenState = getCheckState(status, 'tokenFound')
  const expiryState = getExpiryState(status)
  const instruction = getInstruction(status)
  const allPassed = status?.cliFound && status?.tokenFound && !status?.tokenExpired

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.header}>
          <Terminal size={24} color={tokens.color.accent} />
          <h2 style={styles.title}>Setup Check</h2>
        </div>

        <p style={styles.subtitle}>
          Verifying Claude Code CLI and authentication
        </p>

        <div style={styles.checks}>
          <div style={styles.checkRow}>
            <StatusIcon state={cliState} />
            <span style={styles.checkLabel}>Claude Code CLI installed</span>
          </div>
          <div style={styles.checkRow}>
            <StatusIcon state={tokenState} />
            <span style={styles.checkLabel}>Claude login completed</span>
          </div>
          <div style={styles.checkRow}>
            <StatusIcon state={expiryState} />
            <span style={styles.checkLabel}>Token not expired</span>
          </div>
        </div>

        {instruction && !checking && (
          <div style={styles.instruction}>
            <code style={styles.instructionCode}>{instruction}</code>
          </div>
        )}

        <div style={styles.actions}>
          {!allPassed && (
            <Button
              variant="ghost"
              onClick={runCheck}
              loading={checking}
              disabled={checking}
            >
              <RefreshCw size={14} />
              Check Again
            </Button>
          )}
          {allPassed ? (
            <Button variant="primary" onClick={onReady}>
              <ArrowRight size={14} />
              Continue
            </Button>
          ) : (
            <Button variant="ghost" onClick={onReady} disabled={checking}>
              Continue Anyway
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    background: tokens.color.bg,
    fontFamily: tokens.font.ui,
  },
  card: {
    background: tokens.color.surface,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.xl,
    padding: tokens.space[8],
    maxWidth: '420px',
    width: '100%',
    boxShadow: tokens.shadow.lg,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space[3],
    marginBottom: tokens.space[2],
  },
  title: {
    fontSize: tokens.size.xxl,
    fontWeight: 600,
    color: tokens.color.text,
    margin: 0,
  },
  subtitle: {
    fontSize: tokens.size.md,
    color: tokens.color.textMuted,
    margin: `0 0 ${tokens.space[6]} 0`,
  },
  checks: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.space[3],
    marginBottom: tokens.space[6],
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space[3],
  },
  checkLabel: {
    fontSize: tokens.size.md,
    color: tokens.color.text,
  },
  instruction: {
    background: tokens.color.surfaceHigh,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    padding: `${tokens.space[3]} ${tokens.space[4]}`,
    marginBottom: tokens.space[6],
  },
  instructionCode: {
    fontSize: tokens.size.sm,
    color: tokens.color.warning,
    fontFamily: tokens.font.code,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.space[3],
  },
}

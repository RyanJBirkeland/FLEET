/**
 * ConnectionsSection — GitHub credential management.
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from '../../stores/toasts'
import { CredentialForm, type CredentialField } from './CredentialForm'

const GITHUB_FIELDS: CredentialField[] = [
  { key: 'token', label: 'Personal Access Token', type: 'token', placeholder: 'ghp_...', savedPlaceholder: 'Token saved — enter new value to change' },
]

export function ConnectionsSection(): React.JSX.Element {
  // GitHub state
  const [ghToken, setGhToken] = useState('')
  const [hasExistingGhToken, setHasExistingGhToken] = useState(false)
  const [ghDirty, setGhDirty] = useState(false)
  const [ghTesting, setGhTesting] = useState(false)
  const [ghTestResult, setGhTestResult] = useState<'success' | 'error' | null>(null)

  // Load initial values
  useEffect(() => {
    window.api.settings.get('github.token').then((v) => {
      setHasExistingGhToken(!!v)
    })
  }, [])

  // GitHub handlers
  const handleGhChange = useCallback((_key: string, value: string) => {
    setGhToken(value)
    setGhDirty(true)
    setGhTestResult(null)
  }, [])

  const handleGhSave = useCallback(async () => {
    if (!ghToken) return
    await window.api.settings.set('github.token', ghToken)
    setHasExistingGhToken(true)
    setGhToken('')
    setGhDirty(false)
    toast.success('GitHub token saved')
  }, [ghToken])

  const handleGhTest = useCallback(async () => {
    setGhTesting(true)
    setGhTestResult(null)
    try {
      const result = await window.api.github.fetch('/user')
      setGhTestResult(result.ok ? 'success' : 'error')
      if (result.ok) {
        toast.success('GitHub token valid')
      } else {
        toast.error('GitHub token invalid')
      }
    } catch {
      setGhTestResult('error')
      toast.error('GitHub test failed')
    } finally {
      setGhTesting(false)
    }
  }, [])

  return (
    <section className="settings-section">
      <h2 className="settings-section__title bde-section-title">Connections</h2>

      <CredentialForm
        title="GitHub"
        fields={GITHUB_FIELDS}
        values={{ token: ghToken }}
        hasExisting={{ token: hasExistingGhToken }}
        onChange={handleGhChange}
        onSave={handleGhSave}
        onTest={handleGhTest}
        dirty={ghDirty}
        saveDisabled={!ghDirty || !ghToken}
        testDisabled={ghTesting || (!ghToken && !hasExistingGhToken)}
        saving={false}
        testing={ghTesting}
        testResult={ghTestResult}
      />
    </section>
  )
}

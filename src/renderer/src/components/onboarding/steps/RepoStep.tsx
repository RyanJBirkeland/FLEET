import { ArrowRight, ArrowLeft, FolderGit, Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'

interface StepProps {
  onNext: () => void
  onBack: () => void
  onComplete: () => void
  isFirst: boolean
  isLast: boolean
}

export function RepoStep({ onNext, onBack, isFirst }: StepProps): React.JSX.Element {
  const [reposConfigured, setReposConfigured] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  const checkRepos = async (): Promise<void> => {
    setChecking(true)
    try {
      const repos = await window.api.settings.get('repos')
      setReposConfigured(!!repos)
    } catch {
      setReposConfigured(false)
    }
    setChecking(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkRepos()
  }, [])

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__icon">
        <FolderGit size={48} />
      </div>

      <h1 className="onboarding-step__title">Repository Configuration</h1>

      <p className="onboarding-step__description">
        Configure your repositories to enable agent task dispatch. You can add repos in Settings
        after completing this wizard.
      </p>

      <div className="onboarding-step__checks">
        <div className="onboarding-step__check">
          {checking ? (
            <div className="onboarding-step__check-icon">⏳</div>
          ) : reposConfigured ? (
            <Check size={20} className="onboarding-step__check-icon--success" />
          ) : (
            <X size={20} className="onboarding-step__check-icon--error" />
          )}
          <span>Repositories configured (optional)</span>
        </div>
      </div>

      {!checking && !reposConfigured && (
        <div className="onboarding-step__help">
          <p>
            You can configure repos later in Settings → Repositories. This step is optional for now.
          </p>
        </div>
      )}

      <div className="onboarding-step__actions">
        {!isFirst && (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </Button>
        )}
        <Button variant="primary" onClick={onNext}>
          Next
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}

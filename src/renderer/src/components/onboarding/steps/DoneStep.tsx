import { ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '../../ui/Button'

interface StepProps {
  onNext: () => void
  onBack: () => void
  onComplete: () => void
  isFirst: boolean
  isLast: boolean
}

export function DoneStep({ onBack, onComplete, isFirst }: StepProps): React.JSX.Element {
  return (
    <div className="onboarding-step">
      <div className="onboarding-step__icon">
        <CheckCircle size={48} />
      </div>

      <h1 className="onboarding-step__title">You&apos;re Ready!</h1>

      <p className="onboarding-step__description">
        Setup complete. You can now start creating sprint tasks, spawning agents, and automating
        your development workflow.
      </p>

      <div className="onboarding-step__features">
        <div className="onboarding-step__feature">
          <strong>Dashboard</strong>
          <span>View metrics and pipeline health (⌘1)</span>
        </div>
        <div className="onboarding-step__feature">
          <strong>Task Workbench</strong>
          <span>Create specs with AI copilot assistance</span>
        </div>
        <div className="onboarding-step__feature">
          <strong>Sprint Pipeline</strong>
          <span>Monitor agent execution in real-time (⌘4)</span>
        </div>
        <div className="onboarding-step__feature">
          <strong>Code Review</strong>
          <span>Review agent changes before merge (⌘5)</span>
        </div>
      </div>

      <div className="onboarding-step__actions">
        {!isFirst && (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </Button>
        )}
        <Button variant="primary" onClick={onComplete}>
          Get Started
        </Button>
      </div>
    </div>
  )
}

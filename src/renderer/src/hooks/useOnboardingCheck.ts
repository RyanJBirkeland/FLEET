import { useEffect, useState } from 'react'

/**
 * Checks if onboarding has been completed and returns the state.
 * Extracted from App.tsx to reduce file size and isolate onboarding logic.
 */
export function useOnboardingCheck(): boolean {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    window.api.settings.get('onboarding.completed').then((val) => {
      if (!val) {
        setShowOnboarding(true)
      }
    })
  }, [])

  return showOnboarding
}

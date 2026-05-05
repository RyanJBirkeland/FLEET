import { lazy, Suspense } from 'react'
import { useFeatureFlags } from '../stores/featureFlags'
import DashboardViewV1 from './DashboardViewV1'

const DashboardViewV2 = lazy(() => import('./DashboardViewV2'))

export default function DashboardView(): React.JSX.Element {
  const v2Dashboard = useFeatureFlags((s) => s.v2Dashboard)
  if (v2Dashboard) {
    return (
      <Suspense fallback={null}>
        <DashboardViewV2 />
      </Suspense>
    )
  }
  return <DashboardViewV1 />
}

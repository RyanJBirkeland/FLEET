import { useEffect } from 'react'
import { useSprintTasks } from '../stores/sprintTasks'
import { useCostDataStore } from '../stores/costData'
import { ActiveTasksCard } from '../components/dashboard/ActiveTasksCard'
import { RecentCompletionsCard } from '../components/dashboard/RecentCompletionsCard'
import { CostSummaryCard } from '../components/dashboard/CostSummaryCard'
import { OpenPRsCard } from '../components/dashboard/OpenPRsCard'
import { tokens } from '../design-system/tokens'

export default function DashboardView(): React.JSX.Element {
  const loadData = useSprintTasks((s) => s.loadData)
  const fetchLocalAgents = useCostDataStore((s) => s.fetchLocalAgents)

  useEffect(() => {
    loadData()
    fetchLocalAgents()
  }, [loadData, fetchLocalAgents])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'auto auto',
        gap: tokens.space[4],
        padding: tokens.space[4],
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        alignContent: 'start',
        fontFamily: tokens.font.ui,
      }}
    >
      <ActiveTasksCard />
      <RecentCompletionsCard />
      <CostSummaryCard />
      <OpenPRsCard />
    </div>
  )
}

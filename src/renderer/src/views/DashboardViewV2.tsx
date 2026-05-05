import './DashboardV2.css'
import { useDashboardData } from '../components/dashboard/hooks/useDashboardData'
import { MissionBriefBand } from '../components/dashboard/MissionBriefBand'
import { ActiveAgentsCard } from '../components/dashboard/LiveColumn/ActiveAgentsCard'
import { PipelineGlanceCard } from '../components/dashboard/LiveColumn/PipelineGlanceCard'
import { ThroughputCard } from '../components/dashboard/LiveColumn/ThroughputCard'
import { AttentionCard } from '../components/dashboard/TriageColumn/AttentionCard'
import { ReviewQueueCard } from '../components/dashboard/TriageColumn/ReviewQueueCard'
import { RecentCompletionsCard } from '../components/dashboard/TriageColumn/RecentCompletionsCard'
import { KPIStrip } from '../components/dashboard/KPIStrip'
import { PerAgentStats } from '../components/dashboard/StatsAccordion/PerAgentStats'
import { PerRepoStats } from '../components/dashboard/StatsAccordion/PerRepoStats'

export default function DashboardViewV2(): React.JSX.Element {
  const data = useDashboardData()
  const totalAttention =
    data.partitions.failed.length + data.partitions.blocked.length

  return (
    <main className="dashboard-v2" role="main" aria-label="Dashboard">
      <MissionBriefBand
        briefHeadlineParts={data.briefHeadlineParts}
        stats={data.stats}
        onOpenReview={data.openReviewView}
        onOpenPlanner={data.openPlannerView}
        onNewTask={data.openNewTask}
      />

      <div className="dashboard-v2__columns">
        {/* Live column */}
        <div className="dashboard-v2__live-col">
          <ActiveAgentsCard
            agents={data.activeAgents}
            capacity={data.capacity}
            onOpenAgents={data.openAgentsView}
            onSpawnOne={data.openPlannerView}
          />
          <PipelineGlanceCard
            partitions={data.partitions}
            stats={data.stats}
            onOpenPipeline={data.openPipelineView}
          />
          <ThroughputCard throughputData={data.throughputData} />
        </div>

        {/* Triage column */}
        <div className="dashboard-v2__triage-col">
          <AttentionCard
            items={data.attentionItems}
            totalCount={totalAttention}
            onOpenPipeline={(filter) =>
              data.openPipelineView(filter === 'failed' ? 'failed' : 'blocked')
            }
            onOpenReview={data.openReviewView}
            onRetryTask={data.retryTask}
          />
          <ReviewQueueCard
            tasks={data.partitions.pendingReview}
            onOpenReview={data.openReviewView}
          />
          <RecentCompletionsCard
            completions={data.recentCompletions}
            taskTokenMap={data.taskTokenMap}
          />
        </div>
      </div>

      <KPIStrip
        successRate7dAvg={data.successRate7dAvg}
        successRateWeekDelta={data.successRateWeekDelta}
        avgDuration={data.avgDuration}
        tokenAvg={data.tokenAvg}
        tokenTrendData={data.tokenTrendData}
        avgCostPerTask={data.avgCostPerTask}
        failureRate={data.failureRate}
        successTrendData={data.successTrendData}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--s-4)',
          minWidth: 0
        }}
      >
        <PerAgentStats rows={data.perAgentStats} />
        <PerRepoStats rows={data.perRepoStats} />
      </div>
    </main>
  )
}

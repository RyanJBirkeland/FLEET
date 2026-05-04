interface DashboardErrorCardProps {
  message: string
  onRetry: () => void
}

/** Shared error card for dashboard data-load failures. Renders a message and a retry button. */
export function DashboardErrorCard({ message, onRetry }: DashboardErrorCardProps): React.JSX.Element {
  return (
    <div className="dashboard-card-error">
      <div className="dashboard-card-error__message">{message}</div>
      <button className="dashboard-card-error__retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

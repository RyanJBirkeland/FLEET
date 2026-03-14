import SprintBoard from '../components/sprint/SprintBoard'
import PRList from '../components/sprint/PRList'

export default function SprintView() {
  return (
    <div className="sprint-view">
      <div className="sprint-view__board">
        <SprintBoard />
      </div>
      <div className="sprint-view__prs">
        <PRList />
      </div>
    </div>
  )
}

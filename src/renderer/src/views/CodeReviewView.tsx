import { ReviewQueue } from '../components/code-review/ReviewQueue'
import { ReviewDetail } from '../components/code-review/ReviewDetail'
import { ReviewActions } from '../components/code-review/ReviewActions'

export default function CodeReviewView(): React.JSX.Element {
  return (
    <div className="cr-view">
      <ReviewQueue />
      <div className="cr-main">
        <ReviewDetail />
        <ReviewActions />
      </div>
    </div>
  )
}

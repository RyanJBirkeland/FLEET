import './ConsoleCard.css'
import { renderAgentMarkdown } from '../render-agent-markdown'

interface TextCardProps {
  text: string
}

export function TextCard({ text }: TextCardProps): React.JSX.Element {
  return (
    <div className="console-card console-card--text" data-testid="console-line-text">
      {renderAgentMarkdown(text)}
    </div>
  )
}

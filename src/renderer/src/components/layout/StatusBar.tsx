import { Badge } from '../ui/Badge'

interface StatusBarProps {
  model: string
}

export function StatusBar({ model }: StatusBarProps): React.JSX.Element {
  return (
    <div className="statusbar">
      <div className="statusbar__left">
        <Badge variant="muted" size="sm">
          Local
        </Badge>
      </div>

      <div className="statusbar__right">
        {model && <span className="statusbar__model">{model}</span>}
      </div>
    </div>
  )
}

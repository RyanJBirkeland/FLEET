type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg' | undefined
  color?: string | undefined
  label?: string | undefined
}

export function Spinner({ size = 'md', color, label = 'Loading' }: SpinnerProps): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label={label}
      className={`fleet-spinner fleet-spinner--${size}`}
      style={color ? { borderTopColor: color } : undefined}
    />
  )
}

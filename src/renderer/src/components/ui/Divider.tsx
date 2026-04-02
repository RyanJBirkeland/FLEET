type DividerProps = {
  direction?: 'horizontal' | 'vertical'
}

export function Divider({ direction = 'horizontal' }: DividerProps): React.JSX.Element {
  return <div className={`bde-divider bde-divider--${direction}`} />
}

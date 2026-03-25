import { type NeonAccent, neonVar } from './types';

interface NeonBadgeProps {
  accent: NeonAccent;
  label: string;
  pulse?: boolean;
}

export function NeonBadge({ accent, label, pulse = false }: NeonBadgeProps) {
  return (
    <span
      className={pulse ? 'neon-pulse' : ''}
      style={{
        color: neonVar(accent, 'color'),
        background: neonVar(accent, 'surface'),
        border: `1px solid ${neonVar(accent, 'border')}`,
        borderRadius: '20px',
        padding: '2px 10px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.5px',
        textTransform: 'uppercase' as const,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        '--pulse-shadow-min': `0 0 6px ${neonVar(accent, 'border')}`,
        '--pulse-shadow-max': `0 0 16px ${neonVar(accent, 'border')}`,
        animation: pulse ? 'neon-pulse 3s ease-in-out infinite' : undefined,
      } as React.CSSProperties}
    >
      {label}
    </span>
  );
}

import { type NeonAccent, neonVar } from './types';

interface NeonProgressProps {
  value: number;
  accent: NeonAccent;
  label?: string;
}

export function NeonProgress({ value, accent, label }: NeonProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div>
      {label && (
        <div style={{
          color: neonVar(accent, 'color'),
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '6px',
          fontWeight: 600,
        }}>{label}</div>
      )}
      <div style={{
        height: '4px',
        background: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div
          data-role="progress-fill"
          style={{
            height: '100%',
            width: `${clamped}%`,
            background: `linear-gradient(90deg, ${neonVar(accent, 'color')}, var(--neon-blue))`,
            borderRadius: '2px',
            boxShadow: neonVar(accent, 'glow'),
            transition: 'width 300ms ease',
          }}
        />
      </div>
    </div>
  );
}

import { type ReactNode } from 'react';
import { type NeonAccent, neonVar } from './types';

interface GlassPanelProps {
  accent?: NeonAccent;
  blur?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const BLUR_MAP = {
  sm: 'blur(8px) saturate(180%)',
  md: 'blur(16px) saturate(180%)',
  lg: 'blur(40px) saturate(180%)',
};

export function GlassPanel({ accent, blur = 'md', children, className = '', style }: GlassPanelProps) {
  return (
    <div
      className={`glass-panel ${className}`.trim()}
      style={{
        backdropFilter: BLUR_MAP[blur],
        WebkitBackdropFilter: BLUR_MAP[blur],
        background: accent
          ? `linear-gradient(135deg, ${neonVar(accent, 'surface')}, rgba(10, 0, 21, 0.4))`
          : 'rgba(20, 10, 40, 0.4)',
        border: `1px solid ${accent ? neonVar(accent, 'border') : 'rgba(255, 255, 255, 0.08)'}`,
        borderColor: accent ? neonVar(accent, 'border') : 'rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        boxShadow: 'var(--neon-glass-shadow), var(--neon-glass-edge)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

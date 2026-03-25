import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GlassPanel } from '../GlassPanel';

describe('GlassPanel', () => {
  it('renders children', () => {
    render(<GlassPanel>Panel content</GlassPanel>);
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('applies glass backdrop-filter', () => {
    const { container } = render(<GlassPanel>X</GlassPanel>);
    const panel = container.firstChild as HTMLElement;
    expect(panel.style.backdropFilter).toBeTruthy();
  });

  it('applies accent when provided', () => {
    const { container } = render(<GlassPanel accent="purple">X</GlassPanel>);
    const panel = container.firstChild as HTMLElement;
    expect(panel.style.borderColor).toBe('var(--neon-purple-border)');
  });
});

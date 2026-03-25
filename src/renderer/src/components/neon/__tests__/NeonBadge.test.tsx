import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NeonBadge } from '../NeonBadge';

describe('NeonBadge', () => {
  it('renders label text', () => {
    render(<NeonBadge accent="cyan" label="active" />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('applies accent color styling', () => {
    const { container } = render(<NeonBadge accent="pink" label="queued" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.color).toBe('var(--neon-pink)');
    expect(badge.style.background).toContain('var(--neon-pink-surface)');
  });

  it('adds pulse class when pulse prop is true', () => {
    const { container } = render(<NeonBadge accent="cyan" label="live" pulse />);
    expect(container.firstChild).toHaveClass('neon-pulse');
  });
});

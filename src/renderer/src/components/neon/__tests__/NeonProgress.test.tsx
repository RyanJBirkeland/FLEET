import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NeonProgress } from '../NeonProgress';

describe('NeonProgress', () => {
  it('renders with correct width percentage', () => {
    const { container } = render(<NeonProgress value={65} accent="cyan" />);
    const bar = container.querySelector('[data-role="progress-fill"]') as HTMLElement;
    expect(bar.style.width).toBe('65%');
  });

  it('renders label when provided', () => {
    render(<NeonProgress value={50} accent="pink" label="Sprint Progress" />);
    expect(screen.getByText('Sprint Progress')).toBeInTheDocument();
  });

  it('clamps value between 0 and 100', () => {
    const { container } = render(<NeonProgress value={150} accent="blue" />);
    const bar = container.querySelector('[data-role="progress-fill"]') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });
});

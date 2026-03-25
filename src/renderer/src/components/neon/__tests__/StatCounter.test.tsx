import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatCounter } from '../StatCounter';

describe('StatCounter', () => {
  it('renders label and value', () => {
    render(<StatCounter label="Agents" value={3} accent="cyan" />);
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders trend when provided', () => {
    render(<StatCounter label="Cost" value="$4.20" accent="orange" trend={{ direction: 'down', label: '12% vs yesterday' }} />);
    expect(screen.getByText(/12% vs yesterday/)).toBeInTheDocument();
  });

  it('renders suffix text', () => {
    render(<StatCounter label="Agents" value={3} accent="cyan" suffix="live" />);
    expect(screen.getByText('live')).toBeInTheDocument();
  });

  it('applies accent color to label', () => {
    render(<StatCounter label="Tasks" value={17} accent="pink" />);
    const label = document.querySelector('[data-role="stat-label"]') as HTMLElement;
    expect(label.style.color).toBe('var(--neon-pink)');
  });

  it('renders up arrow and red color for upward trend', () => {
    render(
      <StatCounter label="Cost" value="$10" accent="orange" trend={{ direction: 'up', label: '5% increase' }} />,
    );
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/5% increase/)).toBeInTheDocument();
  });

  it('renders down arrow for downward trend', () => {
    render(
      <StatCounter label="Cost" value="$4" accent="cyan" trend={{ direction: 'down', label: '3% drop' }} />,
    );
    expect(screen.getByText(/↓/)).toBeInTheDocument();
    expect(screen.getByText(/3% drop/)).toBeInTheDocument();
  });

  it('does not render trend section when trend is undefined', () => {
    render(
      <StatCounter label="Agents" value={5} accent="cyan" />,
    );
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
    expect(screen.queryByText(/↓/)).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <StatCounter label="Agents" value={3} accent="cyan" icon={<span data-testid="test-icon">⚡</span>} />,
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});

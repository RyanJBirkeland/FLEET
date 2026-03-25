// src/renderer/src/components/neon/__tests__/NeonTooltip.test.tsx
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NeonTooltip } from '../NeonTooltip';

describe('NeonTooltip', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not show tooltip initially', () => {
    render(
      <NeonTooltip label="Dashboard" shortcut="⌘1">
        <button>Nav</button>
      </NeonTooltip>
    );
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows tooltip after hover delay', async () => {
    render(
      <NeonTooltip label="Dashboard" shortcut="⌘1">
        <button>Nav</button>
      </NeonTooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Nav'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('⌘1')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave', () => {
    render(
      <NeonTooltip label="Dashboard" shortcut="⌘1">
        <button>Nav</button>
      </NeonTooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Nav'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByText('Nav'));
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders without shortcut', () => {
    render(
      <NeonTooltip label="Settings">
        <button>Gear</button>
      </NeonTooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Gear'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});

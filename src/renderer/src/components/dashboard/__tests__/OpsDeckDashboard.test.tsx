import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock window.api — shape from src/preload/index.d.ts
vi.stubGlobal('window', {
  ...window,
  api: {
    dashboard: {
      completionsPerHour: vi.fn().mockResolvedValue([]),
      recentEvents: vi.fn().mockResolvedValue([]),
    },
    getPrList: vi.fn().mockResolvedValue([]),
  },
});

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => false,
}));

// Mock ScanlineOverlay and ParticleField to avoid rendering noise
vi.mock('../../../components/neon', async () => {
  const actual = await vi.importActual<typeof import('../../../components/neon')>('../../../components/neon');
  return {
    ...actual,
    ScanlineOverlay: () => null,
    ParticleField: () => null,
  };
});

// Mock stores
vi.mock('../../../stores/sprintTasks', () => ({
  useSprintTasks: vi.fn((sel: (s: { tasks: { id: string; title: string; status: string; repo: string; completed_at?: number }[] }) => unknown) => sel({
    tasks: [
      { id: '1', title: 'Fix auth', status: 'active', repo: 'BDE' },
      { id: '2', title: 'Add tests', status: 'queued', repo: 'BDE' },
      { id: '3', title: 'Deploy', status: 'done', repo: 'BDE', completed_at: Date.now() },
      { id: '4', title: 'Review', status: 'blocked', repo: 'BDE' },
    ],
  })),
}));

vi.mock('../../../stores/costData', () => ({
  useCostDataStore: vi.fn((sel: (s: { totalCost: number }) => unknown) => sel({
    totalCost: 4.2,
  })),
}));

describe('DashboardView (Ops Deck)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the status bar with command center title', async () => {
    const { default: DashboardView } = await import('../../../views/DashboardView');
    render(<DashboardView />);
    expect(screen.getByText('BDE Command Center')).toBeInTheDocument();
  });

  it('renders stat counters for each metric', async () => {
    const { default: DashboardView } = await import('../../../views/DashboardView');
    render(<DashboardView />);
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('PRs')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders pipeline flow section', async () => {
    const { default: DashboardView } = await import('../../../views/DashboardView');
    render(<DashboardView />);
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });

  it('renders cost card', async () => {
    const { default: DashboardView } = await import('../../../views/DashboardView');
    render(<DashboardView />);
    expect(screen.getByText(/Cost/)).toBeInTheDocument();
  });
});

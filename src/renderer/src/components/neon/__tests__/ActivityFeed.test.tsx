import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActivityFeed, type FeedEvent } from '../ActivityFeed';

const mockEvents: FeedEvent[] = [
  { id: '1', label: 'fix-auth pushing', accent: 'cyan', timestamp: Date.now() - 2000 },
  { id: '2', label: 'add-tests done ✓', accent: 'pink', timestamp: Date.now() - 60000 },
  { id: '3', label: 'PR #42 merged', accent: 'blue', timestamp: Date.now() - 180000 },
];

describe('ActivityFeed', () => {
  it('renders all events', () => {
    render(<ActivityFeed events={mockEvents} />);
    expect(screen.getByText('fix-auth pushing')).toBeInTheDocument();
    expect(screen.getByText('add-tests done ✓')).toBeInTheDocument();
    expect(screen.getByText('PR #42 merged')).toBeInTheDocument();
  });

  it('limits display to maxItems', () => {
    render(<ActivityFeed events={mockEvents} maxItems={2} />);
    expect(screen.getByText('fix-auth pushing')).toBeInTheDocument();
    expect(screen.getByText('add-tests done ✓')).toBeInTheDocument();
    expect(screen.queryByText('PR #42 merged')).not.toBeInTheDocument();
  });

  it('shows relative timestamps', () => {
    render(<ActivityFeed events={mockEvents} />);
    expect(screen.getByText('2s ago')).toBeInTheDocument();
  });

  it('renders empty state when no events', () => {
    render(<ActivityFeed events={[]} />);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import JobListSkeleton from '@/components/jobs/JobListSkeleton';

describe('JobListSkeleton Component', () => {
  // Test 1: Renders the default number of skeleton cards (6)
  test('renders the default number of skeleton cards', () => {
    render(<JobListSkeleton />);
    // Each SkeletonCard renders a div with animate-pulse
    const skeletonCards = screen.getAllByTestId('skeleton-card'); // We'll need to add data-testid
    expect(skeletonCards).toHaveLength(6);
  });

  // Test 2: Renders the specified number of skeleton cards
  test('renders the specified number of skeleton cards via count prop', () => {
    const customCount = 3;
    render(<JobListSkeleton count={customCount} />);
    const skeletonCards = screen.getAllByTestId('skeleton-card');
    expect(skeletonCards).toHaveLength(customCount);
  });

  // Test 3: Renders zero cards when count is 0
  test('renders no cards when count is 0', () => {
    render(<JobListSkeleton count={0} />);
    const skeletonCards = screen.queryAllByTestId('skeleton-card');
    expect(skeletonCards).toHaveLength(0);
  });

  // Test 4: Each skeleton card has the pulsing animation class
  test('each skeleton card has animate-pulse class', () => {
    render(<JobListSkeleton />);
    const skeletonCards = screen.getAllByTestId('skeleton-card');
    skeletonCards.forEach(card => {
      expect(card).toHaveClass('animate-pulse');
    });
  });
}); 
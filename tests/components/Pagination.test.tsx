import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Home from '@/pages/index';

// Mock the Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock SWR hook
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock the custom hooks and components used in the Home page
jest.mock('@/hooks/useJobsSearch', () => ({
  useJobsSearch: jest.fn(),
}));

jest.mock('@/components/jobs/JobFilters', () => {
  return {
    __esModule: true,
    default: jest.fn(() => <div data-testid="job-filters">Job Filters Component</div>),
  };
});

jest.mock('@/components/common/Layout', () => {
  return {
    __esModule: true,
    default: jest.fn(({ children }) => <div data-testid="layout">{children}</div>),
  };
});

jest.mock('@/components/jobs/WideJobCard', () => {
  return {
    __esModule: true,
    default: jest.fn(() => <div data-testid="job-card">Job Card Component</div>),
  };
});

jest.mock('@/components/common/CustomSelect', () => {
  return {
    __esModule: true,
    default: jest.fn(() => <div data-testid="custom-select">Sort Select</div>),
  };
});

describe('Pagination functionality', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    pathname: '/',
    query: {},
    push: mockPush,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('should render pagination controls when totalPages > 1', () => {
    // Mock the useJobsSearch hook return value with pagination
    const useJobsSearchMock = require('@/hooks/useJobsSearch').useJobsSearch;
    useJobsSearchMock.mockReturnValue({
      jobs: Array(10).fill({}).map((_, i) => ({ id: `job-${i}` })),
      pagination: {
        totalCount: 25,
        totalPages: 3,
        currentPage: 1,
        pageSize: 10,
        hasNextPage: true,
        hasPrevPage: false,
      },
      isLoading: false,
      isError: false,
      aggregations: {
        jobTypes: [],
        experienceLevels: [],
        technologies: [],
      },
    });

    render(<Home />);

    // Pagination controls should be visible
    expect(screen.getByText(/Página 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByText('Anterior')).toBeInTheDocument();
    expect(screen.getByText('Próxima')).toBeInTheDocument();

    // Previous button should be disabled on first page
    const prevButton = screen.getByText('Anterior');
    expect(prevButton).toBeDisabled();

    // Next button should be enabled
    const nextButton = screen.getByText('Próxima');
    expect(nextButton).not.toBeDisabled();
  });

  it('should not render pagination controls when totalPages <= 1', () => {
    // Mock the useJobsSearch hook return value with pagination
    const useJobsSearchMock = require('@/hooks/useJobsSearch').useJobsSearch;
    useJobsSearchMock.mockReturnValue({
      jobs: Array(5).fill({}).map((_, i) => ({ id: `job-${i}` })),
      pagination: {
        totalCount: 5,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
      isLoading: false,
      isError: false,
      aggregations: {
        jobTypes: [],
        experienceLevels: [],
        technologies: [],
      },
    });

    render(<Home />);

    // Pagination controls should not be visible
    expect(screen.queryByText(/Página 1 de 1/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Próxima')).not.toBeInTheDocument();
  });

  it('should navigate to next page when next button is clicked', async () => {
    // Mock the useJobsSearch hook return value with pagination
    const useJobsSearchMock = require('@/hooks/useJobsSearch').useJobsSearch;
    useJobsSearchMock.mockReturnValue({
      jobs: Array(10).fill({}).map((_, i) => ({ id: `job-${i}` })),
      pagination: {
        totalCount: 25,
        totalPages: 3,
        currentPage: 1,
        pageSize: 10,
        hasNextPage: true,
        hasPrevPage: false,
      },
      isLoading: false,
      isError: false,
      aggregations: {
        jobTypes: [],
        experienceLevels: [],
        technologies: [],
      },
    });

    render(<Home />);

    // Click next button
    const nextButton = screen.getByText('Próxima');
    fireEvent.click(nextButton);

    // Router should be called with page=2
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        { pathname: '/', query: { page: '2' } },
        undefined,
        { shallow: true, scroll: false }
      );
    });
  });

  it('should navigate to previous page when previous button is clicked', async () => {
    // Mock the useJobsSearch hook return value with pagination
    const useJobsSearchMock = require('@/hooks/useJobsSearch').useJobsSearch;
    useJobsSearchMock.mockReturnValue({
      jobs: Array(10).fill({}).map((_, i) => ({ id: `job-${i}` })),
      pagination: {
        totalCount: 25,
        totalPages: 3,
        currentPage: 2,
        pageSize: 10,
        hasNextPage: true,
        hasPrevPage: true,
      },
      isLoading: false,
      isError: false,
      aggregations: {
        jobTypes: [],
        experienceLevels: [],
        technologies: [],
      },
    });

    // Mock the current page as 2
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      query: { page: '2' },
    });

    render(<Home />);

    // Verify we're on page 2
    expect(screen.getByText(/Página 2 de 3/i)).toBeInTheDocument();

    // Click previous button
    const prevButton = screen.getByText('Anterior');
    fireEvent.click(prevButton);

    // Router should be called with page=1, which means removing page from query
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        { pathname: '/', query: {} },
        undefined,
        { shallow: true, scroll: false }
      );
    });
  });

  it('should disable both buttons when loading', () => {
    // Mock the useJobsSearch hook return value with pagination and loading state
    const useJobsSearchMock = require('@/hooks/useJobsSearch').useJobsSearch;
    useJobsSearchMock.mockReturnValue({
      jobs: [],
      pagination: {
        totalCount: 25,
        totalPages: 3,
        currentPage: 2,
        pageSize: 10,
        hasNextPage: true,
        hasPrevPage: true,
      },
      isLoading: true,
      isError: false,
      aggregations: {
        jobTypes: [],
        experienceLevels: [],
        technologies: [],
      },
    });

    // Mock the current page as 2
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      query: { page: '2' },
    });

    render(<Home />);

    // Both buttons should be disabled when loading
    const prevButton = screen.getByText('Anterior');
    const nextButton = screen.getByText('Próxima');
    
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('should disable next button on the last page', () => {
    // Mock the useJobsSearch hook return value with pagination on last page
    const useJobsSearchMock = require('@/hooks/useJobsSearch').useJobsSearch;
    useJobsSearchMock.mockReturnValue({
      jobs: Array(5).fill({}).map((_, i) => ({ id: `job-${i}` })),
      pagination: {
        totalCount: 25,
        totalPages: 3,
        currentPage: 3,
        pageSize: 10,
        hasNextPage: false,
        hasPrevPage: true,
      },
      isLoading: false,
      isError: false,
      aggregations: {
        jobTypes: [],
        experienceLevels: [],
        technologies: [],
      },
    });

    // Mock the current page as 3
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      query: { page: '3' },
    });

    render(<Home />);

    // Verify we're on page 3
    expect(screen.getByText(/Página 3 de 3/i)).toBeInTheDocument();

    // Next button should be disabled on last page
    const nextButton = screen.getByText('Próxima');
    expect(nextButton).toBeDisabled();

    // Previous button should be enabled
    const prevButton = screen.getByText('Anterior');
    expect(prevButton).not.toBeDisabled();
  });
}); 
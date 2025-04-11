import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useJobsSearch } from '@/hooks/useJobsSearch';
import { Job } from '@/types/models';

// Mock the global fetch
global.fetch = jest.fn();

// Sample successful response data
const mockJobs: Job[] = [
  { id: '1', title: 'React Dev', company: { name: 'Test Inc'}, createdAt: new Date(), status: 'ACTIVE' } as Job, 
  { id: '2', title: 'Node Dev', company: { name: 'Another Co'}, createdAt: new Date(), status: 'ACTIVE' } as Job,
];
const mockPagination = {
  totalCount: 15,
  totalPages: 2,
  currentPage: 1,
  pageSize: 10,
  hasNextPage: true,
  hasPrevPage: false,
};
const mockSuccessResponse = {
  jobs: mockJobs,
  pagination: mockPagination,
  filters: {},
};

// Wrapper component to provide SWR context
const wrapper = ({ children }: { children: React.ReactNode }) => (
  // Disable cache for testing to ensure clean state for each test
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe('useJobsSearch Hook', () => {
  beforeEach(() => {
    // Clear mock history before each test
    (fetch as jest.Mock).mockClear();
  });

  // Test 1: Initial loading state
  test('should return loading state initially', () => {
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Keep promise pending
    const { result } = renderHook(() => useJobsSearch(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBeUndefined();
    expect(result.current.jobs).toBeUndefined();
    expect(result.current.pagination).toBeUndefined();
  });

  // Test 2: Successful data fetching
  test('should return data on successful fetch', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useJobsSearch(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBeUndefined();
    expect(result.current.jobs).toEqual(mockJobs);
    expect(result.current.pagination).toEqual(mockPagination);
  });

  // Test 3: Error handling
  test('should return error state on failed fetch', async () => {
    const mockErrorResponse = { message: 'Failed to fetch' };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => mockErrorResponse,
    });

    const { result } = renderHook(() => useJobsSearch(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBeDefined();
    expect(result.current.error.status).toBe(500);
    expect(result.current.error.info).toEqual(mockErrorResponse);
    expect(result.current.jobs).toBeUndefined(); // Should not return data on error
    expect(result.current.pagination).toBeUndefined();
  });

  // Test 4: Correct API URL construction with parameters
  test('should construct the correct API URL with parameters', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const searchParams = {
      search: 'react',
      page: 2,
      limit: 5,
      jobTypes: ['FULL_TIME', 'CONTRACT'],
      experienceLevels: ['MID'],
      remote: true,
    };

    renderHook(() => useJobsSearch(searchParams), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const expectedUrl = '/api/jobs/search?page=2&limit=5&q=react&jobType=FULL_TIME%2CCONTRACT&experienceLevel=MID&remote=true';
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
  });

  // Test 5: Correct API URL without optional parameters
   test('should construct the correct API URL without optional parameters', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    renderHook(() => useJobsSearch({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const expectedUrl = '/api/jobs/search?page=1&limit=10';
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
  });

  // Test 6: Correct API URL construction with sortBy parameter
  test('should construct the correct API URL with sortBy parameter', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    renderHook(() => useJobsSearch({ sortBy: 'salary' }), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const expectedUrl = '/api/jobs/search?page=1&limit=10&sortBy=salary';
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
  });

  // Test 7: Correct API URL construction with default sortBy (should omit param)
  test('should construct the correct API URL with default sortBy', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    renderHook(() => useJobsSearch({ sortBy: 'newest' }), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    // Default 'newest' should not add the sortBy query parameter
    const expectedUrl = '/api/jobs/search?page=1&limit=10'; 
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
  });

}); 
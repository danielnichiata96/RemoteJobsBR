// TODO: Test suite fails with "Expected '>', got 'value'" syntax error.
// The SWC transformer used by Jest seems to have issues parsing the JSX
// for the <SWRConfig> component in the wrapper function, even with 
// various workarounds (defining config outside, React.Fragment, @ts-ignore).
// Needs further investigation into SWC/Jest JSX parsing for this specific case.

import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useJobsSearch } from '@/hooks/useJobsSearch';
import { Job, Pagination } from '@/types/models';
import React from 'react';

// Mock the global fetch
global.fetch = jest.fn();

// Sample successful response data
const mockJobs: Job[] = [
  { id: '1', title: 'React Dev', company: { name: 'Test Inc'}, createdAt: new Date(), status: 'ACTIVE' } as Job, 
  { id: '2', title: 'Node Dev', company: { name: 'Another Co'}, createdAt: new Date(), status: 'ACTIVE' } as Job,
  {
    id: '1',
    title: 'Frontend Developer',
    description: 'Description 1',
    requirements: 'Req 1',
    responsibilities: 'Resp 1',
    jobType: 'FULL_TIME',
    experienceLevel: 'ENTRY',
    skills: ['React'],
    location: 'Remote',
    workplaceType: 'REMOTE',
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    company: { id: 'c1', name: 'Company A', logo: null },
    companyLogo: null,
    applicationUrl: 'url1',
    isSaved: false, 
    source: 'direct',
    sourceId: null,
    sourceLogo: null,
    sourceUrl: null,
    companyId: 'c1',
    tags: [],
    country: 'USA',
    minSalary: null,
    maxSalary: null,
    currency: null,
    salaryCycle: null,
    showSalary: false,
    status: 'ACTIVE',
    visas: [],
    languages: [],
    applicationEmail: null,
    updatedAt: new Date().toISOString(),
    expiresAt: null,
    viewCount: 0,
    clickCount: 0,
  },
];
const mockPagination: Pagination = {
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

// Define SWR config outside JSX
const swrConfigValue = {
  provider: () => new Map(),
};

// Wrapper component to provide SWR context
const wrapper = ({ children }: { children: React.ReactNode }) => {
  // Use React.createElement to bypass potential SWC/JSX parsing issues for SWRConfig
  return React.createElement(SWRConfig, { value: swrConfigValue }, children);
};

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
  test('should construct the correct API URL with parameters', async () => { // Add async/await and wrapper
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

    // Render hook *with* wrapper to ensure fetch is called
    const { unmount } = renderHook(() => useJobsSearch(searchParams), { wrapper });

    // Wait for fetch to be called
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const expectedUrl = '/api/jobs/search?page=2&limit=5&q=react&jobType=FULL_TIME%2CCONTRACT&experienceLevel=MID&remote=true';
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
    unmount(); // Clean up
  });

  // Test 5: Correct API URL without optional parameters
  test('should construct the correct API URL without optional parameters', async () => { // Add async/await and wrapper
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    // Render hook *with* wrapper
    const { unmount } = renderHook(() => useJobsSearch({ page: 1, limit: 10 }), { wrapper });

    // Wait for fetch to be called
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const expectedUrl = '/api/jobs/search?page=1&limit=10';
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
    unmount(); // Clean up
  });

  // Test 6: Correct API URL construction with sortBy parameter
  test('should construct the correct API URL with sortBy parameter', async () => { // Add async/await and wrapper
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    // Render hook *with* wrapper
    const { unmount } = renderHook(() => useJobsSearch({ sortBy: 'salary' }), { wrapper });

    // Wait for fetch to be called
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const expectedUrl = '/api/jobs/search?page=1&limit=10&sortBy=salary';
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
    unmount(); // Clean up
  });

  // Test 7: Correct API URL construction with default sortBy (should omit param)
  test('should construct the correct API URL with default sortBy', async () => { // Add async/await and wrapper
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    // Render hook *with* wrapper
    const { unmount } = renderHook(() => useJobsSearch({ sortBy: 'newest' }), { wrapper });

    // Wait for fetch to be called
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const expectedUrl = '/api/jobs/search?page=1&limit=10'; 
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
    unmount(); // Clean up
  });
}); 
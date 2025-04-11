import useSWR from 'swr';
import { Job, JobType, ExperienceLevel } from '@/types/models';

interface PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface JobsApiResponse {
  jobs: Job[];
  pagination: PaginationInfo;
  filters: any; // Consider defining a stricter type
}

interface UseJobsSearchProps {
  search?: string;
  page?: number;
  limit?: number;
  jobTypes?: string[];
  experienceLevels?: string[];
  remote?: boolean;
  sortBy?: 'newest' | 'salary' | 'relevance';
}

// Generic fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.') as any;
    // Attach extra info to the error object.
    try {
      error.info = await res.json();
    } catch (e) {
      // Ignore if response is not JSON
      error.info = { status: res.status, message: res.statusText };
    }
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export function useJobsSearch({ 
  search = '',
  page = 1,
  limit = 10,
  jobTypes = [],
  experienceLevels = [],
  remote = false,
  sortBy = 'newest',
}: UseJobsSearchProps = {}) {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (search) params.append('q', search);
  if (jobTypes.length) params.append('jobType', jobTypes.join(','));
  if (experienceLevels.length) params.append('experienceLevel', experienceLevels.join(','));
  if (remote) params.append('remote', 'true');
  if (sortBy && sortBy !== 'newest') params.append('sortBy', sortBy);

  // Construct the API endpoint URL
  const apiUrl = `/api/jobs/search?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<JobsApiResponse>(apiUrl, fetcher, {
    keepPreviousData: true, // Keep previous data while loading new data for pagination/filtering
  });

  return {
    jobs: data?.jobs,
    pagination: data?.pagination,
    isLoading,
    isError: error,
    error,
    mutate, // Function to re-trigger fetch
  };
} 
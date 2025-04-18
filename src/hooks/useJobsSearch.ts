import useSWR from 'swr';
import { Job, HiringRegion } from '@prisma/client'; // Assuming HiringRegion is here
// import { Job, JobType, ExperienceLevel, HiringRegion } from '@/types/models'; // Use this if types are defined

interface PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Define type for aggregation results (mirroring API)
interface FilterAggregations {
  jobTypes?: { [key: string]: number }; // Using string index for flexibility
  experienceLevels?: { [key: string]: number };
  technologies?: { [key: string]: number };
}

interface JobsApiResponse {
  jobs: Job[];
  pagination: PaginationInfo;
  filters: any; 
  aggregations?: FilterAggregations; // <-- Add aggregations field
}

interface UseJobsSearchProps {
  search?: string;
  company?: string;
  page?: number;
  limit?: number;
  jobTypes?: string[];
  experienceLevels?: string[];
  remote?: boolean;
  sortBy?: 'newest' | 'salary' | 'relevance';
  technologies?: string[];
  hiringRegion?: HiringRegion;
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
  company = '',
  page = 1,
  limit = 10,
  jobTypes = [],
  experienceLevels = [],
  remote = false,
  sortBy = 'newest',
  technologies = [],
  hiringRegion,
}: UseJobsSearchProps = {}) {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (search) params.append('q', search);
  if (company) params.append('company', company);
  if (jobTypes.length) params.append('jobType', jobTypes.join(','));
  if (experienceLevels.length) params.append('experienceLevel', experienceLevels.join(','));
  if (technologies.length) params.append('technologies', technologies.join(','));
  if (remote) params.append('remote', 'true');
  if (sortBy && sortBy !== 'newest') params.append('sortBy', sortBy);
  if (hiringRegion) params.append('hiringRegion', hiringRegion);

  // Construct the API endpoint URL
  const apiUrl = `/api/jobs/search?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<JobsApiResponse>(apiUrl, fetcher, {
    keepPreviousData: true, // Keep previous data while loading new data for pagination/filtering
  });

  // Log the data received from SWR
  console.log('SWR Data:', data); 

  return {
    jobs: data?.jobs,
    pagination: data?.pagination,
    aggregations: data?.aggregations, // <-- Return aggregations
    isLoading,
    isError: error,
    error,
    mutate, // Function to re-trigger fetch
  };
} 
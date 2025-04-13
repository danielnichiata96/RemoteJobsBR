import { AshbyFetcher } from '../../lib/fetchers/AshbyFetcher';
import { JobProcessingAdapter } from '../../lib/adapters/JobProcessingAdapter';
import axios from 'axios';
import { PrismaClient, JobSource } from '@prisma/client';
import pino from 'pino';
import { getAshbyConfig } from '../../../src/types/JobSource';
import { AxiosError } from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../lib/adapters/JobProcessingAdapter');
jest.mock('../../../src/types/JobSource', () => ({
  getAshbyConfig: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockJobProcessingAdapter = JobProcessingAdapter as jest.MockedClass<typeof JobProcessingAdapter>;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as unknown as pino.Logger;

// Sample Ashby API response
const mockAshbyApiResponse = {
  apiVersion: "1",
  jobs: [
    {
      title: "Software Engineer, Frontend",
      location: "Remote",
      isRemote: true,
      descriptionHtml: "<p>Build amazing UIs</p>",
      publishedAt: "2023-10-26T10:00:00Z",
      employmentType: "FullTime",
      jobUrl: "https://jobs.ashbyhq.com/testco/frontend",
      applyUrl: "https://jobs.ashbyhq.com/testco/frontend/apply",
      isListed: true,
    },
    {
      title: "Product Manager, Growth",
      location: "New York, NY",
      isRemote: false,
      descriptionHtml: "<p>Grow the product</p>",
      publishedAt: "2023-10-25T12:00:00Z",
      employmentType: "FullTime",
      jobUrl: "https://jobs.ashbyhq.com/testco/pm",
      applyUrl: "https://jobs.ashbyhq.com/testco/pm/apply",
      isListed: true,
    },
    {
        title: "Backend Engineer (LATAM)",
        location: "Bogota, Colombia",
        isRemote: false, // Example where isRemote is false but location indicates relevance
        secondaryLocations: [{ location: "Remote - Brazil" }],
        descriptionHtml: "<p>Build backend systems</p>",
        publishedAt: "2023-10-24T14:00:00Z",
        employmentType: "FullTime",
        jobUrl: "https://jobs.ashbyhq.com/testco/backend-latam",
        applyUrl: "https://jobs.ashbyhq.com/testco/backend-latam/apply",
        isListed: true,
    },
    {
      title: "Unlisted Role",
      location: "Remote",
      isRemote: true,
      descriptionHtml: "<p>Secret role</p>",
      publishedAt: "2023-10-23T10:00:00Z",
      employmentType: "FullTime",
      jobUrl: "https://jobs.ashbyhq.com/testco/unlisted",
      applyUrl: "https://jobs.ashbyhq.com/testco/unlisted/apply",
      isListed: false, // Should be filtered out by processor
    },
  ],
};

const mockEmptyAshbyApiResponse = {
    apiVersion: "1",
    jobs: [],
};

describe('AshbyFetcher', () => {
  let prismaClient: PrismaClient;
  let jobProcessingAdapter: JobProcessingAdapter;
  let ashbyFetcher: AshbyFetcher;

  beforeEach(() => {
    prismaClient = new PrismaClient();
    jobProcessingAdapter = new MockJobProcessingAdapter();
    ashbyFetcher = new AshbyFetcher(prismaClient, jobProcessingAdapter);
    jest.clearAllMocks();

    // Default mock for getAshbyConfig
    (getAshbyConfig as jest.Mock).mockReturnValue({ jobBoardName: 'test-board' });
  });

  const mockSource: JobSource = {
    id: 'ashby-src-1',
    name: 'TestCo (Ashby)',
    type: 'ashby',
    isEnabled: true,
    config: { jobBoardName: 'testco' },
    companyWebsite: 'https://test.co',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastFetched: null,
    logoUrl: null,
    apiKey: null,
    apiEndpoint: null,
  };

  test('should fetch, parse, and attempt to process Ashby jobs successfully', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockAshbyApiResponse });
    // Mock the adapter's processRawJob to simulate success
    (jobProcessingAdapter.processRawJob as jest.Mock).mockResolvedValue(true);

    const result = await ashbyFetcher.processSource(mockSource, mockLogger);

    // Check Axios call
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith('https://api.ashbyhq.com/posting-api/job-board/testco', expect.any(Object));

    // Check stats (approximate)
    expect(result.stats.found).toBe(4);
    // Relevant count is approximated in fetcher, real count depends on processor logic
    // Assuming processRawJob succeeded for the 3 expected relevant jobs:
    expect(result.stats.relevant).toBe(3); 
    expect(result.stats.errors).toBe(0);

    // Check found IDs (empty as fetcher doesn't extract IDs)
    expect(result.foundSourceIds.size).toBe(0);

    // Check adapter calls (one for each job found)
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledTimes(4);
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('ashby', mockAshbyApiResponse.jobs[0], mockSource);
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('ashby', mockAshbyApiResponse.jobs[1], mockSource);
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('ashby', mockAshbyApiResponse.jobs[2], mockSource);
     expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('ashby', mockAshbyApiResponse.jobs[3], mockSource);

     // Check basic logging
     expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ jobBoardName: 'testco' }), expect.stringContaining('Starting processing'));
     expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('potential job postings found via API'));
     expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Handing off 4 jobs to the processor'));
     expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Attempted processing for 3 out of 4 jobs')); // Based on mocked adapter return
     expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Processing completed'));
  });

  test('should handle zero job postings found', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockEmptyAshbyApiResponse });

    const result = await ashbyFetcher.processSource(mockSource, mockLogger);

    expect(result.stats.found).toBe(0);
    expect(result.stats.relevant).toBe(0);
    expect(result.stats.processed).toBe(0);
    expect(result.stats.errors).toBe(0);
    expect(result.foundSourceIds.size).toBe(0);
    expect(jobProcessingAdapter.processRawJob).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('No job postings found for testco.');
  });

  test('should handle adapter processing failures reported by adapter', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockAshbyApiResponse });
    // Mock the adapter's processRawJob to return false (failure/irrelevant)
    (jobProcessingAdapter.processRawJob as jest.Mock).mockResolvedValue(false);

    const result = await ashbyFetcher.processSource(mockSource, mockLogger);

    expect(result.stats.found).toBe(4);
    expect(result.stats.relevant).toBe(0); // Fetcher approximation based on adapter response
    expect(result.stats.processed).toBe(0);
    expect(result.stats.errors).toBe(0); // Errors here are fetcher errors, not processing logic errors
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledTimes(4);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Attempted processing for 0 out of 4 jobs'));
  });

  test('should handle fetcher Axios error', async () => {
    const mockError = new Error('Network Error') as AxiosError;
    mockError.isAxiosError = true;
    mockError.response = { status: 500, data: 'Server Error', statusText: 'Internal Server Error' } as any;
    mockError.config = { url: 'https://api.ashbyhq.com/posting-api/job-board/testco' } as any;
    mockedAxios.get.mockRejectedValue(mockError);

    const result = await ashbyFetcher.processSource(mockSource, mockLogger);

    expect(result.stats.found).toBe(0);
    expect(result.stats.errors).toBe(1);
    expect(jobProcessingAdapter.processRawJob).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500, url: mockError.config.url }),
        '❌ Axios error fetching data for source'
    );
  });

   test('should handle invalid source config (missing jobBoardName)', async () => {
      const invalidSource = { ...mockSource, config: {} }; // Missing jobBoardName
      const result = await ashbyFetcher.processSource(invalidSource, mockLogger);

      expect(result.stats.errors).toBe(1);
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Missing or invalid jobBoardName in source config');
    });

    test('should handle API response with missing jobs array', async () => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: { apiVersion: "1" } }); // No jobs array
    
        const result = await ashbyFetcher.processSource(mockSource, mockLogger);
    
        expect(result.stats.found).toBe(0);
        expect(result.stats.errors).toBe(1);
        expect(jobProcessingAdapter.processRawJob).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: 200 }), '❌ Failed to fetch valid data from Ashby API');
      });

  it('should fetch jobs, process them, and return correct stats on success', async () => {
    const mockSource: JobSource = {
      id: 'source1',
      name: 'Test Ashby Source',
      type: 'ashby',
      config: { jobBoardName: 'test-board' },
      isEnabled: true,
      companyWebsite: 'https://test.com',
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockApiJobs = [
      { id: 'job1', title: 'Remote Engineer', jobUrl: 'url1', isListed: true, isRemote: true },
      { id: 'job2', title: 'Office Job', jobUrl: 'url2', isListed: true, isRemote: false }, // Will be processed but maybe irrelevant later
      { id: 'job3', title: 'Unlisted Job', jobUrl: 'url3', isListed: false, isRemote: true }, // Fetcher sends, processor rejects
    ];

    const mockApiResponse = { data: { jobs: mockApiJobs } };
    (axios.get as jest.Mock).mockResolvedValue(mockApiResponse);

    // Mock the adapter to simulate successful processing for the first two
    (jobProcessingAdapter.processRawJob as jest.Mock)
      .mockImplementation(async (sourceType, rawJob, sourceData) => {
         // Simulate processor determining relevance and saving
         // Let's say job1 and job2 are processed, job3 is filtered by processor (though fetcher sends it)
         const job = rawJob as any;
         if (job.jobUrl === 'url1' || job.jobUrl === 'url2') {
             return true; // Indicate successful processing/saving
         } 
         return false; // Indicate not saved (e.g., irrelevant by processor)
      });

    const result = await ashbyFetcher.processSource(mockSource, mockLogger);

    // Assertions
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.ashbyhq.com/posting-api/job-board/test-board',
      { timeout: 45000 }
    );

    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledTimes(3); // Called for all jobs from API
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('ashby', mockApiJobs[0], mockSource);
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('ashby', mockApiJobs[1], mockSource);
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('ashby', mockApiJobs[2], mockSource);

    expect(result.stats.found).toBe(3);
    expect(result.stats.processed).toBe(2); // Only job1 and job2 were 'saved' by adapter mock
    expect(result.stats.relevant).toBe(2); // Fetcher counts processed as relevant for Ashby
    expect(result.stats.errors).toBe(0);
    expect(result.foundSourceIds).toEqual(new Set(['url1', 'url2', 'url3'])); // Contains all jobUrls found

    expect(mockLogger.info).toHaveBeenCalledWith({ jobBoardName: 'test-board', apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/test-board' }, `-> Starting processing...`);
    expect(mockLogger.info).toHaveBeenCalledWith('+ 3 jobs found in API response.');
    expect(mockLogger.info).toHaveBeenCalledWith('✓ Processing completed.');
  });

  it('should handle API errors gracefully', async () => {
    const mockError = new Error('Internal Server Error') as AxiosError;
    mockError.isAxiosError = true;
    mockError.response = { status: 500, data: 'Server Error', statusText: 'Internal Server Error' } as any;
    // Define the request config for the error object
    mockError.config = {
      url: 'https://api.ashbyhq.com/posting-api/job-board/test-board'
    } as any;
    (axios.get as jest.Mock).mockRejectedValue(mockError);

    // Use the same mockSource as the success test
    const mockSource: JobSource = {
      id: 'source1',
      name: 'Test Ashby Source',
      type: 'ashby',
      config: { jobBoardName: 'test-board' },
      isEnabled: true,
      companyWebsite: 'https://test.com',
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await ashbyFetcher.processSource(mockSource, mockLogger);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(jobProcessingAdapter.processRawJob).not.toHaveBeenCalled();
    expect(result.stats.found).toBe(0);
    expect(result.stats.processed).toBe(0);
    expect(result.stats.relevant).toBe(0);
    expect(result.stats.errors).toBe(1);
    expect(result.foundSourceIds.size).toBe(0);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ 
            status: 500,
            message: 'Internal Server Error',
            url: mockError.config.url
        }),
        expect.stringContaining('Axios error fetching jobs for source')
    );
  });

  it('should handle empty API response', async () => {
      const mockEmptyResponse = { data: { jobs: [] } };
      (axios.get as jest.Mock).mockResolvedValue(mockEmptyResponse);
  
      // Use the same mockSource as the success test
      const mockSource: JobSource = {
        id: 'source1',
        name: 'Test Ashby Source',
        type: 'ashby',
        config: { jobBoardName: 'test-board' },
        isEnabled: true,
        companyWebsite: 'https://test.com',
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
  
      const result = await ashbyFetcher.processSource(mockSource, mockLogger);
  
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(jobProcessingAdapter.processRawJob).not.toHaveBeenCalled();
      expect(result.stats.found).toBe(0);
      expect(result.stats.processed).toBe(0);
      expect(result.stats.relevant).toBe(0);
      expect(result.stats.errors).toBe(0);
      expect(result.foundSourceIds.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('No jobs found for this source.');
      expect(mockLogger.error).not.toHaveBeenCalled(); // Ensure no errors logged
    });

  it('should handle invalid source config', async () => {
    // Mock getAshbyConfig to return null
    (getAshbyConfig as jest.Mock).mockReturnValue(null);

    // Use a source with potentially valid structure but config will be mocked as invalid
    const mockSource: JobSource = {
        id: 'source1',
        name: 'Test Ashby Source Invalid Config',
        type: 'ashby',
        config: { someOtherProp: 'value' }, // Config doesn't have jobBoardName
        isEnabled: true,
        companyWebsite: 'https://test.com',
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

    const result = await ashbyFetcher.processSource(mockSource, mockLogger);

    expect(getAshbyConfig).toHaveBeenCalledWith(mockSource.config);
    expect(axios.get).not.toHaveBeenCalled(); // API should not be called
    expect(jobProcessingAdapter.processRawJob).not.toHaveBeenCalled();
    expect(result.stats.found).toBe(0);
    expect(result.stats.processed).toBe(0);
    expect(result.stats.relevant).toBe(0);
    expect(result.stats.errors).toBe(1);
    expect(result.foundSourceIds.size).toBe(0);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Missing or invalid jobBoardName in source config'
    );
  });
}); 
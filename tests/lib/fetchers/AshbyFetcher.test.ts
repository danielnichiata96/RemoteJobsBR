import { PrismaClient, JobSource } from '@prisma/client';
// import pino from 'pino'; // Remove direct import
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { AshbyFetcher } from '../../../src/lib/fetchers/AshbyFetcher'; // Adjust path
import { JobProcessingAdapter } from '../../../src/lib/adapters/JobProcessingAdapter';
import { FilterConfig } from '../../../src/types/JobSource';
import { AshbyApiJob, FilterResult } from '../../../src/lib/fetchers/types'; // Import AshbyApiJob

// --- Mocks ---
jest.mock('axios');
jest.mock('fs');
jest.mock('../../../src/lib/adapters/JobProcessingAdapter');
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({})),
    JobSourceType: { 
        ASHBY: 'ashby',
        GREENHOUSE: 'greenhouse',
        LEVER: 'lever'
    }
}));

// Mock Pino logger consistently with AshbyProcessor.test.ts
jest.mock('pino', () => {
    // Define the mock logger instance directly inside the factory
    const logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn(),
        silent: jest.fn(),
        level: 'info',
        child: jest.fn(),
        bindings: jest.fn(() => ({ pid: 123, hostname: 'test' })), 
        version: 'mock-version'
    };
    // Ensure child returns the same instance
    logger.child.mockImplementation(() => logger);
    // Return the factory function that returns the instance
    return jest.fn(() => logger);
});

// Helper to get the logger instance
const getMockLoggerInstance = () => {
    const pinoMockFactory = jest.requireMock('pino') as jest.Mock;
    return pinoMockFactory();
};

// Mock textUtils (if needed, though _isJobRelevant uses internal stripHtml)
jest.mock('../../../src/lib/utils/textUtils', () => ({
    stripHtml: jest.fn((html) => {
        if (!html) return '';
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }),
}));

// --- Test Helpers ---

// Helper to create a minimal JobSource object for tests
const createMockJobSource = (configOverrides = {}): JobSource => ({
    id: 'test-source-id-ashby',
    type: 'ashby', // Set type to ashby
    name: 'Test Ashby Company',
    // url: 'https://example.com', // Removed - Field likely doesn't exist
    // externalId: null, // Removed - Field likely doesn't exist
    config: { jobBoardName: 'test-board-name', ...configOverrides }, // Default Ashby config
    isEnabled: true,
    lastFetched: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    // companyId: 'test-company-id-ashby', // Removed - Field likely doesn't exist
    // Assuming companyWebsite and logoUrl might exist from previous edits or schema
    companyWebsite: null,
    logoUrl: null,
});

// Helper function to create mock AshbyApiJob data
const createMockAshbyJob = (overrides: Partial<AshbyApiJob>): AshbyApiJob => ({
    id: `job_${Math.random().toString(36).substring(2, 15)}`, // Random UUID-like string
    title: 'Software Engineer',
    location: 'Remote', // Default ambiguous remote
    isRemote: true, // Default to true
    isListed: true, // Default to listed
    descriptionHtml: '<p>Default job description.</p>',
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    applyUrl: 'https://jobs.ashbyhq.com/test/apply',
    jobUrl: 'https://jobs.ashbyhq.com/test/job',
    organizationName: 'Test Org',
    employmentType: 'FullTime',
    ...overrides, // Apply specific overrides
    // Ensure nested structures exist if overridden
    address: overrides.address === undefined ? undefined : { postalAddress: overrides.address?.postalAddress },
    secondaryLocations: overrides.secondaryLocations || [],
});

// Sample Filter Config (Load from file or use a static mock)
// For simplicity, using a static mock similar to Greenhouse tests
const sampleFilterConfig: FilterConfig = {
    // Use the same config as Greenhouse for now, can be adjusted later if needed
     REMOTE_METADATA_FIELDS: {
        REMOTE_FIELD_PATH: '', 
        REMOTE_FIELD_VALUES: []
     },
    LOCATION_KEYWORDS: {
        STRONG_POSITIVE_GLOBAL: ["remote worldwide", "global remote", "fully remote", "work from anywhere"],
        STRONG_POSITIVE_LATAM: ["remote latam", "remote brazil", "remote - americas", "latin america"],
        STRONG_NEGATIVE_RESTRICTION: ["us only", "uk only", "berlin", "romania", "based in us", "located in the us", "usa", "u.s.", "uk"],
        AMBIGUOUS: ["remote", "flexible"],
        ACCEPT_EXACT_LATAM_COUNTRIES: ["brazil", "argentina"]
    },
    CONTENT_KEYWORDS: {
        STRONG_POSITIVE_GLOBAL: ["work from anywhere", "globally remote", "worldwide"],
        STRONG_POSITIVE_LATAM: ["latin america", "latam", "brazil"],
        STRONG_NEGATIVE_REGION: ["eligible to work in the us", "must reside in the uk", "based in london", "usa", "u.s.", "us residency"],
        STRONG_NEGATIVE_TIMEZONE: ["pst timezone", "cet timezone"]
    },
};

// --- Test Suites ---

// Cast axios for mocking
const mockedAxios = jest.requireMock('axios') as jest.Mocked<typeof axios>; // Use requireMock

describe('AshbyFetcher - processSource', () => {
    let fetcherInstance: AshbyFetcher;
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockJobProcessor: jest.Mocked<JobProcessingAdapter>;
    // We will now get the single mock logger instance instead of separate parent/source/job loggers
    let mockLogger: ReturnType<typeof getMockLoggerInstance>; 
    let mockSource: JobSource;

    beforeEach(() => {
        // Get and clear the single mock logger instance
        mockLogger = getMockLoggerInstance();
        Object.keys(mockLogger)
            .filter(key => typeof (mockLogger as any)[key]?.mockClear === 'function')
            .forEach(key => (mockLogger as any)[key].mockClear());
        // Clear the pino factory mock
        (jest.requireMock('pino') as jest.Mock).mockClear();
        // Re-setup child mock
        mockLogger.child.mockImplementation(() => mockLogger);
        
        // Clear other mocks
        jest.clearAllMocks();
        // Explicitly clear axios mock
        mockedAxios.get.mockClear();

        mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
        mockJobProcessor = new JobProcessingAdapter() as jest.Mocked<JobProcessingAdapter>;

        mockSource = createMockJobSource({ jobBoardName: 'real-board' });

        // Update fs.readFileSync mock for more flexible path matching
        const expectedConfigEnding = path.normalize('src/config/ashby-filter-config.json'); 
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            // Normalize the input path for consistent comparison
            const normalizedFilePath = path.normalize(filePath);
            if (normalizedFilePath.endsWith(expectedConfigEnding)) {
                return JSON.stringify(sampleFilterConfig);
            }
            // Log unexpected path for debugging
            console.warn(`fs.readFileSync mock called with unexpected path: ${filePath} (normalized: ${normalizedFilePath})`);
            throw new Error(`fs.readFileSync mock called with unexpected path: ${filePath}`);
        });

        // Instantiate AFTER setting up mocks
        fetcherInstance = new AshbyFetcher(mockPrisma, mockJobProcessor);
    });

    it('should successfully fetch and process relevant jobs', async () => {
        const relevantJob = createMockAshbyJob({ id: 'job-1', isRemote: true, title: 'Relevant Remote Engineer' });
        const irrelevantJob = createMockAshbyJob({ id: 'job-2', isRemote: false, location: 'Office in Berlin' });
        const notListedJob = createMockAshbyJob({ id: 'job-3', isListed: false });

        mockedAxios.get.mockResolvedValue({
            status: 200,
            data: { jobs: [relevantJob, irrelevantJob, notListedJob] }
        });

        // Mock processor to indicate success for the relevant job
        mockJobProcessor.processRawJob.mockResolvedValue(true);

        const result = await fetcherInstance.processSource(mockSource, mockLogger);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://api.ashbyhq.com/posting-api/job-board/real-board', 
            expect.objectContaining({ headers: { 'Accept': 'application/json' } })
        );
        expect(result.stats.found).toBe(3);
        expect(result.stats.relevant).toBe(1);
        expect(result.stats.processed).toBe(1);
        expect(result.stats.errors).toBe(0);
        expect(result.errorMessage).toBeUndefined();
        expect(result.foundSourceIds.size).toBe(3);
        expect(result.foundSourceIds.has('job-1')).toBe(true);
        expect(result.foundSourceIds.has('job-2')).toBe(true);
        expect(result.foundSourceIds.has('job-3')).toBe(true);

        // Check that processRawJob was called only for the relevant job
        expect(mockJobProcessor.processRawJob).toHaveBeenCalledTimes(1);
        expect(mockJobProcessor.processRawJob).toHaveBeenCalledWith('ashby', expect.objectContaining({ id: 'job-1' }), mockSource);

        // Check logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('+ 3 jobs found'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('✓ Processing completed.'));
    });

    it('should handle errors during API fetch (axios reject)', async () => {
        const apiError = new Error('Network Error');
        mockedAxios.get.mockRejectedValue(apiError);

        const result = await fetcherInstance.processSource(mockSource, mockLogger);

        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(result.stats.found).toBe(0);
        expect(result.stats.relevant).toBe(0);
        expect(result.stats.processed).toBe(0);
        expect(result.stats.errors).toBe(1);
        expect(result.errorMessage).toContain('General processing error: Network Error');
        // More specific assertion for the logged object
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({ message: 'Network Error' }),
                msg: expect.stringContaining('General error processing source')
            })
             // Removed second argument assertion as Pino might only take one object arg here
        );
    });
    
    it('should handle errors during API fetch (axios 404 response)', async () => {
        // Create a more realistic AxiosError mock
        const apiError = new Error('Request failed with status code 404') as any; // Start with a basic Error
        apiError.isAxiosError = true;
        apiError.response = { status: 404, data: 'Not Found' };
        apiError.config = { url: 'https://api.ashbyhq.com/posting-api/job-board/real-board', headers: {} }; // Add mock config
        apiError.request = {}; // Add mock request
        apiError.name = 'AxiosError';
        apiError.code = 'ERR_BAD_REQUEST';

        // Mock the static isAxiosError method specifically for this test
        const isAxiosErrorSpy = jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

        mockedAxios.get.mockRejectedValue(apiError);

        const result = await fetcherInstance.processSource(mockSource, mockLogger);

        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(result.stats.found).toBe(0);
        expect(result.stats.relevant).toBe(0);
        expect(result.stats.processed).toBe(0);
        expect(result.stats.errors).toBe(1);
        // Expect the message formatted by the Axios-specific block
        expect(result.errorMessage).toContain('Axios error (ERR_BAD_REQUEST - status 404): Request failed with status code 404');
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ status: 404, code: 'ERR_BAD_REQUEST', url: expect.any(String) }),
            expect.stringContaining('Axios error fetching jobs')
        );

        // Restore the original implementation after the test
        isAxiosErrorSpy.mockRestore();
    });

    it('should handle invalid API response structure', async () => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: { message: 'Success but no jobs array' } });

        const result = await fetcherInstance.processSource(mockSource, mockLogger);

        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(result.stats.found).toBe(0);
        expect(result.stats.relevant).toBe(0);
        expect(result.stats.processed).toBe(0);
        expect(result.stats.errors).toBe(1);
        expect(result.errorMessage).toBe('Invalid response structure from Ashby API');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: 200 }), expect.stringContaining('Invalid response structure from Ashby API'));
    });

    it('should handle invalid source configuration (missing jobBoardName)', async () => {
        // Ensure the config truly lacks jobBoardName
        const invalidSource = createMockJobSource({ jobBoardName: undefined }); // Explicitly undefined

        const result = await fetcherInstance.processSource(invalidSource, mockLogger);

        expect(mockedAxios.get).not.toHaveBeenCalled(); // Assertion remains the same
        expect(result.stats.errors).toBe(1);
        expect(result.errorMessage).toBe('Invalid jobBoardName in source config');
        expect(mockLogger.error).toHaveBeenCalledWith('❌ Missing or invalid jobBoardName in source config');
    });

    it('should handle filter config load failure', async () => {
        // --- Setup for this specific test ---
        // Mock fs to throw error FIRST
        const configError = new Error('Failed to read config');
        const expectedConfigPath = path.resolve(__dirname, '../../../src/config/ashby-filter-config.json');
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            if (filePath === expectedConfigPath) {
                 throw configError;
            }
            // Allow other reads if necessary, or throw unexpected path error
            throw new Error(`fs.readFileSync mock called with unexpected path: ${filePath}`);
        });

        // Clear mocks that might interfere
        jest.clearAllMocks(); 

        // Re-setup necessary mocks (axios, adapter, prisma, logger)
        const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
        const mockJobProcessor = new JobProcessingAdapter() as jest.Mocked<JobProcessingAdapter>;
        const mockLogger = getMockLoggerInstance();
        const mockSource = createMockJobSource({ jobBoardName: 'config-fail-board' });

        // Instantiate fetcher AFTER faulty fs mock setup but with other mocks ready
        // Note: We need access to the correctly typed mockedAxios from the outer scope
        const localFetcherInstance = new AshbyFetcher(mockPrisma, mockJobProcessor);

        // Mock axios (using the properly typed outer-scope mockedAxios) to return jobs
        const jobThatNeedsConfig = createMockAshbyJob({ id: 'job-cfg-fail', location: 'Remote (US Only)'});
        mockedAxios.get.mockResolvedValue({ status: 200, data: { jobs: [jobThatNeedsConfig] } });
        mockJobProcessor.processRawJob.mockResolvedValue(true);
        // --- End Setup ---

        const result = await localFetcherInstance.processSource(mockSource, mockLogger);

        // Verify config load error was logged during instantiation or first call
        // The error is logged inside _loadFilterConfig which is called by constructor and processSource
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: configError }),
            expect.stringContaining('Failed to load or parse filter configuration')
        );

        // Verify processing continued without config
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(result.stats.found).toBe(1);
        // Since config failed, filtering is skipped, job defaults to relevant if isRemote=true
        expect(result.stats.relevant).toBe(1);
        expect(result.stats.processed).toBe(1);
        expect(result.stats.errors).toBe(0); // Config load failure isn't counted in stats.errors
        expect(result.errorMessage).toBeUndefined();
        expect(mockJobProcessor.processRawJob).toHaveBeenCalledWith('ashby', expect.objectContaining({ id: 'job-cfg-fail' }), mockSource);
    });

    it('should handle individual job processing errors correctly', async () => {
        const job1 = createMockAshbyJob({ id: 'ok-1' });
        const jobWithError = createMockAshbyJob({ id: 'err-1' });
        const job3 = createMockAshbyJob({ id: 'ok-2' });
        const processError = new Error('Processor failed for this job');

        mockedAxios.get.mockResolvedValue({ status: 200, data: { jobs: [job1, jobWithError, job3] } });

        // Mock processor to throw error for the specific job
        mockJobProcessor.processRawJob
            .mockResolvedValueOnce(true) // job1
            .mockImplementationOnce(async () => { throw processError; }) // jobWithError
            .mockResolvedValueOnce(true); // job3

        const result = await fetcherInstance.processSource(mockSource, mockLogger);

        expect(result.stats.found).toBe(3);
        expect(result.stats.relevant).toBe(3); // All initially marked relevant
        expect(result.stats.processed).toBe(2); // Only ok-1 and ok-2
        expect(result.stats.errors).toBe(1); // Error during processing jobWithError
        expect(result.errorMessage).toContain(`Job err-1 (Software Engineer): ${processError.message}`);
        expect(mockJobProcessor.processRawJob).toHaveBeenCalledTimes(3);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ message: processError.message }) }), expect.stringContaining('Error processing individual job'));
    });

    // TODO: Add test for stats aggregation if needed

});

describe('AshbyFetcher - _isJobRelevant', () => {
    let fetcherInstance: any; // Use 'any' to access private methods
    let mockLogger: ReturnType<typeof getMockLoggerInstance>;
    let mockJob: AshbyApiJob;

    // Load sample config directly for these tests
    const testFilterConfig: FilterConfig = {
        LOCATION_KEYWORDS: {
            STRONG_POSITIVE_GLOBAL: ["worldwide", "global"],
            STRONG_POSITIVE_LATAM: ["latam", "brazil", "remote brazil"],
            ACCEPT_EXACT_BRAZIL_TERMS: ["brazil"],
            STRONG_NEGATIVE_RESTRICTION: ["us only", "berlin", "clt"],
            AMBIGUOUS: ["remote"],
        },
        CONTENT_KEYWORDS: {
            STRONG_POSITIVE_GLOBAL: ["work from anywhere"],
            STRONG_POSITIVE_LATAM: ["latin america"],
            ACCEPT_EXACT_BRAZIL_TERMS: ["brazil"],
            STRONG_NEGATIVE_REGION: ["usa", "must reside in the uk", "clt"],
            STRONG_NEGATIVE_TIMEZONE: []
        },
        PROCESS_JOBS_UPDATED_AFTER_DATE: "2024-01-01T00:00:00Z"
    };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockLogger = getMockLoggerInstance(); // Get mock logger

        // Mock fs.readFileSync to return our test config
        const expectedConfigEnding = path.normalize('src/config/ashby-filter-config.json');
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            const normalizedFilePath = path.normalize(filePath);
            if (normalizedFilePath.endsWith(expectedConfigEnding)) {
                return JSON.stringify(testFilterConfig); // Return our specific test config
            }
            throw new Error(`fs.readFileSync mock called with unexpected path: ${filePath}`);
        });

        // Instantiate fetcher - config should be loaded by constructor
        // We need Prisma/Adapter mocks even if not directly used by _isJobRelevant
        const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
        const mockJobProcessor = new JobProcessingAdapter() as jest.Mocked<JobProcessingAdapter>;
        fetcherInstance = new AshbyFetcher(mockPrisma, mockJobProcessor);

        // Reset mock job data
        mockJob = createMockAshbyJob({
            updatedAt: new Date('2024-02-01T00:00:00Z').toISOString() // After threshold
        }); 
    });

    it('should return relevant: true for explicitly remote job with no restrictions', () => {
        mockJob.isRemote = true;
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Marked as remote');
    });

    it('should return relevant: false if job is not listed', () => {
        mockJob.isListed = false;
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toBe('Job not listed');
    });

    it('should return relevant: false if job updated before threshold date', () => {
        mockJob.updatedAt = new Date('2023-12-31T00:00:00Z').toISOString();
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('updated before');
    });

    it('should return relevant: false if location indicates restriction', () => {
        mockJob.location = 'Office in Berlin';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location indicates Restriction');
        expect(result.reason).toContain('berlin');
    });

    it('should return relevant: false if content indicates restriction (CLT)', () => {
        mockJob.descriptionHtml = '<p>This role follows CLT regulations.</p>';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Content indicates Specific Restriction');
        expect(result.reason).toContain('clt');
    });

    it('should return relevant: true (latam) if location indicates LATAM', () => {
        mockJob.location = 'Remote - Brazil';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Location indicates LATAM');
        expect(result.reason).toContain('brazil');
    });

    it('should return relevant: true (latam) if content indicates LATAM', () => {
        mockJob.descriptionHtml = '<p>Team based in Latin America.</p>';
        mockJob.location = 'Remote'; // Ambiguous location
        mockJob.isRemote = false;
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Content indicates LATAM');
        expect(result.reason).toContain('latin america');
    });

    it('should return relevant: true (global) if location indicates GLOBAL', () => {
        mockJob.location = 'Remote Worldwide';
        mockJob.isRemote = false; // Test keyword overrides isRemote=false
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Location indicates Global');
        expect(result.reason).toContain('worldwide'); // Uses original keyword
    });

    it('should return relevant: true (global) if content indicates GLOBAL', () => {
        mockJob.descriptionHtml = '<p>You can work from anywhere.</p>';
        mockJob.location = 'Flexible';
        mockJob.isRemote = false;
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Content indicates Global');
        expect(result.reason).toContain('work from anywhere');
    });

    it('should return relevant: false if LATAM signal exists but REJECT signal also exists', () => {
        mockJob.location = 'Remote Brazil (US Only)'; // Location has both
        mockJob.descriptionHtml = '<p>Hiring in Latin America.</p>'; // Content is positive LATAM
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location indicates Restriction'); 
        expect(result.reason).toContain('us only'); // REJECT should take precedence
    });

    it('should return relevant: false if not explicitly remote and no keywords match', () => {
        mockJob.isRemote = false;
        mockJob.location = 'Somewhere Else';
        mockJob.descriptionHtml = '<p>Standard job.</p>';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Not explicitly remote and ambiguous keywords'); // Or similar default reason
    });

    it('should return relevant: false if only ambiguous keyword and not explicitly remote', () => {
        mockJob.isRemote = false;
        mockJob.location = 'Remote position'; // Only ambiguous keyword
        mockJob.descriptionHtml = '<p>Standard job.</p>';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Not explicitly remote and ambiguous keywords');
    });
}); 
import { PrismaClient, JobSource } from '@prisma/client';
import pino from 'pino';
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
    // Mock necessary enums if used directly in tests (unlikely for fetcher)
    JobSourceType: { 
        ASHBY: 'ashby',
        GREENHOUSE: 'greenhouse',
        LEVER: 'lever'
    }
}));

// Mock Pino logger
const mockedPino = (): pino.Logger => {
    const mock: any = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn(), 
        silent: jest.fn(), 
        level: 'info', 
        // Simple child mock: returns the same mock instance
        child: jest.fn(function(this: any) { return this; }),
        bindings: jest.fn(() => ({ pid: 123, hostname: 'test' })), 
        version: 'mock-version'
    };
    // Ensure child returns the mock itself
    mock.child.mockImplementation(function(this: any) { return this; }); 

    return mock as pino.Logger;
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
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AshbyFetcher - processSource', () => {
    let fetcherInstance: AshbyFetcher;
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockJobProcessor: jest.Mocked<JobProcessingAdapter>;
    let mockParentLogger: ReturnType<typeof mockedPino>;
    let mockSourceLogger: ReturnType<typeof mockedPino>;
    let mockJobLoggers: ReturnType<typeof mockedPino>[];
    let mockSource: JobSource;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
        mockJobProcessor = new JobProcessingAdapter() as jest.Mocked<JobProcessingAdapter>;
        mockParentLogger = mockedPino();
        mockSourceLogger = mockedPino();
        mockParentLogger.child = jest.fn().mockReturnValue(mockSourceLogger); 
        mockJobLoggers = [];
        mockSourceLogger.child = jest.fn().mockImplementation(() => { 
            const jobLogger = mockedPino();
            mockJobLoggers.push(jobLogger);
            return jobLogger;
        });

        mockSource = createMockJobSource({ jobBoardName: 'real-board' }); // Use a specific board name

        // Update fs.readFileSync mock to check the path
        const expectedConfigPath = path.resolve(__dirname, '../../../src/config/ashby-filter-config.json');
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            if (filePath === expectedConfigPath) {
                return JSON.stringify(sampleFilterConfig);
            }
            throw new Error(`fs.readFileSync mock called with unexpected path: ${filePath}`);
        });

        // Instantiate AFTER setting up the mock
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

        const result = await fetcherInstance.processSource(mockSource, mockParentLogger);

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
        expect(mockSourceLogger.info).toHaveBeenCalledWith(expect.stringContaining('+ 3 jobs found'));
        expect(mockSourceLogger.info).toHaveBeenCalledWith(expect.stringContaining('✓ Processing completed.'));
        expect(mockJobLoggers.length).toBe(3);
        expect(mockJobLoggers[0].trace).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining('Marked as remote') }), expect.stringContaining('Relevant job found'));
        expect(mockJobLoggers[1].trace).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining('Location indicates Restriction: \"berlin\"') }), expect.stringContaining('Job skipped as irrelevant'));
        expect(mockJobLoggers[2].trace).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining('Job not listed') }), expect.stringContaining('Job skipped as irrelevant'));
    });

    it('should handle errors during API fetch', async () => {
        // TODO: Implement test
    });
    
    it('should handle invalid API response', async () => {
        // TODO: Implement test
    });

    it('should handle invalid source configuration', async () => {
        // TODO: Implement test
    });

    it('should correctly aggregate stats', async () => {
        // TODO: Implement test
    });
});

describe('AshbyFetcher - _isJobRelevant', () => {
    let fetcherInstance: any; // Use 'any' to access private methods
    let mockLogger: ReturnType<typeof mockedPino>;

    beforeEach(() => {
        jest.clearAllMocks();
        const mockPrisma = {} as PrismaClient;
        const mockAdapter = {} as JobProcessingAdapter;
        
        // Mock fs.readFileSync for this suite as well
        const expectedConfigPath = path.resolve(__dirname, '../../../src/config/ashby-filter-config.json');
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            if (filePath === expectedConfigPath) {
                return JSON.stringify(sampleFilterConfig);
            }
            throw new Error(`fs.readFileSync mock called with unexpected path: ${filePath}`);
        });

        // Instantiate AFTER setting up the mock
        fetcherInstance = new AshbyFetcher(mockPrisma, mockAdapter);
        mockLogger = mockedPino();
    });

    it('should return relevant=true for explicitly remote job with no restrictions', () => {
        const job = createMockAshbyJob({
            isRemote: true,
            location: 'Remote',
            descriptionHtml: 'Standard job description.',
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Marked as remote');
    });

    it('should return relevant=false for non-listed jobs', () => {
        const job = createMockAshbyJob({ isListed: false, isRemote: true });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Job not listed');
    });
    
    it('should return relevant=false if isRemote=false and no strong LATAM/Global signal', () => {
        const job = createMockAshbyJob({
            isRemote: false,
            location: 'Some Office Location', // Not explicitly remote or LATAM/Global
            descriptionHtml: 'Standard description.'
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Ambiguous or No Positive Signal');
    });

    it('should return relevant=false if location indicates restriction', () => {
        const job = createMockAshbyJob({
            isRemote: false, // Even if true, restriction should override
            location: 'Office in Berlin' // Matches STRONG_NEGATIVE_RESTRICTION
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location indicates Restriction: \"berlin\"');
    });

    it('should return relevant=false if primary address indicates restriction', () => {
        const job = createMockAshbyJob({
            isRemote: true,
            address: { 
                postalAddress: { 
                    addressLocality: 'London', // Example city
                    addressCountry: 'UK'     // Example country triggering restriction
                } 
            }, 
            location: 'Remote' // Location itself is fine
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location indicates Restriction: \"uk\"');
    });

    it('should return relevant=false if secondary location indicates restriction', () => {
        const job = createMockAshbyJob({
            isRemote: true,
            secondaryLocations: [{ location: 'Office in US Only' }]
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location indicates Restriction: \"us only\"');
    });

    it('should return relevant=false if content indicates restriction', () => {
        const job = createMockAshbyJob({
            isRemote: true, // Even if remote...
            descriptionHtml: 'Must be based in the US.' // Matches content negative
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Content indicates Specific Restriction via keyword/pattern');
    });

    it('should return relevant=true for LATAM jobs based on location', () => {
        const job = createMockAshbyJob({
            isRemote: false, // Not necessarily remote
            location: 'Buenos Aires, Argentina' // Matches ACCEPT_EXACT_LATAM_COUNTRIES
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Location indicates specific LATAM country: \"argentina\"');
    });

    it('should return relevant=true for LATAM jobs based on content', () => {
        const job = createMockAshbyJob({
            isRemote: false,
            location: 'Somewhere Else', // Non-restrictive, non-LATAM location
            descriptionHtml: '<p>We are hiring across Latin America!</p>' // Matches content positive
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Content indicates LATAM: \"latin america\"');
    });

    it('should return relevant=true for GLOBAL jobs based on location (when isRemote=false)', () => {
        const job = createMockAshbyJob({
            isRemote: false, // Explicitly not remote flag
            location: 'Remote Worldwide' // Matches location positive global
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Location indicates Global: \"remote worldwide\"');
    });

    it('should return relevant=true for GLOBAL jobs based on content (when isRemote=false)', () => {
         const job = createMockAshbyJob({
            isRemote: false, // Explicitly not remote flag
            location: 'Anywhere', // Non-restrictive, non-global location
            descriptionHtml: 'This is a globally remote position.' // Matches content positive
         });
         const result = fetcherInstance._isJobRelevant(job, mockLogger);
         expect(result.relevant).toBe(true);
         expect(result.type).toBe('global');
         expect(result.reason).toContain('Content indicates Global: \"globally remote\"');
    });

    it('should prioritize location LATAM signal over conflicting content REJECT signal', () => {
        const job = createMockAshbyJob({
            isRemote: false,
            location: 'Remote - Americas', // Matches STRONG_POSITIVE_LATAM
            descriptionHtml: 'Must reside in the UK.' // Matches STRONG_NEGATIVE_REGION in content
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(true); 
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Location indicates LATAM: \"remote - americas\"');
    });

     it('should prioritize content LATAM signal even if location is restrictive (if location check is UNKNOWN)', () => {
        const job = createMockAshbyJob({
            isRemote: true, // Remote flag means location text might be ignored or less prioritized initially
            location: 'Office in USA', // This would normally reject if isRemote=false
            descriptionHtml: 'Hiring in Brazil and Argentina only.' // Matches content LATAM
        });
        const result = fetcherInstance._isJobRelevant(job, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location indicates Restriction: \"usa\"');
    });
}); 
import { PrismaClient, JobSource, JobSourceType } from '@prisma/client';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { GreenhouseFetcher } from '../../../src/lib/fetchers/greenhouseFetcher';
import { JobProcessingAdapter } from '../../../src/lib/adapters/JobProcessingAdapter';
import { FilterConfig } from '../../../src/types/JobSource';
import { GreenhouseJob, GreenhouseMetadata, GreenhouseOffice, FilterResult } from '../../../src/lib/fetchers/types';
import axios, { AxiosError } from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('../../../src/lib/adapters/JobProcessingAdapter');
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({})), // Mock PrismaClient constructor
    JobStatus: { ACTIVE: 'ACTIVE', CLOSED: 'CLOSED' },
    JobType: { FULL_TIME: 'FULL_TIME', PART_TIME: 'PART_TIME', CONTRACT: 'CONTRACT', INTERNSHIP: 'INTERNSHIP' },
    ExperienceLevel: { JUNIOR: 'JUNIOR', MID_LEVEL: 'MID_LEVEL', SENIOR: 'SENIOR', STAFF: 'STAFF', PRINCIPAL: 'PRINCIPAL' },
    JobSourceType: { // Add enum mock if needed
        GREENHOUSE: 'GREENHOUSE',
        ASHBY: 'ASHBY'
    }
}));

// Modified mockedPino to return new mocks for child loggers
const mockedPino = () => {
    const loggerInstance = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        // Crucially, child() now returns a *new* mock instance
        child: jest.fn().mockImplementation(() => mockedPino()),
    };
    return loggerInstance;
};

// Explicitly mock the textUtils module
jest.mock('../../../src/lib/utils/textUtils', () => ({
    stripHtml: jest.fn((html) => {
        // Basic mock implementation
        if (!html) return '';
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }),
    // parseDate is not used in GreenhouseFetcher, but mock it just in case
    parseDate: jest.fn((ds) => ds ? new Date(ds) : undefined),
}));

// Helper to create a minimal JobSource object for tests
const createMockJobSource = (configOverrides = {}): JobSource => ({
    id: 'test-source-id',
    type: 'greenhouse',
    name: 'Test Company',
    description: null,
    url: 'https://example.com',
    externalId: 'test-board-token',
    config: { boardToken: 'test-board-token', ...configOverrides }, // Ensure boardToken is present
    isEnabled: true,
    lastFetched: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    companyId: 'test-company-id',
});

// Sample Filter Config (similar to greenhouse-filter-config.json)
const sampleFilterConfig: FilterConfig = {
    REMOTE_METADATA_FIELDS: {
        'remote status': { type: 'string', positiveValues: ['fully remote', 'worldwide'] },
        'geo scope': { type: 'string', allowedValues: ['worldwide', 'global', 'latam', 'americas'] },
        'location requirement': { type: 'string', disallowedValues: ['us only', 'eu only', 'usa'] }
    },
    LOCATION_KEYWORDS: {
        STRONG_POSITIVE_GLOBAL: ['remote worldwide', 'global remote'],
        STRONG_POSITIVE_LATAM: ['remote latam', 'remote brazil'],
        STRONG_NEGATIVE_RESTRICTION: ['remote (us)', 'remote - usa', 'uk only', 'remote berlin'],
        AMBIGUOUS: ['remote']
    },
    CONTENT_KEYWORDS: {
        STRONG_POSITIVE_GLOBAL: ['work from anywhere', 'globally remote'],
        STRONG_POSITIVE_LATAM: ['latin america', 'brazil'],
        STRONG_NEGATIVE_REGION: ['eligible to work in the us', 'must reside in the uk', 'based in london'],
        STRONG_NEGATIVE_TIMEZONE: ['pst timezone', 'cet timezone']
    },
    VERSION: '1.0',
    GLOBAL_KEYWORDS: {
        TITLE_MUST_INCLUDE: ['Remote'],
        TITLE_MUST_NOT_INCLUDE: ['Hybrid', 'Onsite', 'On-site'],
        CONTENT_MUST_INCLUDE_ANY: [],
        CONTENT_MUST_INCLUDE_ALL: [],
        CONTENT_MUST_NOT_INCLUDE: ['office', 'in-person', 'local candidates', 'specific city', 'london', 'new york', 'san francisco'],
        LOCATION_MUST_INCLUDE: ['Remote', 'Global', 'Anywhere'],
        LOCATION_MUST_NOT_INCLUDE: ['Hybrid', 'On-site', 'New York', 'London'],
    },
    LATAM_KEYWORDS: {
        TITLE_MUST_INCLUDE: [],
        TITLE_MUST_NOT_INCLUDE: [],
        CONTENT_MUST_INCLUDE_ANY: ['LATAM', 'Latin America', 'South America', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'Mexico'],
        CONTENT_MUST_INCLUDE_ALL: [],
        CONTENT_MUST_NOT_INCLUDE: ['Europe', 'Asia', 'US Only', 'Canada Only', 'EMEA', 'APAC', 'USA'],
        LOCATION_MUST_INCLUDE: ['LATAM', 'Latin America', 'South America', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'Mexico', 'Remote - LATAM', 'Remote - Brazil'],
        LOCATION_MUST_NOT_INCLUDE: ['USA', 'Canada', 'EMEA', 'APAC'],
    },
    REMOTE_METADATA_FIELDS: {
        'location': { // Lowercase key
            type: 'string', // Added type for clarity based on usage
            ACCEPT_GLOBAL_VALUES: ['Remote', 'Fully Remote', 'Remote OK'],
            ACCEPT_LATAM_VALUES: ['Remote LATAM', 'Remote - Brazil'],
            REJECT_VALUES: ['Onsite', 'Hybrid', 'New York Office', 'London Based'],
            // Added other potential fields used in the logic for completeness
            allowedValues: ['Remote', 'Remote LATAM', 'worldwide', 'global', 'anywhere'], // Combine Global/LATAM for allowed
            disallowedValues: ['Onsite', 'Hybrid', 'New York Office'],
            positiveValues: ['Remote', 'Remote LATAM', 'Fully Remote'], // Example
        },
        'work arrangement': {
            type: 'string',
            ACCEPT_GLOBAL_VALUES: ['Remote'],
            ACCEPT_LATAM_VALUES: [],
            REJECT_VALUES: ['Hybrid', 'In Office'],
            disallowedValues: ['Hybrid', 'In Office'], // Example
            positiveValues: ['Remote'], // Example
        },
        'remote eligible': { // Example boolean type
            type: 'boolean',
            positiveValue: 'Yes', // Example positive boolean representation
            negativeValue: 'No' // Example negative boolean representation
        }
    },
    OFFICE_LOCATION_KEYWORDS: {
        ACCEPT_GLOBAL_IF_CONTAINS: ['Remote', 'Anywhere'],
        ACCEPT_LATAM_IF_CONTAINS: ['Brazil', 'Argentina', 'Colombia', 'Mexico', 'LATAM', 'Latin America'],
        REJECT_IF_CONTAINS: ['New York', 'London', 'San Francisco', 'On-site', 'Hybrid']
    },
    // Ensure LOCATION_KEYWORDS structure matches usage in _checkLocationName
    LOCATION_KEYWORDS: {
        ACCEPT_EXACT_LATAM_COUNTRIES: ['Brazil', 'Argentina', 'Colombia', 'Mexico', 'Chile', 'Peru'],
        STRONG_NEGATIVE_RESTRICTION: ['Onsite', 'On-site', 'Hybrid', 'New York', 'London', 'San Francisco'],
        STRONG_POSITIVE_GLOBAL: ['Global', 'Anywhere', 'Worldwide', 'Fully Remote'],
        STRONG_POSITIVE_LATAM: ['LATAM', 'Latin America', 'South America', 'Remote - LATAM', 'Remote - Brazil'],
        AMBIGUOUS: ['Flexible', 'Remote']
    },
    // Ensure CONTENT_KEYWORDS structure matches usage in _checkContentKeywords
    CONTENT_KEYWORDS: {
        STRONG_NEGATIVE_REGION: ['office', 'in-person', 'local candidates', 'specific city', 'london', 'new york', 'san francisco', 'est', 'pst', 'bst'], // Added timezone examples
        STRONG_POSITIVE_GLOBAL: ['fully remote', 'work from anywhere', 'remote ok', 'global remote'],
        STRONG_POSITIVE_LATAM: ['latam', 'latin america', 'south america', 'brazil', 'argentina', 'colombia', 'chile', 'mexico']
    }
};

// Helper function to create mock GreenhouseJob data
const createMockGreenhouseJob = (overrides: Partial<GreenhouseJob>): GreenhouseJob => ({
    id: Math.floor(Math.random() * 10000),
    title: 'Software Engineer',
    updated_at: new Date().toISOString(),
    location: { name: 'Remote' }, // Default ambiguous remote
    content: '<div>Job description content here.</div>',
    absolute_url: 'https://jobs.example.com/123',
    metadata: [],
    offices: [],
    departments: [{ name: 'Engineering' }],
    company: { name: 'Test Company GH' }, // Simulate company info from job data
    ...overrides,
});

describe('GreenhouseFetcher - Filter Logic', () => {
    let fetcherInstance: any; // Use 'any' to access private methods for testing
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockJobProcessor: jest.Mocked<JobProcessingAdapter>;
    let mockLogger: any;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
        mockJobProcessor = new JobProcessingAdapter(mockPrisma) as jest.Mocked<JobProcessingAdapter>;
        mockLogger = mockedPino();
        fetcherInstance = new GreenhouseFetcher(mockPrisma, mockJobProcessor);
    });

    // --- Rewritten tests for _isJobRelevant based on current logic --- 
    describe('_isJobRelevant', () => {

        // --- Metadata Tests --- 
        it('should REJECT based on metadata first', () => {
            const job = createMockGreenhouseJob({
                metadata: [{ name: 'Location Requirement', value: 'US Only' }], // REJECT from metadata
                location: { name: 'Remote LATAM' }, // Potentially ACCEPT_LATAM from location
                content: 'Work from Brazil!', // Potentially ACCEPT_LATAM from content
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Metadata indicates Restriction');
        });

        it('should ACCEPT_LATAM based on metadata first', () => {
            const job = createMockGreenhouseJob({
                metadata: [{ name: 'Geo Scope', value: 'LATAM' }], // ACCEPT_LATAM from metadata
                location: { name: 'Remote - USA' }, // Potentially REJECT from location
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('latam');
            expect(result.reason).toContain('Metadata(LATAM)');
        });
        
        // Test case for when metadata says GLOBAL, but location/content are UNKNOWN
        it('should ACCEPT_GLOBAL based on metadata when location/content are UNKNOWN', () => {
             const job = createMockGreenhouseJob({
                metadata: [{ name: 'Remote Status', value: 'Fully Remote' }], // ACCEPT_GLOBAL from metadata
                location: { name: 'Remote' }, // Ambiguous but should pass pattern check
                content: 'Standard job description.' // UNKNOWN from content
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(true); 
            expect(result.type).toBe('global');
            expect(result.reason).toContain('Metadata(Global)'); // Metadata takes priority
        });

        // --- Location Tests (assuming metadata is UNKNOWN) --- 
        it('should REJECT based on location keyword when metadata is UNKNOWN', () => { // Renamed slightly
            const job = createMockGreenhouseJob({
                metadata: [], // UNKNOWN
                location: { name: 'Remote - USA' }, // REJECT from location keyword
                content: 'Work from anywhere!', // Potentially ACCEPT_GLOBAL from content
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Location/Office indicates Restriction'); 
        });

        it('should ACCEPT_LATAM based on location keyword when metadata is UNKNOWN', () => { // Renamed slightly
            const job = createMockGreenhouseJob({
                metadata: [], // UNKNOWN
                location: { name: 'Remote LATAM' }, // ACCEPT_LATAM from location keyword
                content: 'Must be based in the US.', // Potentially REJECT from content
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('latam');
            expect(result.reason).toContain('Location/Office(LATAM)'); 
        });

        it('should ACCEPT_GLOBAL based on location keyword when metadata is UNKNOWN', () => { // Renamed slightly
            const job = createMockGreenhouseJob({
                metadata: [], // UNKNOWN
                location: { name: 'Remote Worldwide' }, // ACCEPT_GLOBAL from location keyword
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('global');
            expect(result.reason).toContain('Location/Office(Global)'); 
        });

        // --- Content Tests (assuming metadata and location are UNKNOWN/Ambiguous) ---
        it('should REJECT based on content keyword when metadata/location are UNKNOWN', () => { // Renamed slightly
            const job = createMockGreenhouseJob({
                metadata: [], // UNKNOWN
                location: { name: 'Remote' }, // Ambiguous but passes pattern check
                content: 'You must reside in the United States.', // REJECT from content keyword
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Content indicates Restriction'); 
        });

        it('should ACCEPT_LATAM based on content keyword when metadata/location are UNKNOWN', () => { // Renamed slightly
            const job = createMockGreenhouseJob({
                metadata: [], // UNKNOWN
                location: { name: 'Remote' }, // Ambiguous
                content: 'Hiring in Brazil and Argentina.', // ACCEPT_LATAM from content keyword
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('latam');
            expect(result.reason).toContain('Content(LATAM)'); 
        });

        it('should ACCEPT_GLOBAL based on content keyword when metadata/location are UNKNOWN', () => { // Renamed slightly
            const job = createMockGreenhouseJob({
                metadata: [], // UNKNOWN
                location: { name: 'Remote' }, // Ambiguous
                content: 'Work from anywhere! Join our distributed team.', // ACCEPT_GLOBAL from content keyword
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('global');
            expect(result.reason).toContain('Content(Global)'); 
        });

        // --- Proximity Check / Pattern Detection Tests --- 
        it('should REJECT location "Remote (US Only)" due to proximity check', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote (US Only)' },
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(false);
            // The rejection now happens in _checkLocationName based on proximity
            expect(result.reason).toContain('Location/Office indicates Restriction'); 
        });
        
        it('should REJECT location "Remote - Must be based in New York" due to restrictive pattern', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote - Must be based in New York' },
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(false);
            // Check for pattern reason specifically from the location check
            expect(result.reason).toEqual('Location/Office indicates Specific Restriction via pattern'); 
        });

        it('should ACCEPT location "Remote" if no negative context or pattern', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' }, 
                content: 'Standard job description, no location restrictions mentioned.'
            });
             // _checkLocationName should now return ACCEPT_GLOBAL for ambiguous term without nearby negatives
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('global');
            // This should now be accepted by the location check's ambiguous keyword logic
            expect(result.reason).toContain('Location/Office(Global)'); 
        });

        it('should REJECT content with "Work from anywhere" if restrictive pattern "US Only" is present', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' }, // Location is ambiguous but ok initially
                content: 'Great opportunity! Work from anywhere. This role is US Only.',
            });
            // _checkContentKeywords should find "work from anywhere" but then reject due to nearby "us only"
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(false);
             // Check for pattern reason specifically from the content check
            expect(result.reason).toEqual('Content indicates Specific Restriction via pattern');
        });
        
         it('should REJECT content with positive global term if timezone restriction keyword is present', () => { // Renamed slightly
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' },
                content: 'Be fully remote, but you must work PST timezone hours.', // Contains 'pst' keyword
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(false);
            // Should be rejected by keyword check in content
            expect(result.reason).toContain('Content indicates Timezone Restriction'); 
        });

        it('should ACCEPT content with "Work from anywhere" if no negative pattern or context', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' }, // Location is ambiguous but ok initially
                content: 'Join our global team. Work from anywhere! We value flexibility.',
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('global');
            // Accepted by location first (ambiguous 'Remote'), or confirmed by content keyword
            expect(result.reason).toMatch(/Location\/Office\(Global\)|Content\(Global\)/); 
        });
        
         it('should correctly prioritize LATAM over GLOBAL even with restrictive patterns nearby', () => {
             const job = createMockGreenhouseJob({
                location: { name: 'Remote (Americas)' }, // Potentially LATAM
                content: 'Work from anywhere in LATAM. Some travel to US required.' // LATAM signal, negative nearby
             });
             // LATAM signal in content should take priority
             const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig, mockLogger);
             expect(result.relevant).toBe(true);
             expect(result.type).toBe('latam');
             // LATAM signal in content should take priority, check reason contains it
             expect(result.reason).toContain('Content(LATAM)'); 
        });

    }); // End describe('_isJobRelevant')

    // TODO: Restore or rewrite tests for other private methods like _processJobContent, _extractSectionsFromContent if needed

}); // End describe('GreenhouseFetcher - Filter Logic')

// --- New tests for processSource ---

// Cast the mocked axios to the correct type
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('GreenhouseFetcher - processSource', () => {
    let fetcherInstance: GreenhouseFetcher;
    let mockPrisma: jest.Mocked<PrismaClient>;
    let mockJobProcessor: jest.Mocked<JobProcessingAdapter>;
    let mockParentLogger: ReturnType<typeof mockedPino>;
    let mockSourceLogger: ReturnType<typeof mockedPino>;
    let mockJobLoggers: ReturnType<typeof mockedPino>[];
    let mockSource: JobSource;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
        mockJobProcessor = new JobProcessingAdapter(mockPrisma) as jest.Mocked<JobProcessingAdapter>;

        // Setup parent logger and source logger
        mockParentLogger = mockedPino();
        mockSourceLogger = mockedPino();
        mockParentLogger.child.mockReturnValue(mockSourceLogger);
        mockJobLoggers = [];

        // Configure the source logger's child calls to produce job loggers
        mockSourceLogger.child.mockImplementation(() => {
            const jobLogger = mockedPino();
            mockJobLoggers.push(jobLogger);
            return jobLogger;
        });

        fetcherInstance = new GreenhouseFetcher(mockPrisma, mockJobProcessor);
        mockSource = createMockJobSource();
        
        // Mock fs.readFileSync to return our sample filter config
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(sampleFilterConfig));
    });

    it('should fetch and process jobs successfully', async () => {
        // Mock axios response with sample jobs
        const mockJobs = [
            createMockGreenhouseJob({ 
                id: 1001, 
                title: 'Remote Software Engineer',
                location: { name: 'Remote Worldwide' }
            }),
            createMockGreenhouseJob({ 
                id: 1002, 
                title: 'Product Manager',
                location: { name: 'Remote LATAM' }
            })
        ];
        
        (axios.get as jest.Mock).mockResolvedValue({ 
            data: { jobs: mockJobs },
            status: 200
        });
        
        // Mock job processor to return successful processing
        mockJobProcessor.processRawJob.mockResolvedValue(true);
        
        const result = await fetcherInstance.processSource(mockSource, mockParentLogger);
        
        // Verify the result contains correct stats
        expect(result.stats.found).toBe(2);
        expect(result.stats.relevant).toBeGreaterThan(0);
        expect(result.stats.processed).toBeGreaterThan(0);
        expect(result.stats.errors).toBe(0);
        
        // Verify foundSourceIds contains the job IDs
        expect(result.foundSourceIds.has('1001')).toBe(true);
        expect(result.foundSourceIds.has('1002')).toBe(true);
        
        // Verify axios was called correctly
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining(`https://boards-api.greenhouse.io/v1/boards/${mockSource.config.boardToken}/jobs`),
            expect.any(Object)
        );
        
        // Verify job processor was called for relevant jobs
        expect(mockJobProcessor.processRawJob).toHaveBeenCalled();
        
        // Verify logging behavior
        expect(mockParentLogger.child).toHaveBeenCalledWith(
            expect.objectContaining({ 
                fetcher: 'Greenhouse', 
                sourceName: mockSource.name,
                sourceId: mockSource.id 
            })
        );
        expect(mockSourceLogger.info).toHaveBeenCalledWith(
            expect.any(Object),
            expect.stringContaining('Starting processing')
        );
    });

    it('should handle invalid source configuration', async () => {
        // Create source with invalid config
        const invalidSource = createMockJobSource({ boardToken: null });
        
        const result = await fetcherInstance.processSource(invalidSource, mockParentLogger);
        
        // Verify the result contains error
        expect(result.stats.errors).toBe(1);
        expect(result.stats.found).toBe(0);
        expect(result.foundSourceIds.size).toBe(0);
        
        // Verify logging behavior
        expect(mockSourceLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Missing or invalid boardToken')
        );
    });

    it('should handle failure to load filter configuration', async () => {
        // Make fs.readFileSync throw an error
        mockedFs.readFileSync.mockImplementation(() => { 
            throw new Error('File not found');
        });
        
        const result = await fetcherInstance.processSource(mockSource, mockParentLogger);
        
        // Verify the result contains error
        expect(result.stats.errors).toBe(1);
        expect(result.stats.found).toBe(0);
        
        // Verify logging behavior
        expect(mockSourceLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.any(Error) }),
            expect.stringContaining('Failed to load or parse filter configuration')
        );
    });

    it('should handle API error when fetching jobs', async () => {
        // Mock axios to throw an error
        // Make sure the error looks like an AxiosError
        const axiosError = new Error('Network error') as AxiosError;
        axiosError.config = {}; // Axios errors typically have a config
        axiosError.request = {}; // and a request object
        axiosError.response = undefined; // No response for network errors typically
        axiosError.isAxiosError = true;
        axiosError.toJSON = () => ({}); // Add toJSON method if needed by logger
        axiosError.code = 'ECONNREFUSED';
        (axios.get as jest.Mock).mockRejectedValue(axiosError);
        
        const result = await fetcherInstance.processSource(mockSource, mockParentLogger);
        
        // Verify the result contains error
        expect(result.stats.errors).toBe(1);
        expect(result.stats.found).toBe(0);
        
        // Verify logging behavior for Axios error
        expect(mockSourceLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ 
                // status: undefined, // No response status for network error
                code: axiosError.code, 
                message: axiosError.message 
            }),
            expect.stringContaining('Axios error fetching jobs for source') // Expect the Axios specific message
        );
    });

    it('should handle invalid API response structure', async () => {
        // Mock axios to return invalid response structure
        (axios.get as jest.Mock).mockResolvedValue({ 
            data: { invalid: 'structure' }, // No 'jobs' array
            status: 200
        });
        
        const result = await fetcherInstance.processSource(mockSource, mockParentLogger);
        
        // Verify the result contains error
        expect(result.stats.errors).toBe(1);
        expect(result.stats.found).toBe(0);
        
        // Verify logging behavior
        expect(mockSourceLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ 
                responseStatus: 200,
                responseData: expect.objectContaining({ invalid: 'structure' }) 
            }),
            expect.stringContaining('Invalid response structure')
        );
    });

    it('should handle empty jobs array in API response', async () => {
        // Mock axios to return empty jobs array
        (axios.get as jest.Mock).mockResolvedValue({ 
            data: { jobs: [] },
            status: 200
        });
        
        const result = await fetcherInstance.processSource(mockSource, mockParentLogger);
        
        // Verify the result contains correct stats
        expect(result.stats.found).toBe(0);
        expect(result.stats.errors).toBe(0);
        
        // Verify logging behavior
        expect(mockSourceLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('No jobs found for this source')
        );
    });

    it('should handle error in job processing', async () => {
        // Mock axios response with sample job
        const mockJobs = [
            createMockGreenhouseJob({ 
                id: 1001, 
                title: 'Remote Software Engineer',
                location: { name: 'Remote Worldwide' }
            })
        ];
        
        (axios.get as jest.Mock).mockResolvedValue({ 
            data: { jobs: mockJobs },
            status: 200
        });
        
        // Mock job processor to throw an error
        mockJobProcessor.processRawJob.mockImplementation(() => {
            throw new Error('Processing error');
        });
        
        const result = await fetcherInstance.processSource(mockSource, mockParentLogger);
        
        // Verify the result contains stats reflecting the error
        expect(result.stats.found).toBe(1);
        expect(result.stats.errors).toBe(1);
        expect(result.stats.processed).toBe(0);
        
        // Verify job logger recorded the error
        expect(mockJobLoggers[0].error).toHaveBeenCalledWith(
            expect.objectContaining({ 
                error: expect.objectContaining({
                    message: 'Processing error'
                })
            }),
            expect.stringContaining('Error processing individual job')
        );
    });

    it('should track jobs not saved by processor', async () => {
        // Mock axios response with sample jobs
        const mockJobs = [
            createMockGreenhouseJob({ 
                id: 1001, 
                title: 'Remote Software Engineer',
                location: { name: 'Remote Worldwide' }
            })
        ];
        
        (axios.get as jest.Mock).mockResolvedValue({ 
            data: { jobs: mockJobs },
            status: 200
        });
        
        // Mock job processor to return false (not saved)
        mockJobProcessor.processRawJob.mockResolvedValue(false);
        
        const result = await fetcherInstance.processSource(mockSource, mockParentLogger);
        
        // Verify the result contains correct stats
        expect(result.stats.found).toBe(1);
        expect(result.stats.relevant).toBeGreaterThan(0);
        expect(result.stats.processed).toBe(0); // Should be 0 as job wasn't saved
        
        // Verify job logger recorded the warning
        expect(mockJobLoggers[0].warn).toHaveBeenCalledWith(
            expect.stringContaining('Adapter reported job not saved')
        );
    });
});

// Add new describe block specifically for _isJobRelevant logic
describe('GreenhouseFetcher._isJobRelevant', () => {
    let fetcherInstance: any; // Use 'any' to access private method for testing
    let mockLogger: pino.Logger;
    const testFilterConfig = JSON.parse(JSON.stringify(sampleFilterConfig)) as FilterConfig;

    beforeEach(() => {
        // Create a fresh instance for each test to avoid state pollution
        const mockPrisma = {} as PrismaClient; // Mock Prisma if needed for internal calls
        const mockJobProcessor = { processRawJob: jest.fn() } as unknown as JobProcessingAdapter;
        fetcherInstance = new GreenhouseFetcher(mockPrisma, mockJobProcessor);
        mockLogger = mockedPino(); // Use the mocked pino instance
    });

    // --- Test Cases for Rejection based on Patterns ---
    test('should REJECT job with location pattern "(US Only)"', () => {
        const job = createMockGreenhouseJob({ location: { name: 'Remote (US Only)' } });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction Pattern Detected');
    });

    test('should REJECT job with location pattern "based in Canada"', () => {
        const job = createMockGreenhouseJob({ location: { name: 'Remote, based in Canada' } });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction Pattern Detected');
    });

    test('should REJECT job with content pattern "eligible to work in Europe"', () => {
        const job = createMockGreenhouseJob({
            location: { name: 'Remote' },
            content: '<p>Must be eligible to work in Europe.</p>'
        });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction Pattern Detected');
    });

     test('should REJECT job with content pattern "UK resident"', () => {
        const job = createMockGreenhouseJob({
            location: { name: 'Remote' },
            content: 'Must be a UK resident.'
        });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction Pattern Detected');
    });

    // --- Test Cases for Rejection based on Keywords ---
    test('should REJECT job with location keyword "Hybrid"', () => {
        const job = createMockGreenhouseJob({ location: { name: 'Hybrid - London' } });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction');
    });

    test('should REJECT job with content keyword "US Citizen"', () => {
        const job = createMockGreenhouseJob({ 
            location: { name: 'Remote' },
            content: '<p>Requires US Citizen status.</p>'
        });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Restriction');
    });

    // --- Test Cases for Acceptance ---
    test('should ACCEPT job with location "Remote LATAM"', () => {
        const job = createMockGreenhouseJob({ location: { name: 'Remote LATAM' } });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Location/Office(LATAM)');
    });

    test('should ACCEPT job with location "Remote Worldwide"', () => {
        const job = createMockGreenhouseJob({ location: { name: 'Remote Worldwide' } });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Location/Office(Global)');
    });

    test('should ACCEPT job with content keyword "Latin America"', () => {
        const job = createMockGreenhouseJob({ 
            location: { name: 'Remote' },
            content: '<p>Hiring in Latin America.</p>'
        });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Content(LATAM)');
    });

    test('should ACCEPT job with content keyword "Globally Remote"', () => {
        const job = createMockGreenhouseJob({ 
            location: { name: 'Remote' },
            content: '<p>We are a globally remote team.</p>'
        });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Content(Global)');
    });

    test('should ACCEPT job with metadata indicating LATAM allowed', () => {
        const job = createMockGreenhouseJob({ 
            location: { name: 'Remote' },
            metadata: [
                { id: 1, name: 'Geo Scope', value: 'LATAM' }
            ]
        });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Metadata(LATAM)');
    });

     test('should ACCEPT job with metadata indicating remote eligible', () => {
        const job = createMockGreenhouseJob({ 
            location: { name: 'Office Name' }, // Location itself isn't explicitly remote
            metadata: [
                { id: 1, name: 'Remote Eligible', value: 'Yes' }
            ]
        });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global'); // Defaults to global if metadata is positive
        expect(result.reason).toContain('Metadata(Global)');
    });

    // --- Edge Cases ---
     test('should REJECT job with ambiguous remote keyword near negative context in content', () => {
        const job = createMockGreenhouseJob({ 
            location: { name: 'Remote' },
            content: '<p>This is a remote role, preference for candidates in the US.</p>'
        });
        // Note: The generic 'remote' might be handled by location check first in the real flow,
        // but this tests the content context check specifically if it gets there.
        // We might need a more specific test targeting _checkContentKeywords directly if needed.
        // Assuming _isJobRelevant calls _checkContentKeywords which calls hasNearbyNegative
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        // Depending on exact keyword priorities and check order, this might be rejected by pattern or keyword.
        // The key is that it *is* rejected.
        expect(result.relevant).toBe(false);
        expect(result.reason).toMatch(/Restriction/);
    });

     test('should ACCEPT job with ambiguous remote keyword without negative context', () => {
        const job = createMockGreenhouseJob({ location: { name: 'Remote' } });
        const result = fetcherInstance._isJobRelevant(job, testFilterConfig, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Location/Office(Global)'); // Assuming AMBIGUOUS check passes
    });

}); 
import { PrismaClient, JobSource } from '@prisma/client';
import pino from 'pino';
import { GreenhouseFetcher } from '../../../src/lib/fetchers/GreenhouseFetcher'; // Adjust path as needed
import { JobProcessingAdapter } from '../../../src/lib/adapters/JobProcessingAdapter';
import { FilterConfig } from '../../../src/types/JobSource';

// Mock dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('../../../src/lib/adapters/JobProcessingAdapter');
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({})), // Mock PrismaClient constructor
    JobStatus: { ACTIVE: 'ACTIVE', CLOSED: 'CLOSED' },
    JobType: { FULL_TIME: 'FULL_TIME', PART_TIME: 'PART_TIME', CONTRACT: 'CONTRACT', INTERNSHIP: 'INTERNSHIP' },
    ExperienceLevel: { JUNIOR: 'JUNIOR', MID_LEVEL: 'MID_LEVEL', SENIOR: 'SENIOR', STAFF: 'STAFF', PRINCIPAL: 'PRINCIPAL' }
}));
const mockedPino = jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn(() => mockedPino()), // Ensure child returns a mock logger
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
    }
};

// Helper function to create mock GreenhouseJob data
const createMockGreenhouseJob = (overrides: Partial<any> = {}): any => ({
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

    // --- Testing _isJobRelevant (the main filter function) ---
    describe('_isJobRelevant', () => {

        it('should ACCEPT_GLOBAL based on metadata positive value', () => {
            const job = createMockGreenhouseJob({
                metadata: [
                    { id: 1, name: 'Remote Status', value: 'Fully Remote' }
                ]
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('global');
            expect(result.reason).toContain('Metadata');
        });

        it('should ACCEPT_LATAM based on metadata allowed value', () => {
            const job = createMockGreenhouseJob({
                metadata: [
                    { id: 1, name: 'Geo Scope', value: 'LATAM' }
                ]
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('latam');
            expect(result.reason).toContain('Metadata');
        });

        it('should REJECT based on metadata disallowed value', () => {
            const job = createMockGreenhouseJob({
                metadata: [
                    { id: 1, name: 'Location Requirement', value: 'US Only' }
                ]
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Metadata');
        });

        it('should ACCEPT_GLOBAL based on location keyword', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote Worldwide' }
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('global');
            expect(result.reason).toContain('Location');
        });

        it('should ACCEPT_LATAM based on location keyword', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote Brazil' }
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('latam');
            expect(result.reason).toContain('Location');
        });

        it('should REJECT based on location keyword restriction', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote (US)' }
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Location');
        });
        
         it('should REJECT based on non-remote location name', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'New York Office' }
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Location indicates non-remote');
        });

        it('should ACCEPT_GLOBAL based on content keyword when metadata/location are ambiguous', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' }, // Ambiguous
                metadata: [],
                content: 'We are a fully distributed team, work from anywhere!'
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('global');
            expect(result.reason).toContain('Content keywords');
        });

        it('should ACCEPT_LATAM based on content keyword when metadata/location are ambiguous', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' }, // Ambiguous
                metadata: [],
                content: 'This position is open for candidates in Latin America.'
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(true);
            expect(result.type).toBe('latam');
            expect(result.reason).toContain('Content keywords');
        });

        it('should REJECT based on content keyword restriction', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' }, // Ambiguous
                metadata: [],
                content: 'Candidates must be eligible to work in the US.'
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Content keywords');
        });

        it('should REJECT based on content keyword timezone restriction', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' }, // Ambiguous
                metadata: [],
                content: 'Availability during PST timezone hours is required.'
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Content keywords');
        });

        it('should REJECT by default if metadata, location, and content are all ambiguous or irrelevant', () => {
            const job = createMockGreenhouseJob({
                location: { name: 'Remote' }, // Ambiguous
                metadata: [{ id: 1, name: 'Some Other Field', value: 'Whatever' }], // Irrelevant metadata
                content: 'A generic job description.' // No relevant keywords
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Could not determine relevance (defaulting to irrelevant)');
        });

        it('should prioritize REJECT from metadata over ACCEPT from location/content', () => {
            const job = createMockGreenhouseJob({
                metadata: [{ id: 1, name: 'Location Requirement', value: 'USA' }], // REJECT
                location: { name: 'Remote LATAM' }, // Would be ACCEPT_LATAM
                content: 'Come work with us in Brazil!' // Would be ACCEPT_LATAM
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Metadata indicates non-remote');
        });

        it('should prioritize REJECT from location over ACCEPT from content', () => {
            const job = createMockGreenhouseJob({
                metadata: [], // UNKNOWN
                location: { name: 'Remote - USA' }, // REJECT
                content: 'Work from anywhere in the world!' // Would be ACCEPT_GLOBAL
            });
            const result = fetcherInstance._isJobRelevant(job, sampleFilterConfig);
            expect(result.relevant).toBe(false);
            expect(result.reason).toContain('Location indicates non-remote');
        });

    });

    // TODO: Add tests for other private methods like _processJobContent, _extractSectionsFromContent if needed
    // TODO: Add tests for the main processSource method, mocking axios, fs, prisma calls

}); 
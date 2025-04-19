import { LeverFetcher } from '../../../src/lib/fetchers/LeverFetcher';
import { JobProcessingAdapter } from '../../../src/lib/adapters/JobProcessingAdapter';
import { prisma } from '../../../src/lib/prisma';
import { JobSource } from '@prisma/client';
import pino from 'pino';
import { LeverApiPosting } from '../../../src/lib/fetchers/types'; // Corrected path
import { detectRestrictivePattern } from '../../../src/lib/utils/filterUtils'; // Corrected path
import path from 'path';
import fs from 'fs';
import { FilterConfig } from '../../../src/types/JobSource'; // Corrected path
import { containsInclusiveSignal } from '../../../src/lib/utils/filterUtils'; // Corrected path
import { stripHtml } from '../../../src/lib/utils/textUtils'; // Corrected path
import { PrismaClient } from '@prisma/client';
import { JobAssessmentStatus } from '../../../src/types/StandardizedJob'; // Import the enum

// Mocks

// Mock fs module at the top level
jest.mock('fs', () => ({
    readFileSync: jest.fn()
}));

// Use jest.doMock for potentially deeper dependencies
jest.doMock('@/lib/prisma', () => ({
  prisma: {
    // Mock specific Prisma methods used by the service if needed
    // Example: user: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    //         job: { findFirst: jest.fn(), update: jest.fn(), upsert: jest.fn() }
    // For now, provide a basic mock structure. Adjust if tests fail on specific methods.
    user: jest.fn(), 
    job: jest.fn(), 
  }
}));

// Mock adapter BEFORE importing the fetcher
jest.mock('@/lib/adapters/JobProcessingAdapter');

// Mock pino completely AFTER other mocks
jest.mock('pino', () => {
    // Simpler mock: just return the mock logger instance
    const mockChild = jest.fn().mockReturnThis();
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        child: mockChild,
    };
    mockChild.mockReturnValue(mockLogger);
    return jest.fn(() => mockLogger); // Return the factory function directly
});

// Helper to get the logger instance (DEFINED HERE)
const getMockLoggerInstance = () => {
    const pinoMockFactory = jest.requireMock('pino') as jest.Mock;
    return pinoMockFactory();
};

// Mock getLeverConfig AFTER prisma/adapter mocks
jest.mock('@/types/JobSource', () => ({
    getLeverConfig: jest.fn((config) => config ? ({ companyIdentifier: config.companyIdentifier }) : null),
}));

// Mock filterUtils
jest.mock('../../../src/lib/utils/filterUtils'); // Corrected relative path
// Mock textUtils where stripHtml resides
jest.mock('../../../src/lib/utils/textUtils', () => ({ // Corrected relative path
    stripHtml: jest.fn((html) => {
        if (!html) return '';
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }),
    // Add other mocked functions from textUtils if necessary
}));

// --- Import dependencies AFTER mocks --- 

// Mock global fetch
global.fetch = jest.fn();

describe('LeverFetcher', () => {
    let leverFetcher: LeverFetcher;
    let mockPrisma: any;
    let mockAdapter: jest.Mocked<JobProcessingAdapter>;
    let mockLogger: jest.Mocked<pino.Logger>;
    let mockChildLogger: jest.Mocked<pino.Logger>; // For verifying child logger calls
    let mockSource: JobSource;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma = prisma;
        mockAdapter = new JobProcessingAdapter() as jest.Mocked<JobProcessingAdapter>;
        mockAdapter.processRawJob = jest.fn().mockResolvedValue(true);
        // Ensure fs mock is reset for this suite too
        (fs.readFileSync as jest.Mock).mockReset(); 
        // Configure default fs mock for this suite (if needed, otherwise rely on test-specific mocks)
        const expectedConfigEnding = path.normalize('src/config/lever-filter-config.json');
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            const normalizedFilePath = path.normalize(filePath);
            if (normalizedFilePath.endsWith(expectedConfigEnding)) {
                // Return a minimal valid config or the test one
                return JSON.stringify(testFilterConfig); 
            }
            throw new Error(`fs.readFileSync mock called with unexpected path in outer suite: ${filePath}`);
        });

        // Reset and set default mocks for filter utils for this suite
        (detectRestrictivePattern as jest.Mock).mockReset();
        (containsInclusiveSignal as jest.Mock).mockReset();
        (stripHtml as jest.Mock).mockReset(); // Reset stripHtml too
        (detectRestrictivePattern as jest.Mock).mockReturnValue({ isRestrictive: false });
        (containsInclusiveSignal as jest.Mock).mockReturnValue({ isInclusive: false });
        (stripHtml as jest.Mock).mockImplementation((html) => {
            if (!html) return '';
            return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        });

        leverFetcher = new LeverFetcher(mockPrisma, mockAdapter);
        mockLogger = pino() as jest.Mocked<pino.Logger>;
        mockChildLogger = mockLogger.child() as jest.Mocked<pino.Logger>;

        mockSource = createMockLeverJobSource(); // Use helper

        // Default mock for fetch (successful, empty array)
        (fetch as jest.Mock).mockReset();
        (fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => [],
            text: async () => ''
        });
    });

    it('should instantiate correctly', () => {
        expect(leverFetcher).toBeInstanceOf(LeverFetcher);
    });

    it('processSource should fetch jobs and process relevant ones', async () => {
        const mockJobRelevant: LeverApiPosting = createMockLeverJob({ 
            id: 'job1', 
            workplaceType: 'remote' 
        });
        const mockJobIrrelevant: LeverApiPosting = createMockLeverJob({ 
            id: 'job2', 
            workplaceType: 'on-site', 
            categories: { location: 'On-site Berlin', commitment: 'Full-time' } 
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => [mockJobRelevant, mockJobIrrelevant],
            text: async () => ''
        });

        // Ensure filter mocks are non-restrictive for this test run, 
        // even though the on-site check should trigger first for job2.
        (detectRestrictivePattern as jest.Mock).mockReturnValue({ isRestrictive: false });
        (containsInclusiveSignal as jest.Mock).mockReturnValue({ isInclusive: false });

        const result = await leverFetcher.processSource(mockSource, mockLogger);

        expect(mockLogger.child).toHaveBeenCalledWith({ fetcher: 'Lever', sourceName: 'Test Lever Source', sourceId: 'lever-test-src-1' });
        expect(mockChildLogger.info).toHaveBeenCalledWith({ apiUrl: 'https://api.lever.co/v0/postings/test-company' }, 'Fetching jobs from Lever API...');
        expect(mockChildLogger.info).toHaveBeenCalledWith('+ 2 jobs found in API response.');

        // Check that *some* trace log indicating relevance for job1 occurred
        const job1RelevantLog = mockChildLogger.trace.mock.calls.some(call => 
            call[1]?.includes('➡️ Relevant job found')
        );
        expect(job1RelevantLog).toBe(true);

        // Check that *some* trace log indicating irrelevance for job2 occurred
        // Lenient check: Find any log with the core message for job2
        const job2SkippedLog = mockChildLogger.trace.mock.calls.some(call => 
            call[1]?.includes('Job skipped as irrelevant')
        );
        expect(job2SkippedLog).toBe(true);
        
        expect(mockAdapter.processRawJob).toHaveBeenCalledTimes(1);
        expect(mockAdapter.processRawJob).toHaveBeenCalledWith('lever', expect.objectContaining({ id: 'job1', _determinedHiringRegionType: 'global' }), mockSource);
        expect(result.stats.found).toBe(2);
        expect(result.stats.relevant).toBe(1);
        expect(result.stats.processed).toBe(1); // Assumes adapter.processRawJob succeeds
        expect(result.stats.errors).toBe(0);
        expect(result.foundSourceIds).toEqual(new Set(['job1', 'job2']));
    });

    it('processSource should handle empty API response', async () => {
        // fetch already mocked to return []
        const result = await leverFetcher.processSource(mockSource, mockLogger);

        expect(mockChildLogger.info).toHaveBeenCalledWith('+ 0 jobs found in API response.');
        expect(mockChildLogger.info).toHaveBeenCalledWith('No jobs found for this source.');
        expect(mockAdapter.processRawJob).not.toHaveBeenCalled();
        expect(result.stats.found).toBe(0);
        expect(result.stats.relevant).toBe(0);
        expect(result.stats.processed).toBe(0);
        expect(result.foundSourceIds.size).toBe(0);
    });

    it('processSource should handle fetch API errors', async () => {
        const errorMsg = 'Lever API request failed with status 500: Internal Server Error';
        (fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({}),
            text: async () => 'Internal Server Error'
        });

        const result = await leverFetcher.processSource(mockSource, mockLogger);

        expect(mockChildLogger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, `Error processing Lever source: ${errorMsg}`);
        expect(mockAdapter.processRawJob).not.toHaveBeenCalled();
        expect(result.stats.errors).toBe(1);
        expect(result.errorMessage).toBe(errorMsg);
        expect(result.foundSourceIds.size).toBe(0);
    });

    it('processSource should handle invalid config', async () => {
        mockSource.config = null; // Invalid config
        const errorMsg = 'Missing or invalid companyIdentifier in JobSource config';

        const result = await leverFetcher.processSource(mockSource, mockLogger);

        expect(mockChildLogger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, `Error processing Lever source: ${errorMsg}`);
        expect(fetch as jest.Mock).not.toHaveBeenCalled();
        expect(mockAdapter.processRawJob).not.toHaveBeenCalled();
        expect(result.stats.errors).toBe(1);
        expect(result.errorMessage).toBe(errorMsg);
    });

    it('processSource should handle errors during job processing', async () => {
        const mockJob: LeverApiPosting = {
            id: 'job1',
            text: 'Remote Engineer',
            workplaceType: 'remote',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            hostedUrl: 'url1',
            applyUrl: 'apply1',
            content: { description: 'Remote job', descriptionHtml: '<p>Remote job</p>', lists: [] },
            categories: { location: 'Remote', commitment: 'Full-time' }, // Add categories
        };
        (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => [mockJob],
            text: async () => ''
        });
        const processingError = new Error('Failed to process');
        mockAdapter.processRawJob.mockRejectedValueOnce(processingError);

        // Mock filter utils for this specific test
        (detectRestrictivePattern as jest.Mock).mockReturnValue({ isRestrictive: false });
        (containsInclusiveSignal as jest.Mock).mockReturnValue({ isInclusive: false });

        const result = await leverFetcher.processSource(mockSource, mockLogger);

        // Expect the adapter to have been called, even though it failed
        expect(mockAdapter.processRawJob).toHaveBeenCalledTimes(1);
        expect(mockAdapter.processRawJob).toHaveBeenCalledWith('lever', expect.objectContaining({ id: 'job1' }), mockSource);

        // Check that the error from the adapter call was logged
        expect(mockChildLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ 
                error: expect.objectContaining({ message: 'Failed to process' })
            }), 
            expect.stringContaining('❌ Error processing individual job or calling adapter')
        );
        
        expect(result.stats.found).toBe(1);
        expect(result.stats.relevant).toBe(1); // Job was relevant before processing failed
        expect(result.stats.processed).toBe(0); // Processing failed
        expect(result.stats.errors).toBe(1); // Error during processing counts
        // The errorMessage in the result should capture the first processing error
        expect(result.errorMessage).toBe('Job job1 (Remote Engineer): Failed to process'); 
    });

    describe('_isJobRelevant', () => {
        let jobLogger: jest.Mocked<pino.Logger>;

        beforeEach(() => {
            // Reset filter util mocks for each relevance test
            (detectRestrictivePattern as jest.Mock).mockReset().mockReturnValue({ isRestrictive: false });
            (containsInclusiveSignal as jest.Mock).mockReset().mockReturnValue({ isInclusive: false });
            
            // Create a fresh mock logger for each test
            jobLogger = getMockLoggerInstance();
        });

        it('should return IRRELEVANT if workplaceType is on-site', () => {
            const job = createMockLeverJob({ workplaceType: 'on-site' });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.IRRELEVANT);
        });

        it('should return RELEVANT if workplaceType is remote and no negative signals', () => {
            const job = createMockLeverJob({ workplaceType: 'remote' });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.RELEVANT);
        });

        it('should return IRRELEVANT if location indicates restriction', () => {
            (detectRestrictivePattern as jest.Mock).mockImplementation((text: string, keywords: string[]) => {
                 // Simulate restriction found in location check context
                 if (text.includes('berlin')) return { isRestrictive: true, matchedKeyword: 'berlin' };
                 return { isRestrictive: false };
            });
            const job = createMockLeverJob({ workplaceType: 'remote', categories: { location: 'Remote Berlin' } });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.IRRELEVANT);
        });

        it('should return IRRELEVANT if content indicates restriction', () => {
            (detectRestrictivePattern as jest.Mock).mockImplementation((text: string, keywords: string[]) => {
                // Simulate restriction found ONLY in content check context
                if (text.includes('usa only')) return { isRestrictive: true, matchedKeyword: 'usa only' };
                return { isRestrictive: false };
            });
            const job = createMockLeverJob({ workplaceType: 'remote', descriptionPlain: 'Must be usa only applicant' });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.IRRELEVANT);
        });

        it('should return RELEVANT if LATAM signal found in location', () => {
            (containsInclusiveSignal as jest.Mock).mockImplementation((text: string, keywords: string[]) => {
                // Simulate LATAM signal found ONLY in location check context
                if (text.includes('latam') && keywords.includes('latam')) return { isInclusive: true, matchedKeyword: 'latam' };
                return { isInclusive: false };
            });
            const job = createMockLeverJob({ workplaceType: 'remote', categories: { location: 'Remote LATAM'} });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.RELEVANT);
        });
        
        it('should return RELEVANT if Global signal found in content', () => {
             (containsInclusiveSignal as jest.Mock).mockImplementation((text: string, keywords: string[]) => {
                // Simulate Global signal found ONLY in content check context
                if (text.includes('worldwide') && keywords.includes('worldwide')) return { isInclusive: true, matchedKeyword: 'worldwide' };
                return { isInclusive: false };
            });
            const job = createMockLeverJob({ workplaceType: 'remote', descriptionPlain: 'Open worldwide' });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.RELEVANT);
        });

        // --- NEEDS_REVIEW Tests --- 
        it('should return NEEDS_REVIEW if workplaceType is hybrid and no strong signals', () => {
            const job = createMockLeverJob({ workplaceType: 'hybrid', categories: { location: 'Hybrid Anywhere' }, descriptionPlain: 'Standard role' });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.NEEDS_REVIEW);
        });

        it('should return NEEDS_REVIEW if workplaceType is null and no strong signals', () => {
            const job = createMockLeverJob({ workplaceType: null as any, categories: { location: 'Some Office' }, descriptionPlain: 'Generic job description' });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.NEEDS_REVIEW);
        });
        
         it('should return NEEDS_REVIEW if workplaceType is unknown and no strong signals', () => {
            const job = createMockLeverJob({ workplaceType: 'unknown' as any, categories: { location: 'Somewhere' }, descriptionPlain: 'Apply now' });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.NEEDS_REVIEW);
        });

        it('should return RELEVANT if workplaceType is hybrid BUT has strong LATAM signal', () => {
             (containsInclusiveSignal as jest.Mock).mockImplementation((text: string, keywords: string[]) => {
                if (keywords.includes('latam') && text.includes('latam')) return { isInclusive: true, matchedKeyword: 'latam' };
                return { isInclusive: false };
            });
            const job = createMockLeverJob({ workplaceType: 'hybrid', categories: { location: 'Hybrid LATAM' } });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.RELEVANT);
        });
        
         it('should return RELEVANT if workplaceType is undefined BUT has strong GLOBAL signal in content', () => {
             (containsInclusiveSignal as jest.Mock).mockImplementation((text: string, keywords: string[]) => {
                if (text.includes('global role') && keywords.includes('global')) return { isInclusive: true, matchedKeyword: 'global' };
                return { isInclusive: false };
            });
            const job = createMockLeverJob({ workplaceType: undefined, descriptionPlain: 'This is a global role.' });
            const result = (leverFetcher as any)._isJobRelevant(job, jobLogger);
            expect(result).toBe(JobAssessmentStatus.RELEVANT);
        });

    }); // End describe _isJobRelevant

    // --- Helper Functions --- 

    const testFilterConfig: FilterConfig = {
    // Basic config for testing, adjust as needed
        PROCESS_JOBS_UPDATED_AFTER_DATE: undefined,
        LOCATION_KEYWORDS: {
            STRONG_NEGATIVE_RESTRICTION: ['berlin', 'us only', 'on-site'],
            STRONG_POSITIVE_LATAM: ['latam', 'latin america', 'brasil'],
            STRONG_POSITIVE_GLOBAL: ['global', 'worldwide', 'anywhere'],
            ACCEPT_EXACT_BRAZIL_TERMS: ['brasil'],
            ACCEPT_EXACT_LATAM_COUNTRIES: [],
            AMBIGUOUS: ['remote'],
        },
        CONTENT_KEYWORDS: {
            STRONG_NEGATIVE_REGION: ['us citizen', 'usa only'],
            STRONG_NEGATIVE_TIMEZONE: ['pacific time', 'pst'],
            STRONG_POSITIVE_LATAM: ['latam', 'pj'],
            STRONG_POSITIVE_GLOBAL: ['global', 'international'],
            ACCEPT_EXACT_BRAZIL_TERMS: ['clt', 'brasil'],
        },
        REMOTE_METADATA_FIELDS: {},
        EXPLICIT_REJECTION_KEYWORDS: []
    };

    const createMockLeverJobSource = (configOverrides = {}): JobSource => ({
        id: 'lever-test-src-1',
        name: 'Test Lever Source',
        type: 'lever',
        companyWebsite: 'https://lever.co',
        isEnabled: true,
        logoUrl: 'https://lever.co/logo.png',
        config: { companyIdentifier: 'test-company', ...configOverrides } as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastFetched: null,
        runStats: [], // Add missing property
        jobs: [],     // Add missing property
    });

    const createMockLeverJob = (overrides: Partial<LeverApiPosting>): LeverApiPosting => ({
        id: 'default-id-' + Math.random(),
        text: 'Default Test Job',
        hostedUrl: 'https://jobs.lever.co/test-company/default-id',
        applyUrl: 'https://jobs.lever.co/test-company/default-id/apply',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        categories: {
            commitment: 'Full-time',
            location: 'Remote',
            team: 'Engineering'
        },
        description: '<p>Default description</p>',
        descriptionPlain: 'Default description',
        lists: [],
        tags: [],
        workplaceType: 'remote',
        salaryRange: undefined, // Ensure salaryRange exists, can be overridden
        ...overrides,
    });

}); // End describe LeverFetcher
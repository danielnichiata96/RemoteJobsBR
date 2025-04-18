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
});

// Helper to create a minimal JobSource object for tests
const createMockLeverJobSource = (configOverrides = {}): JobSource => ({
    id: 'lever-test-src-1',
    name: 'Test Lever Source',
    type: 'lever',
    config: { companyIdentifier: 'test-company', ...configOverrides },
    isEnabled: true,
    lastFetched: null,
    companyWebsite: null,
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
});

// Helper function to create mock LeverApiPosting data
const createMockLeverJob = (overrides: Partial<LeverApiPosting>): LeverApiPosting => ({
    id: `job_${Math.random().toString(36).substring(2, 15)}`,
    text: 'Software Engineer', // Job Title
    workplaceType: 'remote', // Default to remote
    categories: { // Often contains location/commitment
        location: 'Remote', // Default ambiguous location
        commitment: 'Full-time',
        // Add other relevant categories if needed
    },
    description: 'Default description.', // Plain text description
    descriptionHtml: '<p>Default description.</p>',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hostedUrl: 'https://jobs.lever.co/test-company/jobid',
    applyUrl: 'https://jobs.lever.co/test-company/jobid/apply',
    // Add other fields as needed based on Lever API structure
    ...overrides,
    // Ensure nested structures are handled
    categories: { 
        location: overrides.categories?.location || 'Remote',
        commitment: overrides.categories?.commitment || 'Full-time',
        ...(overrides.categories || {}), // Spread other potential categories
    },
    content: { 
        description: overrides.content?.description || overrides.description || 'Default content description.',
        descriptionHtml: overrides.content?.descriptionHtml || overrides.descriptionHtml || '<p>Default content description.</p>',
        lists: overrides.content?.lists || [],
        // Add other content fields if necessary
        ...(overrides.content || {}),
    }
});

// Sample Filter Config (using the same as Ashby for consistency)
const testFilterConfig: FilterConfig = {
    LOCATION_KEYWORDS: {
        STRONG_POSITIVE_GLOBAL: ["worldwide", "global"],
        STRONG_POSITIVE_LATAM: ["latam", "brazil", "remote brazil"],
        ACCEPT_EXACT_BRAZIL_TERMS: ["brazil"],
        ACCEPT_EXACT_LATAM_COUNTRIES: ["argentina"], // Added for testing
        STRONG_NEGATIVE_RESTRICTION: ["us only", "berlin", "clt", "london"],
        AMBIGUOUS: ["remote"],
    },
    CONTENT_KEYWORDS: {
        STRONG_POSITIVE_GLOBAL: ["work from anywhere"],
        STRONG_POSITIVE_LATAM: ["latin america"],
        ACCEPT_EXACT_BRAZIL_TERMS: ["brazil"],
        STRONG_NEGATIVE_REGION: ["usa", "must reside in the uk", "clt", "california"],
        STRONG_NEGATIVE_TIMEZONE: []
    },
    PROCESS_JOBS_UPDATED_AFTER_DATE: "2024-01-01T00:00:00Z"
};

// --- NEW Test Suite for _isJobRelevant ---
describe('LeverFetcher - _isJobRelevant', () => {
    let fetcherInstance: any; // Use 'any' to access private methods
    let mockLogger: ReturnType<typeof getMockLoggerInstance>;
    let mockJob: LeverApiPosting;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockLogger = getMockLoggerInstance(); // Use helper to get mock logger

        // Reset and configure the top-level fs.readFileSync mock
        (fs.readFileSync as jest.Mock).mockReset();
        const expectedConfigEnding = path.normalize('src/config/lever-filter-config.json');
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            const normalizedFilePath = path.normalize(filePath);
            if (normalizedFilePath.endsWith(expectedConfigEnding)) {
                return JSON.stringify(testFilterConfig); // Return our specific test config
            }
            // Log unexpected paths for debugging during tests
            console.warn(`Mock fs.readFileSync called with unexpected path: ${filePath} (normalized: ${normalizedFilePath})`);
            throw new Error(`fs.readFileSync mock called with unexpected path: ${filePath}`);
        });

        // Mock filter utils dependencies for this suite
        (detectRestrictivePattern as jest.Mock).mockReset();
        (containsInclusiveSignal as jest.Mock).mockReset();
        (stripHtml as jest.Mock).mockReset();

        // Set default implementations for filter utils mocks within this suite
        (detectRestrictivePattern as jest.Mock).mockImplementation((text, keywords) => {
            const lowerText = text.toLowerCase();
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    return { isRestrictive: true, matchedKeyword: keyword };
                }
            }
            return { isRestrictive: false };
        });
        (containsInclusiveSignal as jest.Mock).mockImplementation((text, keywords) => {
            const lowerText = text.toLowerCase();
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    return { isInclusive: true, matchedKeyword: keyword };
                }
            }
            return { isInclusive: false };
        });
        (stripHtml as jest.Mock).mockImplementation((html) => {
            if (!html) return '';
            return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        });

        // Instantiate fetcher
        const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
        const mockAdapter = new JobProcessingAdapter() as jest.Mocked<JobProcessingAdapter>;
        fetcherInstance = new LeverFetcher(mockPrisma, mockAdapter);

        // Reset mock job data
        mockJob = createMockLeverJob({
            createdAt: new Date('2024-02-01T00:00:00Z').toISOString() // After threshold
        });
    });

    it('should return relevant: false for explicitly on-site job', () => {
        mockJob.workplaceType = 'on-site';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toBe('Explicitly on-site');
    });

    it('should return relevant: false if job created before threshold date', () => {
        mockJob.createdAt = new Date('2023-12-31T00:00:00Z').toISOString();
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Job created before');
    });

    it('should return relevant: false if location category indicates restriction', () => {
        mockJob.categories = { ...mockJob.categories, location: 'Office in Berlin' };
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location/Commitment indicates Restriction');
        expect(result.reason).toContain('berlin');
    });

    it('should return relevant: false if content indicates restriction (CLT)', () => {
        mockJob.description = 'This role follows CLT regulations.';
        mockJob.descriptionHtml = '<p>This role follows CLT regulations.</p>';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Content indicates Specific Restriction');
        expect(result.reason).toContain('clt');
    });

    it('should return relevant: false for hybrid job with no positive signals', () => {
        mockJob.workplaceType = 'hybrid';
        mockJob.categories = { ...mockJob.categories, location: 'Flexible Office' };
        mockJob.description = 'Standard hybrid role.';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toBe('Hybrid with no positive signals');
    });

    it('should return relevant: true (latam) if location category indicates LATAM', () => {
        mockJob.categories = { ...mockJob.categories, location: 'Remote - Brazil' };
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Location/Commitment indicates LATAM');
        expect(result.reason).toContain('brazil');
    });

    it('should return relevant: true (latam) if specific LATAM country is in location', () => {
        mockJob.categories = { ...mockJob.categories, location: 'Remote - Argentina' };
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('specific LATAM country');
        expect(result.reason).toContain('argentina');
    });

    it('should return relevant: true (latam) if content indicates LATAM', () => {
        mockJob.description = 'Team based in Latin America.';
        mockJob.workplaceType = 'hybrid'; // Test content overrides hybrid
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('latam');
        expect(result.reason).toContain('Content indicates LATAM');
        expect(result.reason).toContain('latin america');
    });

    it('should return relevant: true (global) if location category indicates GLOBAL', () => {
        mockJob.categories = { ...mockJob.categories, location: 'Remote Worldwide' };
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Location/Commitment indicates Global');
        expect(result.reason).toContain('worldwide');
    });

    it('should return relevant: true (global) if content indicates GLOBAL', () => {
        mockJob.description = 'You can work from anywhere.';
        mockJob.workplaceType = 'hybrid';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Content indicates Global');
        expect(result.reason).toContain('work from anywhere');
    });

    it('should return relevant: false if REJECT signal exists in location (overrides LATAM content)', () => {
        mockJob.categories = { ...mockJob.categories, location: 'Office in London' };
        mockJob.description = 'Hiring in Latin America.';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Location/Commitment indicates Restriction');
        expect(result.reason).toContain('london'); // REJECT should take precedence
    });

    it('should return relevant: false if REJECT signal exists in content (overrides LATAM location)', () => {
        mockJob.categories = { ...mockJob.categories, location: 'Remote - Brazil' };
        mockJob.description = 'Must reside in California.';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toContain('Content indicates Specific Restriction');
        expect(result.reason).toContain('california');
    });

    it('should return relevant: true (global) if workplaceType is remote and no other signals', () => {
        mockJob.workplaceType = 'remote';
        mockJob.categories = { ...mockJob.categories, location: 'Flexible Location' };
        mockJob.description = 'Standard job description.';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(true);
        expect(result.type).toBe('global');
        expect(result.reason).toContain('Marked as remote');
    });

    it('should return relevant: false if no signals and workplaceType is not remote or on-site', () => {
        mockJob.workplaceType = undefined; // Or null, or some other value
        mockJob.categories = { ...mockJob.categories, location: 'Somewhere' };
        mockJob.description = 'Standard job description.';
        const result = fetcherInstance._isJobRelevant(mockJob, mockLogger);
        expect(result.relevant).toBe(false);
        expect(result.reason).toBe('No definitive signals or remote type');
    });
}); 
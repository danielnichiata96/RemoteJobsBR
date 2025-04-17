import { LeverFetcher } from '@/lib/fetchers/LeverFetcher';
import { JobProcessingAdapter } from '@/lib/adapters/JobProcessingAdapter';
import { prisma } from '@/lib/prisma';
import { JobSource } from '@prisma/client';
import pino from 'pino';
import { LeverApiPosting } from '../../src/lib/fetchers/types'; // Import Lever type
import { detectRestrictivePattern } from '@/lib/utils/filterUtils'; // Use import again

// Mocks
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
    const actualPino = jest.requireActual('pino');
    const mockChild = jest.fn().mockReturnThis(); // Ensure child returns the mock
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        child: mockChild,
    };
    mockChild.mockReturnValue(mockLogger); // Ensure child returns the mock itself
    const pinoMock = jest.fn(() => mockLogger);
    (pinoMock as any).transport = actualPino.transport; // Preserve transport if needed elsewhere
    (pinoMock as any).multistream = actualPino.multistream; // Preserve multistream if needed elsewhere
    return pinoMock;
});

// Mock getLeverConfig AFTER prisma/adapter mocks
jest.mock('@/types/JobSource', () => ({
    getLeverConfig: jest.fn((config) => config ? ({ companyIdentifier: config.companyIdentifier }) : null),
}));

// Mock filterUtils
jest.mock('@/lib/utils/filterUtils'); // Add the mock declaration

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
        mockPrisma = prisma; // Assign the imported (and now hopefully properly mocked) prisma
        mockAdapter = new JobProcessingAdapter() as jest.Mocked<JobProcessingAdapter>;
        // Explicitly mock the CORRECT method ('processRawJob') on the adapter instance
        mockAdapter.processRawJob = jest.fn().mockResolvedValue(true); 
        leverFetcher = new LeverFetcher(mockPrisma, mockAdapter); // Pass the mocked prisma
        mockLogger = pino() as jest.Mocked<pino.Logger>; 
        mockChildLogger = mockLogger.child() as jest.Mocked<pino.Logger>; // Get the mocked child

        mockSource = {
            id: 'lever-test-1',
            name: 'Test Lever Source',
            type: 'lever',
            config: { companyIdentifier: 'test-company' },
            isEnabled: true,
            lastFetched: null,
            companyWebsite: null,
            logoUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Default mock for fetch (successful, empty array)
        (fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => [],
            text: async () => ''
        });
        // Default mock for filter (no restrictions) - Cast here
        (detectRestrictivePattern as jest.Mock).mockReturnValue(false);
    });

    it('should instantiate correctly', () => {
        expect(leverFetcher).toBeInstanceOf(LeverFetcher);
    });

    it('processSource should fetch jobs and process relevant ones', async () => {
        const mockJobRelevant: LeverApiPosting = {
            id: 'job1',
            text: 'Remote Engineer',
            workplaceType: 'remote',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            hostedUrl: 'url1',
            applyUrl: 'apply1',
            content: { description: 'Remote job', descriptionHtml: '<p>Remote job</p>', lists: [] }
        };
        const mockJobIrrelevant: LeverApiPosting = {
            id: 'job2',
            text: 'On-site Manager',
            workplaceType: 'on-site',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            hostedUrl: 'url2',
            applyUrl: 'apply2',
            content: { description: 'On-site job', descriptionHtml: '<p>On-site job</p>', lists: [] }
        };
        (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => [mockJobRelevant, mockJobIrrelevant],
            text: async () => ''
        });

        const result = await leverFetcher.processSource(mockSource, mockLogger);

        expect(mockLogger.child).toHaveBeenCalledWith({ fetcher: 'Lever', sourceName: 'Test Lever Source', sourceId: 'lever-test-1' });
        expect(mockChildLogger.info).toHaveBeenCalledWith({ apiUrl: 'https://api.lever.co/v0/postings/test-company' }, 'Fetching jobs from Lever API...');
        expect(mockChildLogger.info).toHaveBeenCalledWith('+ 2 jobs found in API response.');
        expect(mockChildLogger.trace).toHaveBeenCalledWith({ jobId: 'job1', reason: 'Explicitly remote' }, 'Job marked as relevant');
        expect(mockChildLogger.trace).toHaveBeenCalledWith({ jobId: 'job2', reason: 'Explicitly on-site/hybrid' }, 'Job marked as irrelevant');
        expect(mockAdapter.processRawJob).toHaveBeenCalledTimes(1);
        expect(mockAdapter.processRawJob).toHaveBeenCalledWith('lever', mockJobRelevant, mockSource);
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
            content: { description: 'Remote job', descriptionHtml: '<p>Remote job</p>', lists: [] }
        };
        (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => [mockJob],
            text: async () => ''
        });
        const processingError = new Error('Failed to process');
        mockAdapter.processRawJob.mockRejectedValueOnce(processingError);

        const result = await leverFetcher.processSource(mockSource, mockLogger);

        expect(mockAdapter.processRawJob).toHaveBeenCalledTimes(1);
        expect(mockChildLogger.error).toHaveBeenCalledWith({ error: processingError, jobId: 'job1' }, 'Error processing relevant job');
        expect(result.stats.found).toBe(1);
        expect(result.stats.relevant).toBe(1);
        expect(result.stats.processed).toBe(0); // Processing failed
        expect(result.stats.errors).toBe(1); // Error during processing counts
        expect(result.errorMessage).toBeUndefined(); // Overall fetch didn't fail
    });

    // --- Tests for _isJobRelevant logic ---
    const testRelevance = async (jobData: Partial<LeverApiPosting>, expectedRelevant: boolean, expectedReason: string, restricted: boolean = false) => {
        const job: LeverApiPosting = {
            id: 'test-rel-job',
            text: 'Test Title',
            hostedUrl: 'url', applyUrl: 'apply', createdAt: Date.now(), updatedAt: Date.now(),
            content: { description: 'Test Description', descriptionHtml: '<p>Desc</p>', lists: [] },
            ...jobData
        };
         (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => [job],
            text: async () => ''
        });
        // Set mock value for this specific test run - Cast here
        (detectRestrictivePattern as jest.Mock).mockReturnValue(restricted);

        await leverFetcher.processSource(mockSource, mockLogger);

        if (expectedRelevant) {
            expect(mockChildLogger.trace).toHaveBeenCalledWith(expect.objectContaining({ jobId: job.id, reason: expectedReason }), 'Job marked as relevant');
            expect(mockAdapter.processRawJob).toHaveBeenCalled();
        } else {
             expect(mockChildLogger.trace).toHaveBeenCalledWith(expect.objectContaining({ jobId: job.id, reason: expectedReason }), 'Job marked as irrelevant');
             expect(mockAdapter.processRawJob).not.toHaveBeenCalled();
        }
    };

    it('_isJobRelevant should return true for workplaceType remote', async () => {
        await testRelevance({ workplaceType: 'remote' }, true, 'Explicitly remote');
    });

    it('_isJobRelevant should return false for workplaceType on-site', async () => {
        await testRelevance({ workplaceType: 'on-site' }, false, 'Explicitly on-site/hybrid');
    });

    it('_isJobRelevant should return false for workplaceType hybrid', async () => {
        await testRelevance({ workplaceType: 'hybrid' }, false, 'Explicitly on-site/hybrid');
    });

    it('_isJobRelevant should return true for remote keyword in location (no workplaceType)', async () => {
        await testRelevance({ categories: { location: 'Remote - Global' } }, true, 'Remote keyword in location (config)');
    });
    
    it('_isJobRelevant should return true for remote keyword in location (null workplaceType)', async () => {
        await testRelevance({ workplaceType: null, categories: { location: 'Remote - LATAM' } }, true, 'Remote keyword in location (config)');
    });

    it('_isJobRelevant should return false if restrictive pattern detected', async () => {
        await testRelevance({ workplaceType: 'remote' }, false, 'Restrictive keyword detected (config)', true);
        expect(detectRestrictivePattern).toHaveBeenCalled();
    });

    it('_isJobRelevant should return false if no positive indicators (and not restricted)', async () => {
        await testRelevance({ categories: { location: 'New York'} }, false, 'No clear remote indicator');
    });
    
    it('_isJobRelevant should return false if workplaceType is on-site even with remote location keyword', async () => {
        await testRelevance({ workplaceType: 'on-site', categories: { location: 'Remote Team - Office Hub' } }, false, 'Explicitly on-site/hybrid');
    });

}); 
import { AshbyProcessor } from '../../../src/lib/jobProcessors/AshbyProcessor';
import { AshbyApiJob } from '../../../src/lib/fetchers/types';
import { StandardizedJob, RawJobData, ProcessedJobResult } from '../../../src/lib/jobProcessors/types';
import { JobSource, JobType, ExperienceLevel, HiringRegion } from '@prisma/client';
import * as jobUtils from '../../../src/lib/utils/jobUtils';
import * as textUtils from '../../../src/lib/utils/textUtils';
import * as logoUtils from '../../../src/lib/utils/logoUtils';
import * as scorerUtils from '../../../src/lib/utils/JobRelevanceScorer'; // Import scorer utils

// --- Mocks ---

// Mock pino factory function BEFORE other mocks
jest.mock('pino', () => {
    // Define the mock logger instance directly inside the factory function
    const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        trace: jest.fn(),
        // Add the child mock that returns the same instance (or a new mock if needed)
        child: jest.fn(() => mockLogger), 
    };
    // Return a factory function that returns this specific instance
    return jest.fn(() => mockLogger);
});

// Function to get the *actual* mock logger instance used by the processor
const getMockLoggerInstance = () => {
    const pinoMockFactory = jest.requireMock('pino') as jest.Mock;
    // Call the factory to get the instance it returns
    return pinoMockFactory(); 
};

// Mock other utilities
jest.mock('../../../src/lib/utils/jobUtils');
jest.mock('../../../src/lib/utils/textUtils');
jest.mock('../../../src/lib/utils/logoUtils');

// Mock JobRelevanceScorer
jest.mock('../../../src/lib/utils/JobRelevanceScorer', () => ({
  calculateRelevanceScore: jest.fn(),
}));

// Get references to the mocks AFTER they are mocked
const mockJobUtils = jest.requireMock('../../../src/lib/utils/jobUtils') as jest.Mocked<typeof import('../../../src/lib/utils/jobUtils')>;
const mockTextUtils = jest.requireMock('../../../src/lib/utils/textUtils') as jest.Mocked<typeof import('../../../src/lib/utils/textUtils')>;
const mockLogoUtils = jest.requireMock('../../../src/lib/utils/logoUtils') as jest.Mocked<typeof import('../../../src/lib/utils/logoUtils')>;
const mockedScorerUtils = scorerUtils as jest.Mocked<typeof scorerUtils>; // Cast mock

// --- Test Helpers ---

const createMockAshbyJob = (overrides: Partial<AshbyApiJob> = {}): AshbyApiJob => ({
    id: `job_${Math.random().toString(36).substring(2, 15)}`,
    title: 'Software Engineer',
    location: 'Remote',
    isRemote: true,
    isListed: true,
    descriptionHtml: '<p>Default job description.</p> <h2>Requirements</h2><p>Req 1</p><h2>Responsibilities</h2><p>Resp 1</p><h2>Benefits</h2><p>Ben 1</p>',
    publishedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-10T12:00:00Z').toISOString(),
    applyUrl: 'https://jobs.ashbyhq.com/test/apply',
    jobUrl: 'https://jobs.ashbyhq.com/test/job',
    organizationName: 'Test Org Inc.',
    employmentType: 'FullTime',
    _determinedHiringRegionType: 'global', // Default to global
    ...overrides,
    address: overrides.address === undefined ? undefined : { postalAddress: overrides.address?.postalAddress },
    secondaryLocations: overrides.secondaryLocations || [],
});

const createMockJobSource = (overrides: Partial<JobSource> = {}): JobSource => ({
    id: 'source-ashby-1',
    type: 'ashby',
    name: 'Source Company Name',
    config: { jobBoardName: 'test-board' },
    isEnabled: true,
    lastFetched: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    companyWebsite: 'https://source-company.com',
    logoUrl: null,
    ...overrides
});

// --- Test Suite ---

describe('AshbyProcessor', () => {
    let processor: AshbyProcessor;
    let mockRawJob: AshbyApiJob;
    let mockSource: JobSource;

    beforeEach(() => {
        // Clear the mocks on the instance created inside the jest.mock factory.
        const loggerInstanceUsedByProcessor = getMockLoggerInstance();
        Object.values(loggerInstanceUsedByProcessor).forEach((mockFn: any) => {
            if (jest.isMockFunction(mockFn)) { // Check if it's a mock function before clearing
                mockFn.mockClear();
            }
        });
        // Also clear the factory mock itself
        (jest.requireMock('pino') as jest.Mock).mockClear();

        // Clear other utility mocks
        mockJobUtils.detectJobType.mockClear(); // Ensure this is cleared for the loop test
        // ... clear other mocks if needed ...
        jest.clearAllMocks(); // General clear all mocks

        // Re-instantiate processor
        processor = new AshbyProcessor();
        mockRawJob = createMockAshbyJob();
        mockSource = createMockJobSource();

        // Default mock implementations
        mockTextUtils.stripHtml.mockImplementation(html => html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '');
        mockJobUtils.parseSections.mockImplementation(content => ({
            description: content?.includes('Default job description') ? 'Default job description.' : content ?? '',
            requirements: content?.includes('Req 1') ? 'Req 1' : undefined,
            responsibilities: content?.includes('Resp 1') ? 'Resp 1' : undefined,
            benefits: content?.includes('Ben 1') ? 'Ben 1' : undefined,
        }));
        mockJobUtils.extractSkills.mockReturnValue(['skill1', 'skill2']);
        mockJobUtils.detectJobType.mockReturnValue(JobType.FULL_TIME);
        mockJobUtils.detectExperienceLevel.mockReturnValue(ExperienceLevel.MID_LEVEL);
        mockLogoUtils.getCompanyLogo.mockReturnValue('https://logo.clearbit.com/source-company.com');
        mockedScorerUtils.calculateRelevanceScore.mockReturnValue(77); // Default mock score
    });

    it('should successfully process a valid remote job and calculate score', async () => {
        const mockSourceWithScoring = createMockJobSource({
            config: { ...mockSource.config, SCORING_SIGNALS: { /* mock signals */ } }
        });
        const result = await processor.processJob(mockRawJob, mockSourceWithScoring);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        const job = result.job as StandardizedJob;

        // Verify scorer call
        expect(mockedScorerUtils.calculateRelevanceScore).toHaveBeenCalledTimes(1);
        expect(mockedScorerUtils.calculateRelevanceScore).toHaveBeenCalledWith(
          {
            title: mockRawJob.title,
            description: 'Default job description. Requirements Req 1 Responsibilities Resp 1 Benefits Ben 1',
            location: mockRawJob.location
          },
          mockSourceWithScoring.config
        );
        // Verify score in result
        expect(job.relevanceScore).toBe(77);

        // Verify standard fields and metadataRaw
        expect(job).toBeDefined();
        expect(job.sourceId).toBe(mockRawJob.id);
        expect(job.source).toBe('ashby');
        expect(job.title).toBe('Software Engineer');
        expect(job.description).toBe('Default job description.');
        expect(job.requirements).toBe('Req 1');
        expect(job.responsibilities).toBe('Resp 1');
        expect(job.benefits).toBe('Ben 1');
        expect(job.jobType).toBe(JobType.FULL_TIME); // Mapped from 'FullTime'
        expect(job.experienceLevel).toBe(ExperienceLevel.MID_LEVEL);
        expect(job.skills).toEqual(['skill1', 'skill2']);
        expect(job.tags).toEqual(['skill1', 'skill2']);
        expect(job.hiringRegion).toBe(HiringRegion.WORLDWIDE); // From _determinedHiringRegionType: 'global'
        expect(job.location).toBe('Remote');
        expect(job.country).toBeUndefined(); // No address provided in mock
        expect(job.workplaceType).toBe('REMOTE');
        expect(job.applicationUrl).toBe('https://jobs.ashbyhq.com/test/apply');
        expect(job.companyName).toBe('Source Company Name'); // From sourceData
        expect(job.companyLogo).toBe('https://logo.clearbit.com/source-company.com');
        expect(job.companyWebsite).toBe('https://source-company.com');
        expect(job.publishedAt).toEqual(new Date('2024-01-01T10:00:00Z'));
        expect(job.updatedAt).toEqual(new Date('2024-01-10T12:00:00Z'));

        // Check util calls
        expect(mockTextUtils.stripHtml).toHaveBeenCalledWith(mockRawJob.descriptionHtml);
        expect(mockJobUtils.parseSections).toHaveBeenCalled();
        expect(mockJobUtils.extractSkills).toHaveBeenCalled();
        expect(mockJobUtils.detectJobType).not.toHaveBeenCalled(); // Since 'FullTime' was mapped
        expect(mockJobUtils.detectExperienceLevel).toHaveBeenCalled();
        expect(mockLogoUtils.getCompanyLogo).toHaveBeenCalledWith('https://source-company.com');
        expect(job.metadataRaw).toEqual({
            employmentType: mockRawJob.employmentType,
            team: mockRawJob.team,
            compensationTier: mockRawJob.compensationTier,
            department: mockRawJob.department,
            locations: mockRawJob.locations,
            address: mockRawJob.address
        });
    });

    it('should return failure and NOT calculate score if job is not listed', async () => {
        mockRawJob = createMockAshbyJob({ isListed: false });
        const mockSourceWithScoring = createMockJobSource({ config: { SCORING_SIGNALS: {} } });
        const result = await processor.processJob(mockRawJob, mockSourceWithScoring);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Job is not listed');
        expect(result.job).toBeUndefined();
        expect(mockedScorerUtils.calculateRelevanceScore).not.toHaveBeenCalled();
    });

    it('should return failure and NOT calculate score if job is not remote', async () => {
        mockRawJob = createMockAshbyJob({ isRemote: false });
        const mockSourceWithScoring = createMockJobSource({ config: { SCORING_SIGNALS: {} } });
        const result = await processor.processJob(mockRawJob, mockSourceWithScoring);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Job is not explicitly marked as remote');
        expect(result.job).toBeUndefined();
        expect(mockedScorerUtils.calculateRelevanceScore).not.toHaveBeenCalled();
    });

    it('should return failure and NOT calculate score if job isRemote is undefined', async () => {
        mockRawJob = createMockAshbyJob({ isRemote: undefined });
        const mockSourceWithScoring = createMockJobSource({ config: { SCORING_SIGNALS: {} } });
        const result = await processor.processJob(mockRawJob, mockSourceWithScoring);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Job is not explicitly marked as remote');
        expect(result.job).toBeUndefined();
        expect(mockedScorerUtils.calculateRelevanceScore).not.toHaveBeenCalled();
    });

    it('should process job but return null score if SCORING_SIGNALS are missing in config', async () => {
        // Config WITHOUT scoring signals
        const mockSourceWithoutScoring = createMockJobSource({ config: { jobBoardName: 'test-board' } }); 
        mockRawJob = createMockAshbyJob(); // Ensure job is valid

        const result = await processor.processJob(mockRawJob, mockSourceWithoutScoring);

        expect(result.success).toBe(true);
        expect(result.job).toBeDefined();
        const job = result.job!;

        // Verify scorer was NOT called
        expect(mockedScorerUtils.calculateRelevanceScore).not.toHaveBeenCalled();
        // Verify score is null
        expect(job.relevanceScore).toBeNull();
    });

    it('should map LATAM region correctly', async () => {
        mockRawJob = createMockAshbyJob({ _determinedHiringRegionType: 'latam' });
        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(true);
        expect((result.job as StandardizedJob).hiringRegion).toBe(HiringRegion.LATAM);
    });

    it('should handle undefined region type', async () => {
        mockRawJob = createMockAshbyJob({ _determinedHiringRegionType: undefined });
        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(true);
        expect((result.job as StandardizedJob).hiringRegion).toBeUndefined();
    });

    it('should map various employment types correctly', async () => {
        const types: { ashby: string | undefined, expected: JobType }[] = [
            { ashby: 'FullTime', expected: JobType.FULL_TIME },
            { ashby: 'PartTime', expected: JobType.PART_TIME },
            { ashby: 'Contract', expected: JobType.CONTRACT },
            { ashby: 'Intern', expected: JobType.INTERNSHIP },
            { ashby: 'Temp', expected: JobType.FULL_TIME }, // Mocked fallback
            { ashby: undefined, expected: JobType.FULL_TIME }, // Mocked fallback
        ];

        // Mock the fallback behaviour ONCE before the loop
        mockJobUtils.detectJobType.mockReturnValue(JobType.FULL_TIME); 

        for (const type of types) {
            mockRawJob = createMockAshbyJob({ employmentType: type.ashby });

            // Clear the call count before each iteration where we expect it to be called
            if (type.ashby === 'Temp' || type.ashby === undefined) {
                 mockJobUtils.detectJobType.mockClear(); // Clear calls specifically for this iteration
            }

            const result = await processor.processJob(mockRawJob, mockSource);
            expect(result.success).toBe(true);
            // Ensure the expected type matches the mock or the mapped value
            expect((result.job as StandardizedJob).jobType).toBe(type.expected);

            // Check calls AFTER processing
            if (type.ashby === 'Temp' || type.ashby === undefined) {
                 expect(mockJobUtils.detectJobType).toHaveBeenCalledTimes(1);
            } else {
                 expect(mockJobUtils.detectJobType).not.toHaveBeenCalled();
            }
            // Clear again after check to prevent interference with next iteration
            mockJobUtils.detectJobType.mockClear(); 
        }
    });

     it('should use jobUrl if applyUrl is missing', async () => {
        mockRawJob = createMockAshbyJob({ applyUrl: undefined });
        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(true);
        expect((result.job as StandardizedJob).applicationUrl).toBe(mockRawJob.jobUrl);
    });

    it('should use organizationName if sourceData.name is missing', async () => {
        mockSource = createMockJobSource({ name: undefined });
        mockRawJob = createMockAshbyJob({ organizationName: 'Ashby Org Name' });
        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(true);
        expect((result.job as StandardizedJob).companyName).toBe('Ashby Org Name');
    });

    it('should handle missing descriptionHtml', async () => {
        mockRawJob = createMockAshbyJob({ descriptionHtml: undefined });
        mockTextUtils.stripHtml.mockReturnValueOnce(''); // Ensure stripHtml returns empty string for null
        mockJobUtils.parseSections.mockReturnValueOnce({}); // Empty sections
        mockJobUtils.extractSkills.mockReturnValueOnce([]); // No skills

        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(true);
        const job = result.job as StandardizedJob;
        expect(job.description).toBe('');
        expect(job.requirements).toBeUndefined();
        expect(job.responsibilities).toBeUndefined();
        expect(job.benefits).toBeUndefined();
        expect(job.skills).toEqual([]);
        expect(job.tags).toEqual([]);
        expect(mockTextUtils.stripHtml).toHaveBeenCalledWith('');
    });

    it('should extract country from address', async () => {
         mockRawJob = createMockAshbyJob({
            address: { postalAddress: { addressCountry: 'BR' } }
        });
        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(true);
        expect((result.job as StandardizedJob).country).toBe('BR');
    });

     it('should handle missing company website for logo fetching', async () => {
        mockSource = createMockJobSource({ companyWebsite: undefined });
        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(true);
        expect((result.job as StandardizedJob).companyLogo).toBeUndefined();
        expect(mockLogoUtils.getCompanyLogo).not.toHaveBeenCalled();
    });

    it('should handle errors during logo fetching', async () => {
        mockLogoUtils.getCompanyLogo.mockImplementation(() => {
            throw new Error('Logo fetch failed');
        });
        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(true); // Processing should still succeed
        expect((result.job as StandardizedJob).companyLogo).toBeUndefined();
        // Get the logger instance used by the processor for assertion
        const logger = getMockLoggerInstance();
        expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({error: expect.any(Error)}), expect.stringContaining('Error processing company website for logo URL.'));
    });

    it('should handle general processing errors', async () => {
        const processError = new Error('Something failed');
        mockJobUtils.extractSkills.mockImplementation(() => { throw processError; }); // Force error

        const result = await processor.processJob(mockRawJob, mockSource);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Something failed');
        expect(result.job).toBeUndefined();
        // Get the logger instance used by the processor for assertion
        const logger = getMockLoggerInstance();
        expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error: processError }), expect.stringContaining('Error processing job in AshbyProcessor'));
    });

}); 
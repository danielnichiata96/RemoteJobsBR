import { LeverProcessor } from '../../src/lib/jobProcessors/LeverProcessor'; // Adjust path as needed
import { JobSource, JobType, ExperienceLevel, SalaryPeriod } from '@prisma/client';
import pino from 'pino';
import { LeverApiPosting } from '../../src/lib/fetchers/types';

// Mock utilities used by the processor
jest.mock('../../src/lib/utils/textUtils', () => ({
    stripHtml: jest.fn((html) => html ? html.replace(/<[^>]*>/g, '') : ''), // Simple mock
}));
jest.mock('../../src/lib/utils/jobUtils', () => ({
    detectExperienceLevel: jest.fn(() => ExperienceLevel.MID), // Default mock
    detectJobType: jest.fn(() => JobType.FULL_TIME), // Default mock
    extractSkills: jest.fn(() => ['mocked-skill']), // Default mock
}));

// Mock pino
jest.mock('pino', () => {
    const mockChild = jest.fn().mockReturnThis();
    const mockLogger = {
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), trace: jest.fn(), child: mockChild,
    };
    mockChild.mockReturnValue(mockLogger);
    return jest.fn(() => mockLogger);
});

// Import mocked functions for verification
import { stripHtml } from '../../src/lib/utils/textUtils';
import { detectExperienceLevel, detectJobType, extractSkills } from '../../src/lib/utils/jobUtils';

describe('LeverProcessor', () => {
    let leverProcessor: LeverProcessor;
    let mockLogger: jest.Mocked<pino.Logger>;
    let mockChildLogger: jest.Mocked<pino.Logger>; // For verifying child logger calls
    let mockSource: JobSource;

    // Base mock raw job for convenience
    const baseRawJob: LeverApiPosting = {
        id: 'job123',
        text: 'Software Engineer',
        applyUrl: 'https://jobs.lever.co/test-lever-co/job123/apply',
        hostedUrl: 'https://jobs.lever.co/test-lever-co/job123',
        categories: {
            location: 'Remote - US',
            team: 'Engineering',
            commitment: 'Full-time'
        },
        content: {
            description: 'Job description text',
            descriptionHtml: '<p>Job description</p><ul><li>Requirement 1</li></ul>',
            lists: [{ text: 'Requirements', content: '<li>Requirement 1</li>' }]
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        workplaceType: 'remote'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        leverProcessor = new LeverProcessor();
        mockLogger = pino() as jest.Mocked<pino.Logger>;
        mockChildLogger = mockLogger.child() as jest.Mocked<pino.Logger>;
        mockSource = {
            id: 'lever-src-1',
            name: 'Test Lever Co',
            type: 'lever',
            config: { companyIdentifier: 'test-lever-co' },
            isEnabled: true,
            lastFetched: null,
            companyWebsite: 'https://testlever.co',
            logoUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Reset mock utility calls
        (stripHtml as jest.Mock).mockClear().mockImplementation((html) => html ? html.replace(/<[^>]*>/g, '') : '');
        (detectExperienceLevel as jest.Mock).mockClear().mockReturnValue(ExperienceLevel.MID);
        (detectJobType as jest.Mock).mockClear().mockReturnValue(JobType.FULL_TIME);
        (extractSkills as jest.Mock).mockClear().mockReturnValue(['mocked-skill']);
    });

    it('should instantiate correctly', () => {
        expect(leverProcessor).toBeInstanceOf(LeverProcessor);
        expect(leverProcessor.source).toBe('lever');
    });

    it('processJob should return a mapped job for valid input', async () => {
        const rawJob = { ...baseRawJob };
        const result = await leverProcessor.processJob(rawJob, mockSource, mockLogger);

        expect(mockLogger.child).toHaveBeenCalledWith({ processor: 'Lever', jobId: 'job123' });
        expect(mockChildLogger.trace).toHaveBeenCalledWith('Starting Lever job processing...');
        expect(mockChildLogger.info).toHaveBeenCalledWith('Successfully mapped job: Software Engineer');
        
        expect(result).not.toBeNull();
        expect(result?.title).toBe('Software Engineer');
        expect(result?.source).toBe('lever');
        expect(result?.sourceId).toBe('job123');
        expect(result?.sourceUrl).toBe(rawJob.applyUrl);
        expect(result?.companyName).toBe(mockSource.name);
        expect(result?.content).toBe(rawJob.content.descriptionHtml);
        expect(result?.publishedAt).toEqual(new Date(rawJob.createdAt));
        expect(result?.updatedAt).toEqual(new Date(rawJob.updatedAt));
        expect(result?.status).toBe('ACTIVE');
        // Check utility function calls
        expect(stripHtml).toHaveBeenCalledWith(rawJob.content.descriptionHtml);
        expect(detectExperienceLevel).toHaveBeenCalledWith('Software Engineer Job description Requirement 1'); // Approx text
        expect(detectJobType).not.toHaveBeenCalled(); // Because it uses categories.commitment
        expect(extractSkills).toHaveBeenCalledWith('Software Engineer Job description Requirement 1'); // Approx text
    });

    it('processJob should correctly determine remote status', async () => {
        // Test case 1: workplaceType remote
        let rawJob1 = { ...baseRawJob, workplaceType: 'remote' as const };
        let result1 = await leverProcessor.processJob(rawJob1, mockSource, mockLogger);
        expect(result1?.isRemote).toBe(true);
        expect(result1?.location).toBe('Remote - US'); // Uses category first

        // Test case 2: workplaceType on-site
        let rawJob2 = { ...baseRawJob, workplaceType: 'on-site' as const };
        let result2 = await leverProcessor.processJob(rawJob2, mockSource, mockLogger);
        expect(result2?.isRemote).toBe(false);
        expect(result2?.location).toBe('Remote - US'); // Still uses category if present

        // Test case 3: workplaceType undefined, location has remote keyword
        let rawJob3 = { ...baseRawJob, workplaceType: undefined, categories: { location: 'Remote - Global' } };
        let result3 = await leverProcessor.processJob(rawJob3, mockSource, mockLogger);
        expect(result3?.isRemote).toBe(true);
        expect(result3?.location).toBe('Remote - Global');

        // Test case 4: No clear indicator
        let rawJob4 = { ...baseRawJob, workplaceType: undefined, categories: { location: 'London' } };
        let result4 = await leverProcessor.processJob(rawJob4, mockSource, mockLogger);
        expect(result4?.isRemote).toBe(false);
        expect(result4?.location).toBe('London');

         // Test case 5: No location category, workplaceType undefined
        let rawJob5 = { ...baseRawJob, workplaceType: undefined, categories: { location: undefined } };
        let result5 = await leverProcessor.processJob(rawJob5, mockSource, mockLogger);
        expect(result5?.isRemote).toBe(false);
        expect(result5?.location).toBe('Unknown'); // Falls back to unknown if not remote
    });

    it('processJob should correctly map jobType', async () => {
        (detectJobType as jest.Mock).mockImplementation((commitment) => {
            if (commitment?.includes('part')) return JobType.PART_TIME;
            if (commitment === 'contract') return JobType.CONTRACT;
            if (commitment === 'intern') return JobType.INTERNSHIP;
            return JobType.FULL_TIME;
        });

        let rawJob1 = { ...baseRawJob, categories: { ...baseRawJob.categories, commitment: 'Full-time' } };
        let result1 = await leverProcessor.processJob(rawJob1, mockSource, mockLogger);
        expect(result1?.jobType).toBe(JobType.FULL_TIME);

        let rawJob2 = { ...baseRawJob, categories: { ...baseRawJob.categories, commitment: 'Part-time' } };
        let result2 = await leverProcessor.processJob(rawJob2, mockSource, mockLogger);
        expect(result2?.jobType).toBe(JobType.PART_TIME);

        let rawJob3 = { ...baseRawJob, categories: { ...baseRawJob.categories, commitment: 'Contract' } };
        let result3 = await leverProcessor.processJob(rawJob3, mockSource, mockLogger);
        expect(result3?.jobType).toBe(JobType.CONTRACT);
        
        let rawJob4 = { ...baseRawJob, categories: { ...baseRawJob.categories, commitment: 'Intern' } };
        let result4 = await leverProcessor.processJob(rawJob4, mockSource, mockLogger);
        expect(result4?.jobType).toBe(JobType.INTERNSHIP);

        // Test default
        let rawJob5 = { ...baseRawJob, categories: { ...baseRawJob.categories, commitment: 'Volunteer' } }; // Unknown
        let result5 = await leverProcessor.processJob(rawJob5, mockSource, mockLogger);
        expect(result5?.jobType).toBe(JobType.FULL_TIME); // Defaults to full-time
    });

    it('processJob should correctly map salary information', async () => {
        let rawJobWithSalary = {
            ...baseRawJob,
            salaryRange: {
                min: 80000,
                max: 120000,
                currency: 'USD',
                interval: 'year'
            }
        };
        let result = await leverProcessor.processJob(rawJobWithSalary, mockSource, mockLogger);
        expect(result?.salaryMin).toBe(80000);
        expect(result?.salaryMax).toBe(120000);
        expect(result?.salaryCurrency).toBe('USD');
        expect(result?.salaryPeriod).toBe(SalaryPeriod.YEARLY);

        let rawJobMonthly = { ...baseRawJob, salaryRange: { min: 5000, max: 7000, currency: 'BRL', interval: 'Monthly' } };
        let resultMonthly = await leverProcessor.processJob(rawJobMonthly, mockSource, mockLogger);
        expect(resultMonthly?.salaryPeriod).toBe(SalaryPeriod.MONTHLY);

        let rawJobNoSalary = { ...baseRawJob, salaryRange: undefined };
        let resultNoSalary = await leverProcessor.processJob(rawJobNoSalary, mockSource, mockLogger);
        expect(resultNoSalary?.salaryMin).toBeNull();
        expect(resultNoSalary?.salaryMax).toBeNull();
        expect(resultNoSalary?.salaryCurrency).toBeNull();
        expect(resultNoSalary?.salaryPeriod).toBeNull();
    });

    it('processJob should return null and log error for invalid raw data format', async () => {
        const invalidRawJob = null as any; // Test null
        const resultNull = await leverProcessor.processJob(invalidRawJob, mockSource, mockLogger);
        expect(resultNull).toBeNull();
        expect(mockChildLogger.error).toHaveBeenCalledWith({ error: expect.any(Error), rawJobId: undefined }, 'Failed to process Lever job');

        const invalidRawJob2 = { id: 'onlyId' } as any; // Test missing text
        const resultIncomplete = await leverProcessor.processJob(invalidRawJob2, mockSource, mockLogger);
        expect(resultIncomplete).toBeNull();
        expect(mockChildLogger.error).toHaveBeenCalledWith({ error: expect.any(Error), rawJobId: 'onlyId' }, 'Failed to process Lever job');
    });

    it('processJob should return null if _mapToStandardizedJob throws an error', async () => {
        // Simulate an error during mapping (e.g., unexpected data structure)
        const erroringRawJob = { 
            ...baseRawJob, 
            content: { descriptionHtml: 123 } // Invalid type causing stripHtml to potentially fail
         } as any;
         (stripHtml as jest.Mock).mockImplementation(() => { throw new Error('Simulated stripHtml error'); });

        const result = await leverProcessor.processJob(erroringRawJob, mockSource, mockLogger);
        expect(result).toBeNull();
        const childLogger = mockLogger.child(); // Get the child logger instance
        expect(childLogger.error).toHaveBeenCalledWith(expect.anything(), 'Failed to process Lever job');
    });

    it('processJob should handle missing optional fields gracefully', async () => {
         const rawJobMinimal = {
            id: 'job456',
            text: 'Minimal Job',
            // Missing applyUrl, hostedUrl, categories, descriptionHtml, createdAt, updatedAt
        };
        
        const result = await leverProcessor.processJob(rawJobMinimal, mockSource, mockLogger);
        
        expect(result).not.toBeNull();
        expect(result?.title).toBe('Minimal Job');
        expect(result?.sourceUrl).toBeUndefined(); // No URL provided
        expect(result?.location).toBe('Remote'); // Default placeholder
        expect(result?.content).toBe(''); // Empty string for missing description
        // Check date handling - should default reasonably
        expect(result?.publishedAt).toBeInstanceOf(Date);
        expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    // TODO: Add more specific tests for _mapToStandardizedJob once implemented
    // - Test mapping of different location types
    // - Test remote status detection
    // - Test experience level/job type/skills extraction
    // - Test date parsing
}); 
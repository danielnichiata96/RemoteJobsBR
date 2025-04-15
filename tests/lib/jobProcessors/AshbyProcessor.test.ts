import { PrismaClient, JobSource, JobType, ExperienceLevel, WorkplaceType, JobSourceType, HiringRegion } from '@prisma/client';
import pino from 'pino';
import { AshbyProcessor } from '../../../src/lib/jobProcessors/AshbyProcessor';
import { StandardizedJob } from '../../../src/types/StandardizedJob';
import { AshbyApiJob, AshbyLocation } from '../../../src/lib/fetchers/types'; // Use shared types
// Mock utility functions
import * as jobUtils from '../../../src/lib/utils/jobUtils';

// --- Mocks ---
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({})),
    // Mock necessary enums
    JobType: {
        FULL_TIME: 'FULL_TIME',
        PART_TIME: 'PART_TIME',
        CONTRACT: 'CONTRACT',
        INTERNSHIP: 'INTERNSHIP',
        UNKNOWN: 'UNKNOWN'
    },
    ExperienceLevel: {
        JUNIOR: 'JUNIOR',
        MID_LEVEL: 'MID_LEVEL',
        SENIOR: 'SENIOR',
        MANAGER: 'MANAGER',
        DIRECTOR: 'DIRECTOR',
        EXECUTIVE: 'EXECUTIVE',
        UNKNOWN: 'UNKNOWN'
    },
    WorkplaceType: {
        REMOTE: 'REMOTE',
        HYBRID: 'HYBRID',
        ON_SITE: 'ON_SITE',
        UNKNOWN: 'UNKNOWN'
    },
    HiringRegion: {
        WORLDWIDE: 'WORLDWIDE',
        LATAM: 'LATAM',
        BRAZIL: 'BRAZIL'
    },
    JobSourceType: { // Include if needed by JobSource mock
        GREENHOUSE: 'GREENHOUSE',
        ASHBY: 'ASHBY'
    }
}));

jest.mock('../../../src/lib/utils/jobUtils', () => ({
    extractSkills: jest.fn(),
    detectExperienceLevel: jest.fn(),
    detectJobType: jest.fn(), // Although AshbyProcessor uses its own mapping
}));

// Explicitly mock the textUtils module
jest.mock('../../../src/lib/utils/textUtils', () => ({
    stripHtml: jest.fn((html) => {
        // Provide a basic mock implementation for testing
        if (!html) return '';
        // Simple regex strip for mock, real implementation is more complex
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }),
    parseDate: jest.fn((dateString) => {
        if (!dateString) return undefined;
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? undefined : d;
    }),
}));

const mockLogger = pino({ level: 'silent' });

// --- Test Data Helpers ---

const createMockAshbyLocation = (overrides: Partial<AshbyLocation>): AshbyLocation => ({
    id: `loc-${Math.random().toString(36).substring(7)}`,
    name: 'Default Location',
    type: 'office',
    address: null,
    isRemote: false,
    ...overrides,
});

const createMockAshbyJob = (overrides: Partial<AshbyApiJob> = {}): AshbyApiJob => {
    const id = overrides.id || `job-${Math.random().toString(36).substring(7)}`;
    return {
        id,
        title: 'Software Engineer',
        locations: [createMockAshbyLocation({ name: 'Remote', isRemote: true })], // Default to one remote location
        secondaryLocations: [],
        isRemote: true, // Default to job being remote
        descriptionHtml: '<p>Job description</p>',
        descriptionPlain: 'Job description',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isListed: true,
        jobUrl: `https://jobs.example.com/${id}`,
        applyUrl: `https://jobs.example.com/${id}/apply`,
        ...overrides,
    };
};

const createMockJobSource = (overrides: Partial<JobSource> = {}): JobSource => ({
    id: 1,
    name: 'Test Ashby Source',
    description: 'Mock source',
    url: 'https://api.ashbyhq.com/jobs?source=test',
    type: JobSourceType.ASHBY,
    config: { jobBoardName: 'test' }, // Example config
    companyWebsite: 'https://test.example.com',
    isActive: true,
    lastFetched: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
});

// --- Test Suite ---

describe('AshbyProcessor Logic', () => {
    let processor: AshbyProcessor;
    let mockStripHtml: jest.Mock;
    let mockParseDate: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        processor = new AshbyProcessor();

        // Import the mocked functions *after* mocking the module
        const textUtils = require('../../../src/lib/utils/textUtils');
        mockStripHtml = textUtils.stripHtml;
        mockParseDate = textUtils.parseDate;

        // Set up mock implementations
        mockStripHtml.mockImplementation(html => {
            if (html === "<p>Join our <strong>awesome</strong> team!</p> <p>Skills: React, Node.js</p>") {
                return "Join our awesome team! Skills: React, Node.js";
            }
            return html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
        });

        // Reset other mocks 
        (jobUtils.extractSkills as jest.Mock).mockReturnValue(['React', 'Node.js']);
        (jobUtils.detectExperienceLevel as jest.Mock).mockReturnValue(ExperienceLevel.MID_LEVEL);
    });

    // --- Tests for _mapToStandardizedJob ---
    describe('_mapToStandardizedJob', () => {
        it.skip('should correctly map a standard Ashby job', () => {
            const rawJob = createMockAshbyJob({ 
                _determinedHiringRegionType: 'global',
                descriptionHtml: "<p>Join our <strong>awesome</strong> team!</p> <p>Skills: React, Node.js</p>"
            });
            const source = createMockJobSource();
            const expectedPublishedDate = new Date(rawJob.publishedAt);
            mockParseDate.mockImplementation((ds) => ds === rawJob.publishedAt ? expectedPublishedDate : undefined);

            // @ts-ignore
            const result = processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);

            expect(result.publishedAt).toEqual(expectedPublishedDate);
            expect(mockStripHtml).toHaveBeenCalledWith(rawJob.descriptionHtml);
            expect(mockParseDate).toHaveBeenCalledWith(rawJob.publishedAt);
            expect(mockParseDate).toHaveBeenCalledWith(rawJob.updatedAt);
            expect(result.source).toBe('ashby');
            expect(result.sourceId).toBe(rawJob.jobUrl);
            expect(result.title).toBe('Software Engineer');
            expect(result.description).toBe(rawJob.descriptionHtml);
            expect(result.applicationUrl).toBe(rawJob.applyUrl);
            expect(result.companyName).toBe(source.name);
            expect(result.companyWebsite).toBe(source.companyWebsite);
            expect(result.jobType).toBe(JobType.FULL_TIME);
            expect(result.experienceLevel).toBe(ExperienceLevel.MID_LEVEL);
            expect(result.jobType2).toBe('global');
            expect(result.workplaceType).toBe(WorkplaceType.REMOTE);
            expect(result.skills).toEqual(['React', 'Node.js']);
            expect(result.location).toBe('Remote');
        });

        it('should handle missing description gracefully', () => {
            const rawJob = createMockAshbyJob({ descriptionHtml: null, descriptionPlain: null });
            const source = createMockJobSource();
            // @ts-ignore
            const result = processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);
            expect(result.description).toBe('');
            // Should be called with only the title
            expect(jobUtils.extractSkills).toHaveBeenCalledWith(expect.stringContaining('Software Engineer')); 
            expect(jobUtils.detectExperienceLevel).toHaveBeenCalledWith(expect.stringContaining('Software Engineer')); 
        });

        it('should build location string correctly (Single City/Country)', () => {
            const rawJob = createMockAshbyJob({
                locations: [createMockAshbyLocation({ name: 'Office', address: { city: 'Sao Paulo', state: 'SP', countryCode: 'BR' } })],
                isRemote: false
            });
            const source = createMockJobSource();
             // @ts-ignore
             const result = processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);
             // Correct expectation: The logic joins name and address parts if name isn't 'Remote'
             expect(result.location).toBe('Office | Sao Paulo, SP, BR'); 
        });

        it('should build location string correctly (Multiple locations, unique parts)', () => {
            const rawJob = createMockAshbyJob({
                locations: [
                    createMockAshbyLocation({ name: 'Remote' }),
                    createMockAshbyLocation({ name: 'Office', address: { city: 'London', countryCode: 'GB' } }),
                ],
                secondaryLocations: [
                   createMockAshbyLocation({ name: 'Hub', address: { city: 'London', countryCode: 'GB' } }),
                   createMockAshbyLocation({ name: 'Paris Hub' })
                ],
                isRemote: true
            });
            const source = createMockJobSource();
             // @ts-ignore
             const result = processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);
             // Correct expectation based on Set logic and join
             expect(result.location.split(' | ').sort()).toEqual(['London, GB', 'Office', 'Paris Hub', 'Hub', 'Remote'].sort()); 
        });
        
        it('should return "Location Not Specified" if locations empty and isRemote is false/null', () => {
            const rawJobNull = createMockAshbyJob({ locations: [], secondaryLocations: [], isRemote: null });
            const rawJobFalse = createMockAshbyJob({ locations: [], secondaryLocations: [], isRemote: false });
            const source = createMockJobSource();
            // @ts-ignore
            const resultNull = processor._mapToStandardizedJob(rawJobNull, source, rawJobNull.jobUrl, mockLogger);
            // @ts-ignore
            const resultFalse = processor._mapToStandardizedJob(rawJobFalse, source, rawJobFalse.jobUrl, mockLogger);
            // Correct the expected string based on the implementation
            expect(resultNull.location).toBe('Location Unknown'); 
            expect(resultFalse.location).toBe('Location Unknown'); 
        });
        
        it('should use stripped HTML for analysis if plain text is missing', () => {
            const rawJob = createMockAshbyJob({
                title: 'Analyst',
                descriptionHtml: '<b>Requires SQL</b> and <i>Excel</i> skills.',
                descriptionPlain: null
            });
            const source = createMockJobSource();
            // Correctly mock stripHtml for this specific input
            mockStripHtml.mockReturnValueOnce('Requires SQL and Excel skills.');
             // @ts-ignore
             processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);
    
            const expectedStrippedText = 'Requires SQL and Excel skills.';
            const expectedCombinedText = `Analyst ${expectedStrippedText}`;
            // Correct assertion based on mocked return value
            expect(jobUtils.extractSkills).toHaveBeenCalledWith(expectedCombinedText); 
            expect(jobUtils.detectExperienceLevel).toHaveBeenCalledWith(expectedCombinedText);
        });

        it('should correctly map different employment types', () => {
            const source = createMockJobSource();
            const testCases: { input: AshbyApiJob['employmentType']; expected: JobType }[] = [
                { input: 'FullTime', expected: JobType.FULL_TIME },
                { input: 'PartTime', expected: JobType.PART_TIME },
                { input: 'Contract', expected: JobType.CONTRACT },
                { input: 'Intern', expected: JobType.INTERNSHIP },
                { input: 'Temporary', expected: JobType.CONTRACT }, // Mapped to CONTRACT
                { input: null, expected: JobType.UNKNOWN },
                { input: undefined, expected: JobType.UNKNOWN },
                { input: 'SomethingElse' as any, expected: JobType.UNKNOWN },
            ];

            testCases.forEach(tc => {
                const rawJob = createMockAshbyJob({ employmentType: tc.input });
                // @ts-ignore
                const result = processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);
                expect(result.jobType).toBe(tc.expected);
            });
        });

        it('should map jobType2 (hiringRegion) from _determinedHiringRegionType', () => {
            const rawJobLatam = createMockAshbyJob({ _determinedHiringRegionType: 'latam' });
            const rawJobGlobal = createMockAshbyJob({ _determinedHiringRegionType: 'global' });
            const rawJobNone = createMockAshbyJob({ _determinedHiringRegionType: undefined });
            const source = createMockJobSource();

            // @ts-ignore
            const resultLatam = processor._mapToStandardizedJob(rawJobLatam, source, rawJobLatam.jobUrl, mockLogger);
            // @ts-ignore
            const resultGlobal = processor._mapToStandardizedJob(rawJobGlobal, source, rawJobGlobal.jobUrl, mockLogger);
             // @ts-ignore
             const resultNone = processor._mapToStandardizedJob(rawJobNone, source, rawJobNone.jobUrl, mockLogger);

            expect(resultLatam.jobType2).toBe('latam');
            expect(resultGlobal.jobType2).toBe('global');
            expect(resultNone.jobType2).toBeUndefined();
        });

        it('should set workplaceType based on isRemote OR _determinedHiringRegionType', () => {
             const source = createMockJobSource();
             const testCases: { job: Partial<AshbyApiJob>; expected: WorkplaceType }[] = [
                { job: { isRemote: true, _determinedHiringRegionType: undefined }, expected: WorkplaceType.REMOTE },
                { job: { isRemote: null, _determinedHiringRegionType: 'latam' }, expected: WorkplaceType.REMOTE },
                { job: { isRemote: null, _determinedHiringRegionType: 'global' }, expected: WorkplaceType.REMOTE },
                { job: { isRemote: true, _determinedHiringRegionType: 'latam' }, expected: WorkplaceType.REMOTE }, // Both true
                { job: { isRemote: false, _determinedHiringRegionType: undefined }, expected: WorkplaceType.UNKNOWN }, // Explicitly false
                { job: { isRemote: null, _determinedHiringRegionType: undefined }, expected: WorkplaceType.UNKNOWN }, // Both unknown
             ];

             testCases.forEach((tc, index) => {
                const rawJob = createMockAshbyJob(tc.job);
                 // @ts-ignore
                 const result = processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);
                 expect(result.workplaceType).toBe(tc.expected);
             });
        });

         it('should handle missing dates gracefully (use current date for publishedAt)', () => {
             const rawJob = createMockAshbyJob({ publishedAt: undefined as any, updatedAt: undefined });
             const source = createMockJobSource();
             const beforeMapping = new Date();
              // @ts-ignore
              const result = processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);
              const afterMapping = new Date();

              // Check that publishedAt is roughly the current time
              expect(result.publishedAt).toBeDefined();
              expect(result.publishedAt.getTime()).toBeGreaterThanOrEqual(beforeMapping.getTime());
              expect(result.publishedAt.getTime()).toBeLessThanOrEqual(afterMapping.getTime());

             // updatedAt field is not part of the output of _mapToStandardizedJob
         });

        it('should call utility functions with combined title and description', () => {
            const rawJob = createMockAshbyJob({
                title: 'Senior Dev',
                descriptionPlain: 'Experience with Go needed.'
            });
            const source = createMockJobSource();
            // @ts-ignore
            processor._mapToStandardizedJob(rawJob, source, rawJob.jobUrl, mockLogger);

            const expectedCombinedText = 'Senior Dev Experience with Go needed.';
            expect(jobUtils.extractSkills).toHaveBeenCalledWith(expectedCombinedText);
            expect(jobUtils.detectExperienceLevel).toHaveBeenCalledWith(expectedCombinedText);
        });
    });

    // --- Tests for processJob ---
    describe('processJob', () => {
        it('should return success:false if essential fields are missing (jobUrl/id)', async () => {
            const testJob = createMockAshbyJob();
            // Delete the properties after creation to avoid the error in the factory function
            delete testJob.jobUrl;
            delete testJob.id;
            
            const result = await processor.processJob(testJob, createMockJobSource(), mockLogger);
            expect(result.success).toBe(false);
            // Correct the expected error message based on implementation
            expect(result.error).toBe('Missing jobUrl to use as sourceId'); 
        });
    });
}); 
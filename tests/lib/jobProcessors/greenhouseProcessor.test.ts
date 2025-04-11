import { GreenhouseProcessor } from '../../../src/lib/jobProcessors/greenhouseProcessor';
import { GreenhouseJob, EnhancedGreenhouseJob, ProcessedJobResult } from '../../../src/lib/jobProcessors/types';
import * as jobUtils from '../../../src/lib/utils/jobUtils';
import { JobType, ExperienceLevel, WorkplaceType } from '@prisma/client';
import pino from 'pino';

// --- Mocks ---

// Mock Pino logger
jest.mock('pino', () => {
  const mockLog = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return jest.fn(() => mockLog);
});

// Mock the entire @prisma/client module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({})), // Mock constructor if needed
  // Provide mock enums
  JobType: {
    FULL_TIME: 'FULL_TIME',
    PART_TIME: 'PART_TIME',
    CONTRACT: 'CONTRACT',
    INTERNSHIP: 'INTERNSHIP',
    FREELANCE: 'FREELANCE'
  },
  ExperienceLevel: {
    ENTRY: 'ENTRY',
    MID: 'MID',
    SENIOR: 'SENIOR',
    LEAD: 'LEAD'
  },
  WorkplaceType: {
    REMOTE: 'REMOTE',
    HYBRID: 'HYBRID',
    ON_SITE: 'ON_SITE'
  },
  JobStatus: { 
      ACTIVE: 'ACTIVE', 
      CLOSED: 'CLOSED', 
      DRAFT: 'DRAFT' 
  },
  UserRole: { 
      CANDIDATE: 'CANDIDATE', 
      RECRUITER: 'RECRUITER', 
      COMPANY: 'COMPANY', 
      ADMIN: 'ADMIN' 
  },
}));

// Mock jobUtils functions
jest.mock('../../../src/lib/utils/jobUtils', () => ({
  extractSkills: jest.fn(),
  cleanHtml: jest.fn(),
  detectJobType: jest.fn(),
  detectExperienceLevel: jest.fn(),
  parseSections: jest.fn(),
  isRemoteJob: jest.fn(),
}));

// --- Test Suite ---

describe('GreenhouseProcessor', () => {
  let processor: GreenhouseProcessor;
  let loggerMock: any;

  // Cast the mock module to the correct type to access mocked functions
  const mockedJobUtils = jobUtils as jest.Mocked<typeof jobUtils>;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new GreenhouseProcessor();
    loggerMock = pino();

    // Default mock implementations for jobUtils
    mockedJobUtils.cleanHtml.mockImplementation(html => html); // Simple passthrough
    mockedJobUtils.extractSkills.mockReturnValue(['mockSkill1', 'mockSkill2']);
    mockedJobUtils.detectJobType.mockReturnValue(JobType.FULL_TIME);
    mockedJobUtils.detectExperienceLevel.mockReturnValue(ExperienceLevel.MID);
    mockedJobUtils.parseSections.mockReturnValue({
      description: 'Parsed Description',
      requirements: 'Parsed Requirements',
      responsibilities: 'Parsed Responsibilities',
      benefits: 'Parsed Benefits'
    });
    mockedJobUtils.isRemoteJob.mockReturnValue(true); // Assume remote by default unless specified
  });

  // --- Test Data Definition ---
  const basicRawJob: GreenhouseJob = {
    id: 123,
    title: 'Basic Software Engineer',
    content: '<p>Job Description</p> <b>Requirements:</b> Skill A', // HTML content
    location: { name: 'Remote - USA' },
    absolute_url: 'http://apply.greenhouse.io/basic123',
    updated_at: '2024-01-10T00:00:00Z',
    company: {
        name: 'Basic Co',
        boardToken: 'basicco',
        logo: null,
        website: null
    }
    // metadata and departments often missing in basic fetches
  };

  const enhancedRawJob: EnhancedGreenhouseJob = {
    id: 456,
    title: 'Enhanced Senior Engineer',
    content: 'Enhanced Description Content', // Usually cleaner
    location: { name: 'Remote Worldwide' },
    absolute_url: 'http://apply.greenhouse.io/enhanced456',
    updated_at: '2024-01-11T00:00:00Z',
    company: {
      name: 'Enhanced Corp',
      boardToken: 'enhancedcorp',
      logo: 'http://logo.com/logo.png',
      website: 'http://enhanced.corp'
    },
    // Pre-processed fields
    requirements: 'Enhanced Requirements Field',
    responsibilities: 'Enhanced Responsibilities Field',
    benefits: 'Enhanced Benefits Field',
    jobType: JobType.CONTRACT,
    experienceLevel: ExperienceLevel.SENIOR,
    skills: ['enhancedSkill1', 'enhancedSkill2'],
    tags: ['tag1', 'tag2'],
    country: 'Global',
    workplaceType: WorkplaceType.REMOTE,
    metadataRaw: [], // Added optional field
    departments: [] // Added optional field
  };

  describe('processJob', () => {
    it('should process a basic GreenhouseJob correctly', async () => {
      // Arrange
      mockedJobUtils.isRemoteJob.mockReturnValue(true);
      mockedJobUtils.cleanHtml.mockReturnValue('Cleaned Description Requirements: Skill A');
      mockedJobUtils.extractSkills.mockReturnValue(['Skill A']);
      mockedJobUtils.detectJobType.mockReturnValue(JobType.FULL_TIME);
      mockedJobUtils.detectExperienceLevel.mockReturnValue(ExperienceLevel.MID);
      mockedJobUtils.parseSections.mockReturnValue({
          description: 'Parsed Basic Desc',
          requirements: 'Parsed Basic Req',
          responsibilities: 'Parsed Basic Resp',
          benefits: 'Parsed Basic Ben'
      });
      
      // Act
      const result = await processor.processJob(basicRawJob);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockedJobUtils.isRemoteJob).toHaveBeenCalledWith(basicRawJob.location.name, basicRawJob.content);
      expect(mockedJobUtils.cleanHtml).toHaveBeenCalledWith(basicRawJob.content);
      expect(mockedJobUtils.parseSections).toHaveBeenCalledWith('Cleaned Description Requirements: Skill A');
      expect(mockedJobUtils.extractSkills).toHaveBeenCalledWith('Cleaned Description Requirements: Skill A');
      expect(mockedJobUtils.detectJobType).toHaveBeenCalledWith('Cleaned Description Requirements: Skill A');
      expect(mockedJobUtils.detectExperienceLevel).toHaveBeenCalledWith('Cleaned Description Requirements: Skill A');
      
      const job = result.job as StandardizedJob;
      expect(job.sourceId).toBe(String(basicRawJob.id));
      expect(job.source).toBe('greenhouse');
      expect(job.title).toBe(basicRawJob.title);
      expect(job.description).toBe('Parsed Basic Desc');
      expect(job.requirements).toBe('Parsed Basic Req');
      expect(job.responsibilities).toBe('Parsed Basic Resp');
      expect(job.benefits).toBe('Parsed Basic Ben');
      expect(job.jobType).toBe(JobType.FULL_TIME); // From mock
      expect(job.experienceLevel).toBe(ExperienceLevel.MID); // From mock
      expect(job.skills).toEqual(['Skill A']); // From mock
      expect(job.tags).toEqual(['Skill A']); // Defaults to skills
      expect(job.location).toBe(basicRawJob.location.name);
      expect(job.country).toBe('Worldwide'); // Default
      expect(job.workplaceType).toBe('REMOTE'); // Default
      expect(job.applicationUrl).toBe(basicRawJob.absolute_url);
      expect(job.companyName).toBe(basicRawJob.company.name);
      expect(job.companyLogo).toBeNull();
    });

    it('should process an EnhancedGreenhouseJob correctly, using pre-processed fields', async () => {
        // Arrange (No specific mock setup needed as it should bypass most utils)
        
        // Act
        const result = await processor.processJob(enhancedRawJob);

        // Assert
        expect(result.success).toBe(true);
        expect(mockedJobUtils.isRemoteJob).not.toHaveBeenCalled(); // Should not be called for enhanced jobs
        expect(mockedJobUtils.cleanHtml).not.toHaveBeenCalled();
        expect(mockedJobUtils.parseSections).not.toHaveBeenCalled();
        expect(mockedJobUtils.extractSkills).not.toHaveBeenCalled();
        expect(mockedJobUtils.detectJobType).not.toHaveBeenCalled();
        expect(mockedJobUtils.detectExperienceLevel).not.toHaveBeenCalled();

        const job = result.job as StandardizedJob;
        expect(job.sourceId).toBe(String(enhancedRawJob.id));
        expect(job.title).toBe(enhancedRawJob.title);
        expect(job.description).toBe(enhancedRawJob.content); // Uses raw content as description
        expect(job.requirements).toBe(enhancedRawJob.requirements);
        expect(job.responsibilities).toBe(enhancedRawJob.responsibilities);
        expect(job.benefits).toBe(enhancedRawJob.benefits);
        expect(job.jobType).toBe(enhancedRawJob.jobType);
        expect(job.experienceLevel).toBe(enhancedRawJob.experienceLevel);
        expect(job.skills).toEqual(enhancedRawJob.skills);
        expect(job.tags).toEqual(enhancedRawJob.tags);
        expect(job.location).toBe(enhancedRawJob.location.name);
        expect(job.country).toBe(enhancedRawJob.country);
        expect(job.workplaceType).toBe(enhancedRawJob.workplaceType);
        expect(job.applicationUrl).toBe(enhancedRawJob.absolute_url);
        expect(job.companyName).toBe(enhancedRawJob.company.name);
        expect(job.companyLogo).toBe(enhancedRawJob.company.logo);
    });

    it('should return success: false if a basic job is not remote', async () => {
        // Arrange
        mockedJobUtils.isRemoteJob.mockReturnValue(false);

        // Act
        const result = await processor.processJob(basicRawJob);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe('Job is not remote or has location restrictions');
        expect(result.job).toBeUndefined();
        expect(mockedJobUtils.isRemoteJob).toHaveBeenCalledTimes(1);
        expect(mockedJobUtils.cleanHtml).not.toHaveBeenCalled(); // Should exit early
    });

    it('should handle errors during processing and return success: false', async () => {
        // Arrange
        const processingError = new Error('Utils failed');
        mockedJobUtils.isRemoteJob.mockReturnValue(true);
        mockedJobUtils.cleanHtml.mockImplementation(() => { throw processingError; }); // Make a util throw

        // Act
        const result = await processor.processJob(basicRawJob);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe(processingError.message);
        expect(result.job).toBeUndefined();
        expect(loggerMock.error).toHaveBeenCalledWith(
            expect.objectContaining({ error: processingError, jobId: basicRawJob.id }),
            'Error processing job in GreenhouseProcessor'
        );
    });
  });
}); 
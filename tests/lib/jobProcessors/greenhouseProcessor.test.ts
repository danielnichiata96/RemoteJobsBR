import { GreenhouseProcessor } from '../../../src/lib/jobProcessors/greenhouseProcessor';
import { GreenhouseJob, EnhancedGreenhouseJob, ProcessedJobResult } from '../../../src/lib/jobProcessors/types';
import * as jobUtils from '../../../src/lib/utils/jobUtils';
import { JobType, ExperienceLevel, WorkplaceType } from '@prisma/client';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { JobSource, JobSourceType } from '../../../src/lib/types';

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
  extractSkills: jest.fn().mockReturnValue(['Jest', 'Testing']),
  cleanHtml: jest.fn(),
  detectJobType: jest.fn().mockReturnValue(JobType.FULL_TIME),
  detectExperienceLevel: jest.fn().mockReturnValue(ExperienceLevel.MID_LEVEL),
  parseSections: jest.fn(),
  isRemoteJob: jest.fn(),
}));

// Mock logoUtils
jest.mock('../../../src/lib/utils/logoUtils', () => ({
    buildCompanyLogoUrl: jest.fn((website) => {
        // Simple mock: return specific URL for testing or based on input
        if (website === 'https://enhanced.corp') {
            // Mimic the observed output for the enhanced test case
            return 'https://img.logo.dev/enhanced.corp?token=pk_f4m8WG-wQOeM90skJ8dV6Q';
        }
        return undefined; // Default to undefined if no match
    }),
}));

// --- Test Suite ---

const createMockJobSource = (overrides: Partial<JobSource> = {}): JobSource => ({
  id: 1,
  name: 'Test Greenhouse Source',
  description: 'Mock source',
  url: 'https://boards.greenhouse.io/testboard',
  type: JobSourceType.GREENHOUSE,
  config: { boardToken: 'testboard' },
  companyWebsite: 'https://basic.example.com', // Default website
  isActive: true,
  lastFetched: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

describe('GreenhouseProcessor', () => {
  let processor: GreenhouseProcessor;
  let mockPrisma: PrismaClient;
  let mockBuildCompanyLogoUrl: jest.Mock;
  let loggerMock: any;

  // Cast the mock module to the correct type to access mocked functions
  const mockedJobUtils = jobUtils as jest.Mocked<typeof jobUtils>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
    processor = new GreenhouseProcessor(mockPrisma);
    loggerMock = pino();
    // Get reference to the mocked function
    mockBuildCompanyLogoUrl = require('../../../src/lib/utils/logoUtils').buildCompanyLogoUrl;

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
    title: 'Basic Engineer',
    updated_at: new Date().toISOString(),
    location: { name: 'Remote' },
    content: '<p>Basic job content</p>',
    absolute_url: 'https://jobs.greenhouse.io/basic/123',
    metadata: [],
    offices: [],
    departments: [{ name: 'Engineering' }],
    company: { name: 'Basic Corp' }, // Add company info
    // _determinedHiringRegionType might be undefined for basic jobs
  };

  const mockSourceDataBasic = createMockJobSource({ name: 'Basic Corp', companyWebsite: 'https://basic.example.com'});

  describe('processJob', () => {
    it('should process a basic GreenhouseJob correctly', async () => {
      const result = await processor.processJob(basicRawJob, mockSourceDataBasic, mockLogger);

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      const job = result.job!;

      expect(job.source).toBe('greenhouse');
      expect(job.sourceId).toBe('123');
      expect(job.title).toBe('Basic Engineer');
      expect(job.description).toBe('<p>Basic job content</p>');
      expect(job.applicationUrl).toBe(basicRawJob.absolute_url);
      // Use company name from raw job if available, fallback to source name
      expect(job.companyName).toBe(basicRawJob.company.name);
      // Check that logo util was called with the correct website
      expect(mockBuildCompanyLogoUrl).toHaveBeenCalledWith(mockSourceDataBasic.companyWebsite);
      // Update assertion: Expect undefined if util returns undefined for this website
      expect(job.companyLogo).toBeUndefined(); 
      expect(job.companyWebsite).toBe(mockSourceDataBasic.companyWebsite);
       expect(job.publishedAt).toBeUndefined(); // Not present in basic job
       expect(job.jobType).toBe(JobType.FULL_TIME);
       expect(job.experienceLevel).toBe(ExperienceLevel.MID_LEVEL);
       expect(job.jobType2).toBeUndefined(); // Not present in basic job
       expect(job.workplaceType).toBe(WorkplaceType.REMOTE); // Default assumption
       expect(job.skills).toEqual(['Jest', 'Testing']);
       expect(job.location).toBe('Remote');
    });

    it('should process an EnhancedGreenhouseJob correctly, using pre-processed fields', async () => {
       const enhancedRawJob: GreenhouseJob & { _determinedHiringRegionType?: 'global' | 'latam' } = {
          ...basicRawJob,
          id: 456,
          title: 'Enhanced Engineer',
          absolute_url: 'https://jobs.greenhouse.io/enhanced/456',
          _determinedHiringRegionType: 'latam', // Field added by Fetcher
          company: { name: 'Enhanced Corp' },
      };
      // Create source data with a website that matches the mock logo util
       const mockSourceDataEnhanced = createMockJobSource({ name: 'Enhanced Corp', companyWebsite: 'https://enhanced.corp' }); 

      const result = await processor.processJob(enhancedRawJob, mockSourceDataEnhanced, mockLogger);

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      const job = result.job!;

      expect(job.sourceId).toBe('456');
      expect(job.title).toBe('Enhanced Engineer');
      expect(job.applicationUrl).toBe(enhancedRawJob.absolute_url);
      expect(job.companyName).toBe(enhancedRawJob.company.name);
      expect(job.companyWebsite).toBe(mockSourceDataEnhanced.companyWebsite);
       // Check logo util call and updated assertion
       expect(mockBuildCompanyLogoUrl).toHaveBeenCalledWith(mockSourceDataEnhanced.companyWebsite);
       expect(job.companyLogo).toBe('https://img.logo.dev/enhanced.corp?token=pk_f4m8WG-wQOeM90skJ8dV6Q'); // Use the observed URL
      expect(job.jobType2).toBe('latam');
       expect(job.workplaceType).toBe(WorkplaceType.REMOTE); // Still remote based on location
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
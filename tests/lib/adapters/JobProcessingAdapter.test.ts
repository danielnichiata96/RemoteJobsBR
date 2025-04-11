import { JobProcessingAdapter } from '../../../src/lib/adapters/JobProcessingAdapter';
import { JobProcessingService } from '../../../src/lib/services/jobProcessingService';
import { StandardizedJob } from '../../../src/types/StandardizedJob'; // Assuming this path
import { JobType, ExperienceLevel, WorkplaceType } from '@prisma/client';
import pino from 'pino';

// --- Mocks ---

// Mock Pino logger (already mocked in other files, but good practice here too)
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
  PrismaClient: jest.fn(() => ({ // Mock the PrismaClient constructor if needed
    // ... mock client methods if adapter used them directly (unlikely)
  })),
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
  // Add other enums if needed (e.g., JobStatus, UserRole)
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

// Mock JobProcessingService
const mockJobProcessingServiceInstance = {
  processAndSaveJob: jest.fn(),
  // Add other methods if the adapter uses them
};
jest.mock('../../../src/lib/services/jobProcessingService', () => {
  return {
    JobProcessingService: jest.fn(() => mockJobProcessingServiceInstance),
  };
});

// --- Test Suite ---

describe('JobProcessingAdapter', () => {
  let adapter: JobProcessingAdapter;
  let loggerMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new JobProcessingAdapter();
    loggerMock = pino(); // Get reference to the mocked logger instance
  });

  describe('processAndSaveJob', () => {
    // Define test data inside the describe block
    const mockStandardizedJob: StandardizedJob = {
      source: 'testSource',
      sourceId: 'job-123',
      title: 'Adapter Test Job',
      description: 'Description content.',
      requirements: 'Requirements content.',
      responsibilities: 'Responsibilities content.',
      companyName: 'Adapter Test Co',
      applicationUrl: 'http://apply.test.com',
      jobType: JobType.FULL_TIME,
      experienceLevel: ExperienceLevel.SENIOR,
      location: 'Remote - Global',
      country: 'Global',
      workplaceType: WorkplaceType.REMOTE,
      publishedAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-16T12:00:00Z'),
      skills: ['TypeScript', 'Testing'],
      companyLogo: 'http://logo.test.com/logo.png',
      companyWebsite: 'http://website.test.com',
      minSalary: 60000,
      maxSalary: 80000,
      currency: 'USD',
      salaryCycle: 'YEARLY',
      tags: ['urgent', 'tech'],
      metadataRaw: [{ name: 'department', value: 'Engineering' }],
      // benefits is optional in StandardizedJob definition used here, add if needed
    };

    it('should successfully adapt and call JobProcessingService.processAndSaveJob', async () => {
      // Arrange
      mockJobProcessingServiceInstance.processAndSaveJob.mockResolvedValue(true);

      // Act
      const result = await adapter.processAndSaveJob(mockStandardizedJob);

      // Assert
      expect(result).toBe(true);
      expect(mockJobProcessingServiceInstance.processAndSaveJob).toHaveBeenCalledTimes(1);
      
      // Check the arguments passed to the service
      const [sourceArg, rawJobArg] = mockJobProcessingServiceInstance.processAndSaveJob.mock.calls[0];
      expect(sourceArg).toBe(mockStandardizedJob.source);
      
      // Verify key transformations in rawJobArg
      expect(rawJobArg.id).toBe(NaN); // parseInt('job-123') is NaN, as expected
      expect(rawJobArg.title).toBe(mockStandardizedJob.title);
      expect(rawJobArg.location.name).toBe(mockStandardizedJob.location);
      expect(rawJobArg.content).toBe(mockStandardizedJob.description);
      expect(rawJobArg.absolute_url).toBe(mockStandardizedJob.applicationUrl);
      expect(rawJobArg.company.name).toBe(mockStandardizedJob.companyName);
      expect(rawJobArg.requirements).toBe(mockStandardizedJob.requirements);
      expect(rawJobArg.responsibilities).toBe(mockStandardizedJob.responsibilities);
      expect(rawJobArg.jobType).toBe(mockStandardizedJob.jobType);
      expect(rawJobArg.experienceLevel).toBe(mockStandardizedJob.experienceLevel);
      expect(rawJobArg.skills).toEqual(mockStandardizedJob.skills);
      expect(rawJobArg.metadata).toEqual(mockStandardizedJob.metadataRaw);

      expect(loggerMock.debug).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: mockStandardizedJob.sourceId }),
        'Processing standardized job'
      );
       expect(loggerMock.debug).toHaveBeenCalledWith(
        'Calling JobProcessingService with adapted job data'
      );
    });
    
     it('should handle numeric sourceId correctly', async () => {
      // Arrange
      const numericSourceIdJob = { ...mockStandardizedJob, sourceId: '456' };
      mockJobProcessingServiceInstance.processAndSaveJob.mockResolvedValue(true);

      // Act
      await adapter.processAndSaveJob(numericSourceIdJob);

      // Assert
       const [, rawJobArg] = mockJobProcessingServiceInstance.processAndSaveJob.mock.calls[0];
       expect(rawJobArg.id).toBe(456);
    });

    it('should return false and log error if source is missing', async () => {
      // Arrange
      const jobWithoutSource = { ...mockStandardizedJob, source: undefined as any };

      // Act
      const result = await adapter.processAndSaveJob(jobWithoutSource);

      // Assert
      expect(result).toBe(false);
      expect(mockJobProcessingServiceInstance.processAndSaveJob).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledWith('Job missing required source or sourceId');
    });

    it('should return false and log error if sourceId is missing', async () => {
      // Arrange
      const jobWithoutSourceId = { ...mockStandardizedJob, sourceId: undefined as any };

      // Act
      const result = await adapter.processAndSaveJob(jobWithoutSourceId);

      // Assert
      expect(result).toBe(false);
      expect(mockJobProcessingServiceInstance.processAndSaveJob).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledWith('Job missing required source or sourceId');
    });

    it('should return false and log error if JobProcessingService throws an error', async () => {
      // Arrange
      const serviceError = new Error('Service failed to save');
      mockJobProcessingServiceInstance.processAndSaveJob.mockRejectedValue(serviceError);

      // Act
      const result = await adapter.processAndSaveJob(mockStandardizedJob);

      // Assert
      expect(result).toBe(false);
      expect(mockJobProcessingServiceInstance.processAndSaveJob).toHaveBeenCalledTimes(1);
      // The adapter catches the error and logs it
      expect(loggerMock.error).toHaveBeenCalledWith(
           { error: serviceError },
           'Error in JobProcessingAdapter'
       );
    });
  });
}); 
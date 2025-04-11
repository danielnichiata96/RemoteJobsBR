import { JobProcessingService } from '../../../src/lib/services/jobProcessingService';
import { GreenhouseProcessor } from '../../../src/lib/jobProcessors/greenhouseProcessor';
import { prisma } from '../../../src/lib/prisma'; // We'll mock this client
import pino from 'pino';
import { StandardizedJob } from '../../../src/lib/jobProcessors/types';
import { UserRole, JobStatus, JobType, ExperienceLevel } from '@prisma/client';

// --- Mocks ---

// Mock Pino logger
jest.mock('pino', () => {
  const mockLog = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockImplementation(() => mockLog),
  };
  return jest.fn(() => mockLog);
});

// --- Prisma Mock Setup ---
// 1. Declare a variable to hold the mock instance
let mockPrisma: any;

// 2. Mock the module that exports the prisma instance
jest.mock('../../../src/lib/prisma', () => {
  // Create the mock structure within the factory
  const mockInstance = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    job: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  return {
    __esModule: true,
    prisma: mockInstance, // Export the created mock instance
  };
});

// We still need to mock enums if they are imported directly from @prisma/client
// in the service file, although it's better if the service uses the prisma instance.
// Let's keep this part just in case, but ideally it wouldn't be needed if
// the service only relies on the prisma instance.
jest.mock('@prisma/client', () => {
  const originalModule = jest.requireActual('@prisma/client');
  return {
    __esModule: true,
    ...originalModule, // Keep original stuff like Prisma types
    // Mock only the constructor if absolutely needed elsewhere, but keep enums real
    PrismaClient: jest.fn(), // Keep a basic mock for constructor if needed
    // Use actual enums from the original module
    UserRole: originalModule.UserRole,
    JobStatus: originalModule.JobStatus,
    JobType: originalModule.JobType,
    ExperienceLevel: originalModule.ExperienceLevel,
    // WorkplaceType: originalModule.WorkplaceType, // Add if needed
  };
});

// Mock GreenhouseProcessor
const mockGreenhouseProcessor = {
  processJob: jest.fn(),
};
jest.mock('../../../src/lib/jobProcessors/greenhouseProcessor', () => ({
  GreenhouseProcessor: jest.fn(() => mockGreenhouseProcessor),
}));


// --- Test Suite ---

describe('JobProcessingService', () => {
  // Re-require enums because the module is fully mocked
  const { UserRole, JobStatus, JobType, ExperienceLevel } = require('@prisma/client');
  let jobProcessingService: JobProcessingService;
  let loggerMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 3. Assign the *actual mocked instance* (created by Jest) to our variable
    // This ensures the variable used in tests refers to the same object used by the service
    mockPrisma = require('../../../src/lib/prisma').prisma; 
    
    jobProcessingService = new JobProcessingService();
    loggerMock = require('pino')();
  });

  // --- saveOrUpdateJob Tests (Replaced processAndSaveJob tests) ---
  describe('saveOrUpdateJob', () => {
    const source = 'greenhouse'; // Example source
    const mockCompany = { 
      id: 'comp-1', 
      name: 'Test Company Inc.', 
      role: UserRole.COMPANY, 
      email: 'comp-1@example.com' 
    };
    const mockStandardizedJob: StandardizedJob = {
      source: source,
      sourceId: 'std123',
      title: 'Standardized Job Title',
      description: 'Job Description',
      companyName: 'Test Company Inc.',
      applicationUrl: 'http://apply.example.com',
      requirements: 'Some requirements',
      responsibilities: 'Some responsibilities',
      jobType: JobType.FULL_TIME,
      experienceLevel: ExperienceLevel.MID,
      location: 'Remote',
      country: 'USA',
      workplaceType: 'REMOTE',
      publishedAt: new Date(),
      skills: ['React', 'Node'],
      status: JobStatus.ACTIVE,
      // Add other fields as necessary for testing
    };
    const mockUpsertResult = { 
      id: 'job-db-id-1', 
      ...mockStandardizedJob, // Use spread carefully, ensure types match DB model
      companyId: mockCompany.id, 
      // other DB fields...
      createdAt: new Date(), 
      updatedAt: new Date() 
    };

    it('should save a job successfully when company exists', async () => {
      // Arrange: Mock existing company, job upsert success
      mockPrisma.user.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.job.upsert.mockResolvedValue(mockUpsertResult);

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { name: mockStandardizedJob.companyName.trim(), role: UserRole.COMPANY },
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.job.upsert).toHaveBeenCalledTimes(1);
      // Check the data passed to upsert matches mockStandardizedJob structure (+ companyId)
      expect(mockPrisma.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
          where: { source_sourceId: { source: source, sourceId: 'std123' } },
          create: expect.objectContaining({ title: 'Standardized Job Title', companyId: mockCompany.id }),
          update: expect.objectContaining({ title: 'Standardized Job Title', companyId: mockCompany.id }),
      }));
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: mockUpsertResult.id }),
        'Job processed and saved/updated successfully.'
      );
    });

    it('should save a job successfully, creating a new company', async () => {
      // Arrange: Company NOT found, company create success, job upsert success
      mockPrisma.user.findFirst.mockResolvedValue(null); // Uses correctly assigned mockPrisma
      mockPrisma.user.create.mockResolvedValue(mockCompany);
      mockPrisma.job.upsert.mockResolvedValue(mockUpsertResult);

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      // Check placeholder email logic if important
      expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({ 
              email: `testcompanyinc_${source}@jobsource.example.com`, // Check generated email
              name: mockStandardizedJob.companyName.trim(),
              role: UserRole.COMPANY
          }),
      }));
      expect(mockPrisma.job.upsert).toHaveBeenCalledTimes(1);
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: mockCompany.id }), 
        'Company created successfully.'
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: mockUpsertResult.id }),
        'Job processed and saved/updated successfully.'
      );
    });
    
    it('should return false and log error if job data is missing required fields', async () => {
        const incompleteJob = { ...mockStandardizedJob, title: null } as any; // Missing title
        const result = await jobProcessingService.saveOrUpdateJob(incompleteJob);
        expect(result).toBe(false);
        expect(mockPrisma.job.upsert).not.toHaveBeenCalled();
        expect(loggerMock.error).toHaveBeenCalledWith(
            expect.objectContaining({ jobData: incompleteJob }),
            expect.stringContaining('Job data is missing required fields')
        );
    });

    it('should return false and log error if saving job fails (db error)', async () => {
        // Arrange: Existing company, job upsert FAILURE
        const dbError = new Error('Database connection failed');
        mockPrisma.user.findFirst.mockResolvedValue(mockCompany); 
        mockPrisma.job.upsert.mockRejectedValue(dbError);

        // Act
        const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

        // Assert
        expect(result).toBe(false);
        expect(mockPrisma.job.upsert).toHaveBeenCalledTimes(1);
        expect(loggerMock.error).toHaveBeenCalledWith(
           expect.objectContaining({ source: mockStandardizedJob.source, sourceId: mockStandardizedJob.sourceId, error: dbError }), 
           'Error processing job in service'
        );
    });

     it('should return false and log error if creating company fails and company still not found', async () => {
        // Arrange: Company not found, create fails, findFirst fails again
        const createError = new Error('Unique constraint violation');
        mockPrisma.user.findFirst
            .mockResolvedValueOnce(null)   // First call: not found
            .mockResolvedValueOnce(null);  // Second call after create fails: still not found
        mockPrisma.user.create.mockRejectedValue(createError);

        // Act
        const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

        // Assert
        expect(result).toBe(false);
        expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(2);
        expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.job.upsert).not.toHaveBeenCalled();
        expect(loggerMock.error).toHaveBeenCalledWith(
            expect.objectContaining({ companyName: mockStandardizedJob.companyName.trim(), error: createError }),
            'Failed to create company.' // Check first error log
        );
         expect(loggerMock.error).toHaveBeenCalledWith(
            expect.objectContaining({ companyName: mockStandardizedJob.companyName.trim() }),
            'Still could not find or create company after error. Skipping job.' // Check second error log
        );
    });

  });

  // --- deactivateJobs Tests (Keep as is, but ensure mockPrisma is used) ---
  describe('deactivateJobs', () => {
    const source = 'greenhouse';
    const activeSourceIds = new Set(['id1', 'id2']);
    const mockUpdateResult = { count: 5 }; // Example: 5 jobs deactivated

    it('should call updateMany with correct parameters and return count on success', async () => {
      // Arrange
      mockPrisma.job.updateMany.mockResolvedValue(mockUpdateResult);

      // Act
      const result = await jobProcessingService.deactivateJobs(source, activeSourceIds);

      // Assert
      expect(result).toBe(mockUpdateResult.count);
      expect(mockPrisma.job.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
        where: {
          source: source,
          status: JobStatus.ACTIVE,
          sourceId: {
            notIn: Array.from(activeSourceIds),
          },
        },
        data: {
          status: JobStatus.CLOSED,
        },
      });
      expect(loggerMock.info).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedCount: 5 }),
          expect.stringContaining('Deactivation process completed')
      );
    });

    it('should return 0 and log error if updateMany fails', async () => {
        const source = 'lever';
        const activeSourceIds = new Set(['idA']);
        const dbError = new Error('DB update failed');
        // Arrange
        mockPrisma.job.updateMany.mockRejectedValue(dbError);
 
        // Act
        const result = await jobProcessingService.deactivateJobs(source, activeSourceIds);
 
        // Assert
        expect(result).toBe(0);
        expect(mockPrisma.job.updateMany).toHaveBeenCalledTimes(1);
        expect(loggerMock.error).toHaveBeenCalledWith(
             { source, error: dbError }, 
             'Error during job deactivation'
        );
    });
  });
}); 
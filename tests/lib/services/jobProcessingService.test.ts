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
  };
  return jest.fn(() => mockLog);
});

// Mock Prisma client - Mock the CONSTRUCTOR
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(), // If needed for company updates
  },
  job: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  // Add $disconnect if service calls it, though unlikely here
  $disconnect: jest.fn(), 
};
jest.mock('@prisma/client', () => ({
  // Mock the default export (PrismaClient constructor)
  PrismaClient: jest.fn(() => mockPrisma),
  // Also mock named exports if needed (like enums)
  UserRole: { COMPANY: 'COMPANY', CANDIDATE: 'CANDIDATE', RECRUITER: 'RECRUITER', ADMIN: 'ADMIN' },
  JobStatus: { ACTIVE: 'ACTIVE', CLOSED: 'CLOSED', DRAFT: 'DRAFT' },
  JobType: { FULL_TIME: 'FULL_TIME', PART_TIME: 'PART_TIME', CONTRACT: 'CONTRACT', INTERNSHIP: 'INTERNSHIP', FREELANCE: 'FREELANCE' },
  ExperienceLevel: { ENTRY: 'ENTRY', MID: 'MID', SENIOR: 'SENIOR', LEAD: 'LEAD' },
  WorkplaceType: { REMOTE: 'REMOTE', HYBRID: 'HYBRID', ON_SITE: 'ON_SITE' },
}));

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
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Re-initialize service before each test to ensure clean state
    jobProcessingService = new JobProcessingService();
    
    // Get reference to the mocked logger instance created by the service constructor
    loggerMock = pino(); 
  });

  // --- processAndSaveJob Tests ---
  describe('processAndSaveJob', () => {
    const source = 'greenhouse';
    const rawJob = { id: 'raw123', title: 'Raw Job' };
    const mockCompany = { 
      id: 'comp-1', 
      name: 'Test Company Inc.', 
      role: UserRole.COMPANY, 
      email: 'comp-1@example.com' 
      /* other fields */ 
    };
    const mockStandardizedJob: StandardizedJob = {
      source: source,
      sourceId: 'std123',
      title: 'Standardized Job Title',
      description: 'Job Description',
      companyName: 'Test Company Inc.',
      applicationUrl: 'http://apply.example.com',
      // Add other necessary fields with default/test values
      requirements: 'Some requirements',
      responsibilities: 'Some responsibilities',
      jobType: JobType.FULL_TIME,
      experienceLevel: ExperienceLevel.MID,
      location: 'Remote',
      country: 'USA',
      workplaceType: 'REMOTE',
      publishedAt: new Date(),
      skills: ['React', 'Node'],
    };
    const mockUpsertResult = { 
      id: 'job-1', 
      ...mockStandardizedJob, 
      companyId: mockCompany.id, 
      status: JobStatus.ACTIVE,
      clickCount: 0, 
      createdAt: new Date(), 
      updatedAt: new Date() 
    };

    it('should process and save a job successfully when company exists', async () => {
      // Arrange: Mock processor success, existing company, job upsert success
      mockGreenhouseProcessor.processJob.mockResolvedValue({ success: true, job: mockStandardizedJob });
      mockPrisma.user.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.job.upsert.mockResolvedValue(mockUpsertResult);

      // Act
      const result = await jobProcessingService.processAndSaveJob(source, rawJob);

      // Assert
      expect(result).toBe(true);
      expect(mockGreenhouseProcessor.processJob).toHaveBeenCalledWith(rawJob);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { name: mockStandardizedJob.companyName.trim(), role: UserRole.COMPANY },
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.job.upsert).toHaveBeenCalledTimes(1);
      // Add detailed assertion for upsert arguments if needed
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: mockUpsertResult.id }),
        'Job processed and saved/updated successfully.'
      );
    });

    it('should process and save a job successfully, creating a new company', async () => {
      // Arrange: Mock processor success, company NOT found, company create success, job upsert success
      mockGreenhouseProcessor.processJob.mockResolvedValue({ success: true, job: mockStandardizedJob });
      mockPrisma.user.findFirst.mockResolvedValue(null); // Company not found initially
      mockPrisma.user.create.mockResolvedValue(mockCompany); // Mock successful creation
      mockPrisma.job.upsert.mockResolvedValue(mockUpsertResult);

      // Act
      const result = await jobProcessingService.processAndSaveJob(source, rawJob);

      // Assert
      expect(result).toBe(true);
      expect(mockGreenhouseProcessor.processJob).toHaveBeenCalledWith(rawJob);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(1); // Only the first check
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      // Add detailed assertion for create arguments (placeholder email etc.)
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
    
    it('should return false and log warning if processor fails', async () => {
       // Arrange: Mock processor failure
       mockGreenhouseProcessor.processJob.mockResolvedValue({ success: false, error: 'Processing failed' });

       // Act
       const result = await jobProcessingService.processAndSaveJob(source, rawJob);

       // Assert
       expect(result).toBe(false);
       expect(mockGreenhouseProcessor.processJob).toHaveBeenCalledWith(rawJob);
       expect(mockPrisma.job.upsert).not.toHaveBeenCalled();
       expect(loggerMock.warn).toHaveBeenCalledWith(
          { source, error: 'Processing failed' }, 
          'Failed to process job'
       );
    });

    it('should throw error if processor source is invalid', async () => {
        // Arrange
        const invalidSource = 'unknown';

        // Act & Assert
        await expect(jobProcessingService.processAndSaveJob(invalidSource, rawJob))
              .rejects.toThrow(`No processor found for source: ${invalidSource}`);
        expect(mockGreenhouseProcessor.processJob).not.toHaveBeenCalled();
    });
    
    it('should return false and log error if saving job fails (db error)', async () => {
        // Arrange: Mock processor success, existing company, job upsert FAILURE
        const dbError = new Error('Database connection failed');
        mockGreenhouseProcessor.processJob.mockResolvedValue({ success: true, job: mockStandardizedJob });
        // Ensure the mockPrisma instance (which the service now uses) is configured
        mockPrisma.user.findFirst.mockResolvedValue(mockCompany); 
        mockPrisma.job.upsert.mockRejectedValue(dbError);

        // Act
        const result = await jobProcessingService.processAndSaveJob(source, rawJob);

        // Assert
        expect(result).toBe(false);
        expect(mockPrisma.job.upsert).toHaveBeenCalledTimes(1);
        // Check the error logged *inside* saveJob's catch block
        expect(loggerMock.error).toHaveBeenCalledWith(
           expect.objectContaining({ source: mockStandardizedJob.source, sourceId: mockStandardizedJob.sourceId, error: dbError }), 
           'Error processing job in service' // Updated expected message
        );
    });

     it('should return false and log error if creating company fails and company still not found', async () => {
        // Arrange: Processor success, company not found, create fails, findFirst fails again
        const createError = new Error('Unique constraint violation');
        mockGreenhouseProcessor.processJob.mockResolvedValue({ success: true, job: mockStandardizedJob });
        // Ensure the mockPrisma instance is configured for both calls
        mockPrisma.user.findFirst
            .mockResolvedValueOnce(null)   // First call: not found
            .mockResolvedValueOnce(null);  // Second call after create fails: still not found
        mockPrisma.user.create.mockRejectedValue(createError);

        // Act
        const result = await jobProcessingService.processAndSaveJob(source, rawJob);

        // Assert
        expect(result).toBe(false);
        expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(2);
        expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.job.upsert).not.toHaveBeenCalled();
        // Check the specific logs from saveJob's error path
        expect(loggerMock.error).toHaveBeenCalledWith(
            expect.objectContaining({ companyName: mockStandardizedJob.companyName.trim(), error: createError }),
            'Failed to create company.'
        );
         expect(loggerMock.error).toHaveBeenCalledWith(
            'Still could not find or create company. Skipping job.'
        );
    });

  });

  // --- deactivateJobs Tests ---
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
          { source, deactivatedCount: mockUpdateResult.count },
          'Deactivation process completed.'
      );
    });

    it('should return 0 and log error if updateMany fails', async () => {
        // Arrange
        const dbError = new Error('DB update failed');
        // Ensure the mockPrisma instance is configured
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
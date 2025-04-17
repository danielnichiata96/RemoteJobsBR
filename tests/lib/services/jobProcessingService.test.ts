import { JobProcessingService } from '../../../src/lib/services/jobProcessingService';
// Removed GreenhouseProcessor import as it wasn't used directly in these tests
// Keep pino mock
// import pino from 'pino'; // Comment out import if removing mock
import pino from 'pino'; // Restore import
import { StandardizedJob } from '../../../src/types/StandardizedJob';
import { PrismaClient } from '@prisma/client'; // Import the actual type

// --- Mocks ---

// Mock Pino logger (keep as is)
jest.mock('pino', () => {
  const mockLog = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn().mockImplementation(() => mockLog),
  };
  return jest.fn(() => mockLog);
});

// Mock @prisma/client (keep as is for enums)
jest.mock('@prisma/client', () => ({
  __esModule: true,
  UserRole: { COMPANY: 'COMPANY', CANDIDATE: 'CANDIDATE' },
  JobStatus: { ACTIVE: 'ACTIVE', CLOSED: 'CLOSED', DRAFT: 'DRAFT' },
  JobType: { FULL_TIME: 'FULL_TIME', PART_TIME: 'PART_TIME', CONTRACT: 'CONTRACT' },
  ExperienceLevel: { ENTRY: 'ENTRY', MID: 'MID', SENIOR: 'SENIOR' },
  HiringRegion: { WORLDWIDE: 'WORLDWIDE', LATAM: 'LATAM', USA: 'USA' },
  PrismaClient: jest.fn(), // Keep this mock for the type system if needed, but we create our own object
}));

// Import enums normally
import { UserRole, JobStatus, JobType, ExperienceLevel, HiringRegion } from '@prisma/client';

// Mock setTimeout globally for timer control
// jest.useFakeTimers();

// --- Test Suite ---

describe('JobProcessingService', () => {
  // Create a manual mock Prisma client object
  let mockPrismaClient: {
    user: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    job: {
      findFirst: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
      updateMany: jest.Mock;
    };
    $disconnect: jest.Mock; // Include if used/needed
  };
  let jobProcessingService: JobProcessingService;
  // let loggerMock: any; // Comment out logger mock variable
  let loggerMock: any; // Restore logger mock variable

  beforeEach(() => {
    // Initialize the manual mock client structure with jest.fn()
    mockPrismaClient = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      job: {
        findFirst: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      $disconnect: jest.fn(),
    };

    // Reset mocks on the manual object
    jest.clearAllMocks(); // Still good practice for other potential mocks (like pino)
    mockPrismaClient.user.findFirst.mockReset();
    mockPrismaClient.user.create.mockReset();
    mockPrismaClient.user.update.mockReset();
    mockPrismaClient.job.findFirst.mockReset();
    mockPrismaClient.job.update.mockReset();
    mockPrismaClient.job.upsert.mockReset();
    mockPrismaClient.job.updateMany.mockReset();
    mockPrismaClient.$disconnect.mockReset();

    // Instantiate the service, injecting the manual mock client
    jobProcessingService = new JobProcessingService(mockPrismaClient as any);
    loggerMock = require('pino')(); // Restore getting logger mock instance
  });

  // --- deactivateJobs Tests ---
  describe('deactivateJobs', () => {
    const source = 'greenhouse';
    const activeSourceIds = new Set(['id1', 'id2']);
    const mockUpdateResult = { count: 5 };

    it('should call updateMany with correct parameters and return count on success', async () => {
      // Arrange: Use the injected mock client
      mockPrismaClient.job.updateMany.mockResolvedValue(mockUpdateResult);

      // Act
      const result = await jobProcessingService.deactivateJobs(source, activeSourceIds);

      // Assert: Use the injected mock client
      expect(result).toBe(mockUpdateResult.count);
      expect(mockPrismaClient.job.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.job.updateMany).toHaveBeenCalledWith({
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
      // Add back logger assertion
      expect(loggerMock.info).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedCount: 5 }),
          expect.stringContaining('Deactivation process completed')
      );
    });

    it('should return 0 and log error if updateMany fails', async () => {
        const source = 'lever';
        const activeSourceIds = new Set(['idA']);
        const dbError = new Error('DB update failed');
        // Arrange: Use the injected mock client
        mockPrismaClient.job.updateMany.mockRejectedValue(dbError);
 
        // Act
        const result = await jobProcessingService.deactivateJobs(source, activeSourceIds);
 
        // Assert: Use the injected mock client
        expect(result).toBe(0);
        expect(mockPrismaClient.job.updateMany).toHaveBeenCalledTimes(1);
        // Add back logger assertion
        expect(loggerMock.error).toHaveBeenCalledWith(
             { source, error: dbError }, 
             'Error during job deactivation'
        );
    });
  });

  // --- saveOrUpdateJob Tests ---
  describe('saveOrUpdateJob', () => {
    let mockStandardizedJob: StandardizedJob;

    beforeEach(() => {
      // Reset mockStandardizedJob for each test
      mockStandardizedJob = {
        title: 'Software Engineer',
        description: 'Job description',
        requirements: 'TypeScript, Node.js experience',
        responsibilities: 'Building web applications',
        benefits: 'Flexible hours, health insurance',
        applicationUrl: 'https://example.com/apply',
        companyName: 'Example Company',
        companyLogo: 'https://example.com/logo.png',
        companyWebsite: 'https://example.com',
        location: 'Remote',
        country: 'Worldwide',
        sourceId: '12345',
        source: 'greenhouse',
        jobType: JobType.FULL_TIME,
        jobType2: 'global', // JobType2 is source-specific format
        experienceLevel: ExperienceLevel.MID,
        workplaceType: 'REMOTE',
        minSalary: 50000,
        maxSalary: 100000,
        currency: 'USD',
        salaryCycle: 'YEARLY',
        skills: ['TypeScript', 'Node.js', 'React']
      };

      // Setup default mocks on the injected client
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'company-1', // Use string ID
        name: 'Example Company',
        normalizedCompanyName: 'example company', // Added normalized field
        logo: 'https://example.com/existing-logo.png', // Add existing logo
        role: UserRole.COMPANY
      });
      
      mockPrismaClient.job.upsert.mockResolvedValue({
        id: 'job-123', // Use string ID
        title: 'Software Engineer',
        normalizedTitle: 'software engineer', // Added normalized field
        companyId: 'company-1'
        // Add other required fields if validation gets stricter
      });

      // Default behavior for duplicate check: no duplicate found
      mockPrismaClient.job.findFirst.mockResolvedValue(null);
      // Default behavior for update (used in duplicate case)
      mockPrismaClient.job.update.mockResolvedValue({});
      // Default behavior for user update
      mockPrismaClient.user.update.mockResolvedValue({});
    });

    it('should save job successfully when company exists and HAS logo/normalized name', async () => {
      // Arrange: Mock company found with existing logo and name
      mockPrismaClient.user.findFirst.mockResolvedValue({ 
        id: 'company-1',
        name: 'Example Company',
        normalizedCompanyName: 'example company',
        logo: 'https://example.com/existing-logo.png',
        role: UserRole.COMPANY
      });
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-123' });

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(1);
      // Expect NO update calls since logo and name are present
      expect(mockPrismaClient.user.update).not.toHaveBeenCalled(); 
      expect(mockPrismaClient.job.findFirst).toHaveBeenCalled();
      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
    });

    it('should create company successfully if company does not exist', async () => {
      // Arrange
      mockPrismaClient.user.findFirst.mockResolvedValue(null); // Company not found
      mockPrismaClient.user.create.mockResolvedValue({ // Mock company creation
        id: 'company-2',
        name: 'Example Company',
        normalizedCompanyName: 'example company',
        logo: 'https://example.com/logo.png', // Ensure created mock has logo for consistency
        role: UserRole.COMPANY // Added role
      });
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job after company creation
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-new', companyId: 'company-2' });

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.user.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.user.update).not.toHaveBeenCalled();
      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
      // Verify create data
      const createArgs = mockPrismaClient.user.create.mock.calls[0][0];
      expect(createArgs.data.name).toBe('Example Company');
      expect(createArgs.data.normalizedCompanyName).toBe('example company');
      expect(createArgs.data.logo).toBe('https://example.com/logo.png');
    });

    it('should detect duplicate job and update timestamp instead of saving', async () => {
      // Arrange: Mock findFirst to return an existing job
      const existingDuplicateJob = { id: 'existing-job-id', title: 'Duplicate Job', updatedAt: new Date() };
      mockPrismaClient.user.findFirst.mockResolvedValue({ 
         id: 'company-dupe', 
         name: 'Example Company', 
         normalizedCompanyName: 'example company',
         role: UserRole.COMPANY
     });
      mockPrismaClient.job.findFirst.mockResolvedValue(existingDuplicateJob);
      mockPrismaClient.job.update.mockResolvedValue({}); // Mock the timestamp update

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(result).toBe(false);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.job.findFirst).toHaveBeenCalledTimes(1);
      expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ existingJobId: existingDuplicateJob.id }), expect.stringContaining('Duplicate job detected'));
      // Verify timestamp update call
      expect(mockPrismaClient.job.update).toHaveBeenCalledWith({
          where: { id: existingDuplicateJob.id },
          data: { updatedAt: expect.any(Date) }
      });
      expect(mockPrismaClient.job.upsert).not.toHaveBeenCalled();
    });
    
    // --- Tests for updating existing company --- 

    it('should update MISSING company logo if company exists without one', async () => {
      // Arrange: Mock company found WITHOUT logo
      mockPrismaClient.user.findFirst.mockResolvedValue({ 
        id: 'company-no-logo', 
        name: 'Example Company', 
        normalizedCompanyName: 'example company',
        logo: null, // Explicitly null
        role: UserRole.COMPANY
      });
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-123' });
      mockPrismaClient.user.update.mockResolvedValue({}); // Mock the update call

      // Act
      await jobProcessingService.saveOrUpdateJob(mockStandardizedJob); // Job data HAS logo

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledTimes(1); // Should be called once
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'company-no-logo' },
        data: { logo: mockStandardizedJob.companyLogo }
      });
    });

    it('should update MISSING normalized company name if company exists without one', async () => {
      // Arrange: Mock company found WITHOUT normalized name but WITH logo
      mockPrismaClient.user.findFirst.mockResolvedValue({ 
        id: 'company-no-norm', 
        name: 'Example Company', 
        normalizedCompanyName: null, // Explicitly null
        logo: 'https://example.com/existing-logo.png', // Has logo
        role: UserRole.COMPANY
      });
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-123' });
      mockPrismaClient.user.update.mockResolvedValue({}); // Mock the update call

      // Act
      await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledTimes(1); // Should be called once
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'company-no-norm' },
        data: { normalizedCompanyName: 'example company' }
      });
    });
    
    it('should update BOTH missing logo and missing normalized name in ONE call', async () => {
      // Arrange: Mock company found WITHOUT logo AND WITHOUT normalized name 
      mockPrismaClient.user.findFirst.mockResolvedValue({ 
        id: 'company-missing-both', 
        name: 'Example Company', 
        normalizedCompanyName: null, // Missing
        logo: null, // Missing
        role: UserRole.COMPANY
      });
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-123' });
      mockPrismaClient.user.update.mockResolvedValue({}); // Mock the update call

      // Act
      await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledTimes(1); // Should be called ONLY ONCE
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'company-missing-both' },
        data: { 
          normalizedCompanyName: 'example company', // Update name
          logo: mockStandardizedJob.companyLogo // Update logo
        }
      });
    });

    it('should return false and log error if essential job fields are missing', async () => {
      // Arrange
      const missingJobData: Partial<StandardizedJob> = { title: 'Incomplete Job' };

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(missingJobData as StandardizedJob);
      
      // Assert
      expect(result).toBe(false);
      expect(mockPrismaClient.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaClient.job.upsert).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ jobData: missingJobData }), expect.stringContaining('missing essential fields'));
    });

    // --- NEW TESTS FOR CONCURRENCY FIX (No fake timers needed) ---

    it('should handle company creation race condition (P2002) and find company after delay', async () => {
      const companyName = 'Race Condition Inc.';
      mockStandardizedJob.companyName = companyName;
      const prismaP2002Error = { code: 'P2002', message: 'Unique constraint failed' };
      const foundCompanyAfterError = {
        id: 'company-race',
        name: companyName,
        normalizedCompanyName: null, // Simulate missing normalized name to test update path
        role: UserRole.COMPANY
      };

      // 1. Initial find fails
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(null);
      // 2. Create throws P2002
      mockPrismaClient.user.create.mockRejectedValueOnce(prismaP2002Error);
      // 3. Second find (after delay) succeeds
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(foundCompanyAfterError);
      // 4. Mock the update for the missing normalized name
      mockPrismaClient.user.update.mockResolvedValueOnce({}); 
      // 5. Duplicate job check fails
      mockPrismaClient.job.findFirst.mockResolvedValue(null);
      // 6. Job upsert succeeds
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-race', companyId: 'company-race' });

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(2); // Initial find + find after error
      expect(mockPrismaClient.user.create).toHaveBeenCalledTimes(1);
      expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ companyName }), expect.stringContaining('P2002 - likely race condition'));
      // Verify normalized name was updated after finding the company
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'company-race' },
        data: { normalizedCompanyName: 'race condition inc' }
      });
      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
    });

    it('should handle company creation race condition (P2002) but fail if company still not found after delay', async () => {
      const companyName = 'Super Race Condition Inc.';
      mockStandardizedJob.companyName = companyName;
      const prismaP2002Error = { code: 'P2002', message: 'Unique constraint failed' };

      // 1. Initial find fails
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(null);
      // 2. Create throws P2002
      mockPrismaClient.user.create.mockRejectedValueOnce(prismaP2002Error);
      // 3. Second find (after delay) STILL fails
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(null);

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(result).toBe(false);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(2); // Initial find + find after error
      expect(mockPrismaClient.user.create).toHaveBeenCalledTimes(1);
      expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ companyName }), expect.stringContaining('P2002 - likely race condition'));
      expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ companyName }), expect.stringContaining('Still could not find company after P2002 error'));
      expect(mockPrismaClient.job.upsert).not.toHaveBeenCalled();
    });

    it('should handle non-P2002 error during company creation and return false', async () => {
      const companyName = 'Error Creating Inc.';
      mockStandardizedJob.companyName = companyName;
      const creationError = new Error('Database connection lost');

      // 1. Initial find fails
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(null);
      // 2. Create throws a generic error
      mockPrismaClient.user.create.mockRejectedValueOnce(creationError);

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(result).toBe(false);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(1); // Only the initial find
      expect(mockPrismaClient.user.create).toHaveBeenCalledTimes(1);
      expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ companyName, error: creationError }), expect.stringContaining('Unexpected error failed to create company'));
      // Ensure the second find attempt was NOT made
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(1); 
      expect(mockPrismaClient.job.upsert).not.toHaveBeenCalled();
    });

    // --- End NEW TESTS ---
  });
}); 
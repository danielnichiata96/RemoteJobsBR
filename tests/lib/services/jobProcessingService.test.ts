import { JobProcessingService } from '../../../src/lib/services/jobProcessingService';
// Removed GreenhouseProcessor import as it wasn't used directly in these tests
// Keep pino mock
// import pino from 'pino'; // Comment out import if removing mock
import pino from 'pino'; // Restore import
import { StandardizedJob, JobAssessmentStatus } from '../../../src/types/StandardizedJob';
import { PrismaClient, JobType, ExperienceLevel, HiringRegion, JobStatus, UserRole, SalaryPeriod, WorkplaceType } from '@prisma/client'; // Import the actual type (removed Currency)
import { Currency as AppCurrency } from '../../../src/types/models'; // Correct import for Currency enum
import { normalizeCompanyName, normalizeStringForSearch } from '../../../src/lib/utils/string';
import { z } from 'zod'; // Import Zod

// Import the schema itself to use in tests - **NOTE: This is unusual, usually schema is in its own file**
const { standardizedJobSchema } = require('../../../src/lib/services/jobProcessingService');

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

// Mock @prisma/client (including new JobStatus values)
jest.mock('@prisma/client', () => ({
  __esModule: true,
  UserRole: { COMPANY: 'COMPANY', CANDIDATE: 'CANDIDATE' },
  JobStatus: { 
    ACTIVE: 'ACTIVE', 
    CLOSED: 'CLOSED', 
    DRAFT: 'DRAFT', 
    PENDING_REVIEW: 'PENDING_REVIEW', // Add new status
    REJECTED: 'REJECTED' // Add new status
  },
  JobType: { FULL_TIME: 'FULL_TIME', PART_TIME: 'PART_TIME', CONTRACT: 'CONTRACT' },
  ExperienceLevel: { ENTRY: 'ENTRY', MID: 'MID', SENIOR: 'SENIOR' },
  HiringRegion: { WORLDWIDE: 'WORLDWIDE', LATAM: 'LATAM', USA: 'USA' },
  SalaryPeriod: { YEARLY: 'YEARLY', MONTHLY: 'MONTHLY', WEEKLY: 'WEEKLY' },
  WorkplaceType: { REMOTE: 'REMOTE', HYBRID: 'HYBRID', IN_PERSON: 'IN_PERSON' },
  PrismaClient: jest.fn(), 
  Prisma: { JsonNull: {} }, // Mock Prisma.JsonNull if needed
}));

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
      findUnique: jest.Mock;
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
        findUnique: jest.fn(),
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
    mockPrismaClient.job.findUnique.mockReset();
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
    let mockStandardizedJob: Omit<StandardizedJob, 'status'> & { assessmentStatus: JobAssessmentStatus }; // Use Omit to type without status

    beforeEach(() => {
      // Base mock job setup, WITHOUT status, WITH explicit undefined for some optionals
      mockStandardizedJob = {
        sourceId: 'test-123',
        source: 'testSource',
        title: 'Test Engineer',
        companyName: 'Test Company Inc.',
        description: 'Minimal Desc',
        isRemote: true,
        assessmentStatus: JobAssessmentStatus.RELEVANT,
        applicationUrl: 'https://test.com/apply',
        relevanceScore: 80,
        publishedAt: new Date('2024-03-10T10:00:00Z'),
        updatedAt: new Date('2024-03-10T11:00:00Z'),
        workplaceType: WorkplaceType.REMOTE,
        location: 'Remote',
        skills: [],
        tags: [],
        // Add explicit undefined for potentially problematic optional fields
        jobType: undefined,
        experienceLevel: undefined,
        country: undefined,
        hiringRegion: undefined,
        minSalary: undefined,
        maxSalary: undefined,
        currency: undefined,
        salaryPeriod: undefined,
        companyLogo: undefined,
        companyWebsite: undefined,
        // Add others if needed...
        requirements: undefined,
        responsibilities: undefined,
        benefits: undefined,
        visas: undefined,
        languages: undefined,
        companyEmail: undefined,
        locationRaw: undefined,
        metadataRaw: undefined,
        jobType2: undefined,
        expiresAt: undefined,
      };

      // Default Prisma mocks
      mockPrismaClient.user.findFirst.mockResolvedValue({ id: 'company-1', name: 'Test Company Inc.', normalizedCompanyName: 'test company inc', role: UserRole.COMPANY });
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-123', companyId: 'company-1'} as any);
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicates by default
      mockPrismaClient.user.create.mockResolvedValue({ id: 'company-new', name: 'Test Company Inc.', normalizedCompanyName: 'test company inc', role: UserRole.COMPANY});
    });

    // Helper to run Zod validation within tests
    const validateJobData = (jobData: any) => {
      try {
        standardizedJobSchema.parse(jobData);
        return { success: true, error: null };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return { success: false, error: error.flatten() };
        }
        return { success: false, error: 'Unknown validation error' };
      }
    };

    it('should save job successfully when company exists and HAS logo/normalized name', async () => {
      // Arrange: Define mock WITHOUT status, WITH explicit undefineds
      const simpleValidJob: Omit<StandardizedJob, 'status'> & { assessmentStatus: JobAssessmentStatus } = {
          sourceId: 'gh-success-1',
          source: 'greenhouse',
          title: 'Valid Simple Job',
          applicationUrl: 'https://valid.co/apply',
          companyName: 'Valid Co',
          isRemote: true,
          description: 'Valid Desc',
          relevanceScore: 90,
          assessmentStatus: JobAssessmentStatus.RELEVANT,
          skills: ['valid-skill'],
          publishedAt: new Date(),
          updatedAt: new Date(),
          companyWebsite: 'https://valid.co', 
          companyLogo: 'https://valid.co/logo.png',
          location: 'Remote',
          workplaceType: WorkplaceType.REMOTE, 
          jobType: JobType.FULL_TIME,
          experienceLevel: ExperienceLevel.MID,
          country: 'USA',
          tags: [],
          // Explicitly set other optionals to undefined for consistency
          minSalary: undefined,
          maxSalary: undefined,
          currency: undefined,
          salaryPeriod: undefined,
          requirements: undefined,
          responsibilities: undefined,
          benefits: undefined,
          hiringRegion: undefined,
          visas: undefined,
          languages: undefined,
          companyEmail: undefined,
          locationRaw: undefined,
          metadataRaw: undefined,
          jobType2: undefined,
          expiresAt: undefined,
      };

      // Pre-Assert: Check Zod validation passes
      const validation = validateJobData(simpleValidJob);
      expect(validation.success).toBe(true);

      // Ensure company exists and no duplicate job is found for this specific test
      mockPrismaClient.user.findFirst.mockResolvedValue({ 
        id: 'company-valid',
        name: 'Valid Co',
        normalizedCompanyName: 'valid co',
        logo: 'https://valid.co/logo.png',
        companyWebsite: 'https://valid.co',
        role: UserRole.COMPANY
      });
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // Explicitly no duplicate
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-saved', companyId: 'company-valid' });

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(simpleValidJob);
      
      // Assert
      expect(result).toBe(true); 
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.user.update).not.toHaveBeenCalled(); 
      expect(mockPrismaClient.job.findFirst).toHaveBeenCalledTimes(1); // Duplicate check
      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
      // Optional: Check upsert args again with the simplified job
      expect(mockPrismaClient.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          source_sourceId: { // Use the compound index
            source: simpleValidJob.source,
            sourceId: simpleValidJob.sourceId,
          },
        },
        create: expect.objectContaining({
          // Required fields
          title: simpleValidJob.title,
          source: simpleValidJob.source,
          sourceId: simpleValidJob.sourceId,
          companyId: 'company-valid', // From the mocked findFirst user call
          normalizedTitle: normalizeStringForSearch(simpleValidJob.title!), // Use normalized
          applicationUrl: simpleValidJob.applicationUrl,
          // Optional fields provided in simpleValidJob
          relevanceScore: simpleValidJob.relevanceScore,
          status: JobStatus.ACTIVE,
          description: simpleValidJob.description,
          skills: simpleValidJob.skills,
          publishedAt: simpleValidJob.publishedAt,
          updatedAt: simpleValidJob.updatedAt, // Should match publishedAt on create? Service uses job.updatedAt or new Date()
          location: simpleValidJob.location,
          workplaceType: simpleValidJob.workplaceType,
          jobType: simpleValidJob.jobType,
          experienceLevel: simpleValidJob.experienceLevel,
          country: simpleValidJob.country,
          tags: simpleValidJob.tags,
          metadataRaw: simpleValidJob.metadataRaw,
          // Explicitly check optional fields NOT provided (should be undefined/null)
          benefits: null,
          requirements: null,
          responsibilities: null,
          hiringRegion: null, // Map from jobType2 if present, otherwise null
          // ... other optional fields as null or check for absence ...
        }),
        update: expect.objectContaining({
          // Fields that should be updated
          title: simpleValidJob.title, // Title might change
          normalizedTitle: normalizeStringForSearch(simpleValidJob.title!), // Always update normalized
          applicationUrl: simpleValidJob.applicationUrl, // URL might change
          description: simpleValidJob.description,
          // ... other updatable fields from simpleValidJob ...
          relevanceScore: simpleValidJob.relevanceScore,
          status: JobStatus.ACTIVE, // Always reset status on update
          updatedAt: expect.any(Date), // Always update timestamp
          // Ensure fields NOT typically updated are absent
          // companyId: undefined, // Should not change
          // source: undefined,
          // sourceId: undefined,
          // publishedAt: undefined, // Should not change
        }),
      }));
    });

    it('should create company successfully if company does not exist', async () => {
      // Pre-Assert: Check Zod validation passes for the base mock job
      const validation = validateJobData(mockStandardizedJob);
      expect(validation.success).toBe(true);

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
      expect(mockPrismaClient.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          source_sourceId: { // Use the compound index
            source: mockStandardizedJob.source,
            sourceId: mockStandardizedJob.sourceId,
          },
        },
        create: expect.objectContaining({
          companyId: 'company-2', // Ensure correct companyId is used
          relevanceScore: mockStandardizedJob.relevanceScore, // Check score in create
          title: mockStandardizedJob.title, // Add other expected fields
          source: mockStandardizedJob.source,
          sourceId: mockStandardizedJob.sourceId,
          normalizedTitle: normalizeStringForSearch(mockStandardizedJob.title!),
          applicationUrl: mockStandardizedJob.applicationUrl,
          description: mockStandardizedJob.description,
          status: JobStatus.ACTIVE,
          // Add other required/optional fields present in mockStandardizedJob or expected defaults
        }),
        update: expect.objectContaining({
          title: mockStandardizedJob.title, // Update title
          normalizedTitle: normalizeStringForSearch(mockStandardizedJob.title!),
          applicationUrl: mockStandardizedJob.applicationUrl,
          description: mockStandardizedJob.description,
          relevanceScore: mockStandardizedJob.relevanceScore, // Check score in update
          status: JobStatus.ACTIVE,
          updatedAt: expect.any(Date),
          // ... other updatable fields ...
        }),
      }));
    });

    it('should detect duplicate job and update timestamp instead of saving', async () => {
      const existingJobId = 'existing-job-1';
      const existingJob = { 
          id: existingJobId, 
          title: 'Test Engineer', 
          companyId: 'company-dupe', 
          updatedAt: new Date(Date.now() - 100000) 
      }; 
      // Use a job that passes validation for the input
      const inputJobForDuplicateTest: Omit<StandardizedJob, 'status'> & { assessmentStatus: JobAssessmentStatus } = {
          sourceId: 'test-123',
          source: 'testSource',
          title: 'Test Engineer',
          applicationUrl: 'https://test.com/apply',
          companyName: 'Test Company Inc.',
          isRemote: true, 
          description: 'Minimal Desc',
          relevanceScore: 80,
          assessmentStatus: JobAssessmentStatus.RELEVANT,
          location: 'Remote', // Add missing location field
          // Explicitly set other optionals to undefined
          skills: undefined,
          tags: undefined,
          jobType: undefined,
          experienceLevel: undefined,
          country: undefined,
          workplaceType: undefined,
          hiringRegion: undefined,
          minSalary: undefined,
          maxSalary: undefined,
          currency: undefined,
          salaryPeriod: undefined,
          companyLogo: undefined,
          companyWebsite: undefined,
      };
      const normalizedCompanyNameForTest = normalizeCompanyName(inputJobForDuplicateTest.companyName!);

      // Pre-Assert: Check Zod validation passes for this specific input
      const validation = validateJobData(inputJobForDuplicateTest);
      if (!validation.success) { console.error("Duplicate Test Zod Errors:", validation.error); }
      expect(validation.success).toBe(true);

      // Arrange: Mock company found for THIS test, using the correct normalized name
      mockPrismaClient.user.findFirst.mockResolvedValue({ 
          id: 'company-dupe', 
          name: inputJobForDuplicateTest.companyName, 
          normalizedCompanyName: normalizedCompanyNameForTest,
          role: UserRole.COMPANY
      });
      // Arrange: Mock findFirst specifically for this test to return the existing job
      mockPrismaClient.job.findFirst.mockResolvedValue(existingJob);
      mockPrismaClient.job.update.mockResolvedValue({}); 

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(inputJobForDuplicateTest); 

      // Assert: Expect FALSE because it's a duplicate
      expect(result).toBe(false);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(1); // Company check
      // Ensure job.findFirst was called with the correct normalized fields
      expect(mockPrismaClient.job.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          normalizedTitle: normalizeStringForSearch(inputJobForDuplicateTest.title!),
          company: { normalizedCompanyName: normalizedCompanyNameForTest }
        })
      }));
      // Should call findUnique now, not findFirst
      expect(mockPrismaClient.job.findUnique).toHaveBeenCalledTimes(1); 
      expect(mockPrismaClient.job.findUnique).toHaveBeenCalledWith({
        where: { 
          source_sourceId: { // Expect the compound index
            source: inputJobForDuplicateTest.source,
            sourceId: inputJobForDuplicateTest.sourceId
          }
        }
      });
      expect(mockPrismaClient.job.upsert).not.toHaveBeenCalled(); 
      expect(mockPrismaClient.job.update).toHaveBeenCalledTimes(1); 
      expect(mockPrismaClient.job.update).toHaveBeenCalledWith({
        where: { id: existingJobId },
        // Only update timestamp and status for duplicates
        data: {
          updatedAt: expect.any(Date),
          status: JobStatus.ACTIVE, // Ensure status is reset to ACTIVE
        },
      });
      expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ existingJobId: existingJobId }), expect.stringContaining('Duplicate job detected'));
    });
    
    // --- Tests for updating existing company --- 

    it('should update MISSING company logo if company exists without one', async () => {
      // Arrange: Mock company found WITHOUT logo
      const companyWithoutLogo = { 
        id: 'company-no-logo', 
        name: 'Test Company Inc.', 
        normalizedCompanyName: 'test company inc',
        logo: null, 
        role: UserRole.COMPANY
      };
      mockPrismaClient.user.findFirst.mockResolvedValue(companyWithoutLogo);
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-123' });
      mockPrismaClient.user.update.mockResolvedValue({}); // Mock the update call

      // Pre-Assert: Check Zod validation passes for the base mock job
      const validation = validateJobData(mockStandardizedJob);
      expect(validation.success).toBe(true);

      // Act - Use the base mockStandardizedJob which has companyName: 'Test Company Inc.'
      await jobProcessingService.saveOrUpdateJob(mockStandardizedJob); 

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledTimes(1); 
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: companyWithoutLogo.id },
        data: expect.objectContaining({ logo: mockStandardizedJob.companyLogo })
      });
    });

    it('should update MISSING normalized company name if company exists without one', async () => {
       // Arrange: Mock company found WITHOUT normalized name but WITH logo
       const companyWithoutNormName = { 
        id: 'company-no-norm', 
        name: 'Test Company Inc.', 
        normalizedCompanyName: null, // Missing normalized name
        logo: 'https://test.com/existing-logo.png', 
        role: UserRole.COMPANY
      };
      mockPrismaClient.user.findFirst.mockResolvedValue(companyWithoutNormName);
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-123' });
      mockPrismaClient.user.update.mockResolvedValue({}); // Mock the update call

      // Pre-Assert: Check Zod validation passes for the base mock job
      const validation = validateJobData(mockStandardizedJob);
      expect(validation.success).toBe(true);

      // Act - Use the base mockStandardizedJob
      await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledTimes(1); 
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: companyWithoutNormName.id },
        data: expect.objectContaining({ normalizedCompanyName: normalizeCompanyName(mockStandardizedJob.companyName!) })
      });
    });
    
    it('should update BOTH missing logo and missing normalized name in ONE call', async () => {
      // Arrange: Mock company found WITHOUT logo AND WITHOUT normalized name 
       const companyMissingBoth = { 
        id: 'company-missing-both', 
        name: 'Test Company Inc.', 
        normalizedCompanyName: null, 
        logo: null, 
        role: UserRole.COMPANY
      };
      mockPrismaClient.user.findFirst.mockResolvedValue(companyMissingBoth);
      mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-123' });
      mockPrismaClient.user.update.mockResolvedValue({}); // Mock the update call

      // Pre-Assert: Check Zod validation passes for the base mock job
      const validation = validateJobData(mockStandardizedJob);
      expect(validation.success).toBe(true);

      // Act - Use the base mockStandardizedJob
      await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledTimes(1); 
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: companyMissingBoth.id },
        data: { 
          normalizedCompanyName: normalizeCompanyName(mockStandardizedJob.companyName!), 
          logo: mockStandardizedJob.companyLogo 
        }
      });
    });

    it('should return false and log error if essential job fields are missing', async () => {
      // Arrange - Use a job known to fail the schema (e.g., missing title)
      const missingJobData = { 
          // Intentionally incomplete data
          sourceId: 'incomplete-1', 
          source: 'test',
          companyName: 'Test', 
          // Missing title, applicationUrl etc.
      };

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(missingJobData as StandardizedJob);
      
      // Assert
      expect(result).toBe(false);
      expect(mockPrismaClient.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaClient.job.upsert).not.toHaveBeenCalled();
      // Verify the logger call with validation errors
      expect(loggerMock.warn).toHaveBeenCalledWith(
          expect.objectContaining({ validationErrors: expect.any(Object) }), 
          expect.stringContaining('Job data failed standardized validation')
      );
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

      // Pre-Assert: Check Zod validation passes
      const validation = validateJobData(mockStandardizedJob);
      expect(validation.success).toBe(true);

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
        data: expect.objectContaining({ normalizedCompanyName: 'race condition inc' })
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

      // Pre-Assert: Check Zod validation passes
      const validation = validateJobData(mockStandardizedJob);
      expect(validation.success).toBe(true);

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

      // Pre-Assert: Check Zod validation passes
      const validation = validateJobData(mockStandardizedJob);
      expect(validation.success).toBe(true);

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

    it('should UPDATE company logo/website if company exists but is missing them', async () => {
       // Arrange: Mock company found WITHOUT logo/website
      mockPrismaClient.user.findFirst.mockResolvedValue({ 
        id: 'company-3',
        name: 'Example Company',
        normalizedCompanyName: 'example company',
        logo: null, // Missing logo
        companyWebsite: null, // Missing website
        role: UserRole.COMPANY
      });
       mockPrismaClient.job.findFirst.mockResolvedValue(null); // No duplicate job
      mockPrismaClient.job.upsert.mockResolvedValue({ id: 'job-456' });
      mockPrismaClient.user.update.mockResolvedValue({}); // Mock user update

      // Pre-Assert: Check Zod validation passes for the base mock job
      const validation = validateJobData(mockStandardizedJob);
      expect(validation.success).toBe(true);

      // Act
      const result = await jobProcessingService.saveOrUpdateJob(mockStandardizedJob);
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledTimes(1);
      // Expect user update to be called for logo and website
      expect(mockPrismaClient.user.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'company-3' },
        data: expect.objectContaining({
          logo: mockStandardizedJob.companyLogo,
          companyWebsite: mockStandardizedJob.companyWebsite,
        }),
      });
      expect(mockPrismaClient.job.findFirst).toHaveBeenCalled();
      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
       expect(mockPrismaClient.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({
          // ... existing create fields ...
          companyId: 'company-3',
          relevanceScore: mockStandardizedJob.relevanceScore, // Check score in create
        }),
        update: expect.objectContaining({
          // ... existing update fields ...
          relevanceScore: mockStandardizedJob.relevanceScore, // Check score in update
          status: JobStatus.ACTIVE,
        }),
      }));
    });

    // --- NEW Tests for Status Mapping --- 
    it('should save job with status ACTIVE when assessmentStatus is RELEVANT', async () => {
      const relevantJob = { 
          ...mockStandardizedJob, 
          assessmentStatus: JobAssessmentStatus.RELEVANT 
      };
      await jobProcessingService.saveOrUpdateJob(relevantJob);

      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = mockPrismaClient.job.upsert.mock.calls[0][0];
      expect(upsertArgs.create.status).toBe(JobStatus.ACTIVE);
      expect(upsertArgs.update.status).toBe(JobStatus.ACTIVE);
    });

    it('should save job with status CLOSED when assessmentStatus is IRRELEVANT', async () => {
      const irrelevantJob = { 
          ...mockStandardizedJob, 
          assessmentStatus: JobAssessmentStatus.IRRELEVANT 
      };
      await jobProcessingService.saveOrUpdateJob(irrelevantJob);

      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = mockPrismaClient.job.upsert.mock.calls[0][0];
      expect(upsertArgs.create.status).toBe(JobStatus.CLOSED);
      expect(upsertArgs.update.status).toBe(JobStatus.CLOSED);
    });

    it('should save job with status PENDING_REVIEW when assessmentStatus is NEEDS_REVIEW', async () => {
      const needsReviewJob = { 
          ...mockStandardizedJob, 
          assessmentStatus: JobAssessmentStatus.NEEDS_REVIEW 
      };
      await jobProcessingService.saveOrUpdateJob(needsReviewJob);

      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = mockPrismaClient.job.upsert.mock.calls[0][0];
      expect(upsertArgs.create.status).toBe(JobStatus.PENDING_REVIEW);
      expect(upsertArgs.update.status).toBe(JobStatus.PENDING_REVIEW);
    });

    it('should save job with status PENDING_REVIEW when assessmentStatus is undefined', async () => {
      const undefinedStatusJob = { 
          ...mockStandardizedJob, 
          assessmentStatus: undefined 
      };
      await jobProcessingService.saveOrUpdateJob(undefinedStatusJob);

      expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = mockPrismaClient.job.upsert.mock.calls[0][0];
      expect(upsertArgs.create.status).toBe(JobStatus.PENDING_REVIEW);
      expect(upsertArgs.update.status).toBe(JobStatus.PENDING_REVIEW);
      expect(loggerMock.warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('AssessmentStatus missing, defaulting JobStatus to PENDING_REVIEW'));
    });

    // Optional: Test updating status (e.g., from PENDING_REVIEW to ACTIVE)
    it('should update status to ACTIVE if assessment changes from NEEDS_REVIEW to RELEVANT', async () => {
        // Mock existing job as PENDING_REVIEW (though upsert handles this implicitly)
        const relevantJob = { 
          ...mockStandardizedJob, 
          assessmentStatus: JobAssessmentStatus.RELEVANT 
        };
        
        await jobProcessingService.saveOrUpdateJob(relevantJob);

        expect(mockPrismaClient.job.upsert).toHaveBeenCalledTimes(1);
        const upsertArgs = mockPrismaClient.job.upsert.mock.calls[0][0];
        // The key is that the update block sets the status correctly
        expect(upsertArgs.update.status).toBe(JobStatus.ACTIVE); 
    });

  });
}); 
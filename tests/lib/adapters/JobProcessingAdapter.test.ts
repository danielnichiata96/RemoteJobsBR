import { JobProcessingAdapter } from '../../../src/lib/adapters/JobProcessingAdapter';
import { JobProcessingService } from '../../../src/lib/services/jobProcessingService';
import { StandardizedJob } from '../../../src/types/StandardizedJob'; // Assuming this path
import { JobType, ExperienceLevel, WorkplaceType } from '@prisma/client';
import pino from 'pino'; // Import pino here, before mocks

// --- Mocks ---

// Mock Pino logger
jest.mock('pino', () => {
  // Define the mock functions *inside* the factory
  const mockLogInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockImplementation(function() { return this; }),
  };
  return jest.fn(() => mockLogInstance); // Return the factory that creates the mock
});

// Mock the entire @prisma/client module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({})),
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

// Mock JobProcessingService
const mockSaveOrUpdateJob = jest.fn();
jest.mock('../../../src/lib/services/jobProcessingService', () => {
  return {
    JobProcessingService: jest.fn().mockImplementation(() => {
      return { saveOrUpdateJob: mockSaveOrUpdateJob };
    }),
  };
});

// Mock GreenhouseProcessor
const mockGreenhouseProcessJob = jest.fn();
jest.mock('../../../src/lib/jobProcessors/greenhouseProcessor', () => {
  return {
    GreenhouseProcessor: jest.fn().mockImplementation(() => {
      return { 
        source: 'greenhouse', // Needed for logging within the adapter
        processJob: mockGreenhouseProcessJob 
      };
    }),
  };
});

// Mock LeverProcessor (even if unused, prevent instantiation errors)
const mockLeverProcessJob = jest.fn();
jest.mock('../../../src/lib/jobProcessors/LeverProcessor', () => {
  return {
    LeverProcessor: jest.fn().mockImplementation(() => {
      return { source: 'lever', processJob: mockLeverProcessJob };
    }),
  };
});

// Mock AshbyProcessor (even if unused, prevent instantiation errors)
const mockAshbyProcessJob = jest.fn();
jest.mock('../../../src/lib/jobProcessors/AshbyProcessor', () => {
  return {
    AshbyProcessor: jest.fn().mockImplementation(() => {
      return { source: 'ashby', processJob: mockAshbyProcessJob };
    }),
  };
});

// --- Helper Data ---
const mockRawGreenhouseJob = { id: 123, title: 'Raw GH Job' };
const mockStandardizedJob: StandardizedJob = {
  source: 'greenhouse',
  sourceId: '123',
  title: 'Standardized GH Job',
  description: 'Desc',
  companyName: 'Test Co',
  location: 'Remote',
  url: 'http://example.com/123',
  updatedAt: new Date(),
  // Add other required fields
  status: 'ACTIVE',
  jobType: JobType.FULL_TIME,
  experienceLevel: ExperienceLevel.MID,
  workplaceType: WorkplaceType.REMOTE,
};
const mockSourceData: any = { id: 'src-1', type: 'greenhouse', name: 'Test Source' };

// --- Test Suite ---
describe('JobProcessingAdapter', () => {
  let adapter: JobProcessingAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-instantiate adapter before each test to ensure clean processor map
    adapter = new JobProcessingAdapter();
  });

  it('should call GreenhouseProcessor for "greenhouse" source', async () => {
    mockGreenhouseProcessJob.mockResolvedValue({ success: true, job: mockStandardizedJob });
    mockSaveOrUpdateJob.mockResolvedValue(true);

    await adapter.processRawJob('greenhouse', mockRawGreenhouseJob, mockSourceData);

    expect(mockGreenhouseProcessJob).toHaveBeenCalledTimes(1);
    expect(mockGreenhouseProcessJob).toHaveBeenCalledWith(mockRawGreenhouseJob, mockSourceData);
    expect(mockLeverProcessJob).not.toHaveBeenCalled(); // Ensure others weren't called
    expect(mockAshbyProcessJob).not.toHaveBeenCalled();
  });

  it('should call JobProcessingService.saveOrUpdateJob on successful processing', async () => {
    mockGreenhouseProcessJob.mockResolvedValue({ success: true, job: mockStandardizedJob });
    mockSaveOrUpdateJob.mockResolvedValue(true);

    await adapter.processRawJob('greenhouse', mockRawGreenhouseJob, mockSourceData);

    expect(mockSaveOrUpdateJob).toHaveBeenCalledTimes(1);
    expect(mockSaveOrUpdateJob).toHaveBeenCalledWith(mockStandardizedJob);
  });

  it('should return true when processing and saving are successful', async () => {
    mockGreenhouseProcessJob.mockResolvedValue({ success: true, job: mockStandardizedJob });
    mockSaveOrUpdateJob.mockResolvedValue(true);

    const result = await adapter.processRawJob('greenhouse', mockRawGreenhouseJob);
    expect(result).toBe(true);
  });

  it('should return false if processor reports failure', async () => {
    mockGreenhouseProcessJob.mockResolvedValue({ success: false, error: 'Irrelevant job' });

    const result = await adapter.processRawJob('greenhouse', mockRawGreenhouseJob);

    expect(result).toBe(false);
    expect(mockSaveOrUpdateJob).not.toHaveBeenCalled();
    const loggerInstance = pino();
    expect(loggerInstance.warn).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('Processor reported failure'));
  });

  it('should return false if processor returns null job', async () => {
    mockGreenhouseProcessJob.mockResolvedValue({ success: true, job: null });

    const result = await adapter.processRawJob('greenhouse', mockRawGreenhouseJob);

    expect(result).toBe(false);
    expect(mockSaveOrUpdateJob).not.toHaveBeenCalled();
    const loggerInstance = pino();
    expect(loggerInstance.warn).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('Processor reported failure'));
  });

  it('should return false if saveOrUpdateJob fails', async () => {
    mockGreenhouseProcessJob.mockResolvedValue({ success: true, job: mockStandardizedJob });
    mockSaveOrUpdateJob.mockResolvedValue(false); // Simulate save failure

    const result = await adapter.processRawJob('greenhouse', mockRawGreenhouseJob);

    expect(result).toBe(false);
    expect(mockSaveOrUpdateJob).toHaveBeenCalledTimes(1);
    const loggerInstance = pino();
    expect(loggerInstance.warn).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('failed to save/update'));
  });

  it('should return false and log error for unknown source type', async () => {
    const result = await adapter.processRawJob('unknown_source', { id: 999 });

    expect(result).toBe(false);
    expect(mockGreenhouseProcessJob).not.toHaveBeenCalled();
    expect(mockSaveOrUpdateJob).not.toHaveBeenCalled();
    const loggerInstance = pino();
    expect(loggerInstance.error).toHaveBeenCalledWith(expect.stringContaining('No processor found for source'));
  });

  it('should return false and log error if processor throws an error', async () => {
    const processingError = new Error('Processor exploded!');
    mockGreenhouseProcessJob.mockRejectedValue(processingError);

    const result = await adapter.processRawJob('greenhouse', mockRawGreenhouseJob);

    expect(result).toBe(false);
    expect(mockSaveOrUpdateJob).not.toHaveBeenCalled();
    const loggerInstance = pino();
    expect(loggerInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({ 
        error: expect.objectContaining({ message: processingError.message })
      }), 
      expect.stringContaining('*** CATCH BLOCK in JobProcessingAdapter.processRawJob ***')
    );
  });
}); 
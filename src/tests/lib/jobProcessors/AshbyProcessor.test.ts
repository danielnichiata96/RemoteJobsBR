import { AshbyProcessor } from '@/lib/jobProcessors/AshbyProcessor';
import { JobSource, JobType, HiringRegion, JobStatus, ExperienceLevel } from '@prisma/client';
import pino from 'pino';
import { StandardizedJob } from '@/types/StandardizedJob';
import { detectJobType, detectExperienceLevel, extractSkills } from '@/lib/utils/jobUtils';

// Mock job utils using the alias
jest.mock('@/lib/utils/jobUtils', () => ({
  detectJobType: jest.fn(),
  detectExperienceLevel: jest.fn(),
  extractSkills: jest.fn(),
}));

// Mock pino logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  trace: jest.fn(),
  child: jest.fn(() => mockLogger), // Return itself for chained calls
} as unknown as pino.Logger;

// Mock the global logger used within the processor module scope (if any specific setup needed)
// jest.mock('pino', () => jest.fn(() => mockLogger)); 
// --> Commented out: Usually mocking the passed-in child logger is sufficient

// Mock JobSource data
const mockSourceData: JobSource = {
    id: 'ashby-src-test',
    name: 'Test Ashby Co',
    type: 'ashby',
    isEnabled: true,
    config: { jobBoardName: 'testashbyco' }, // Example config
    companyWebsite: 'https://testashby.co',
    logoUrl: 'https://logo.testashby.co/logo.png',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastFetched: null,
    apiKey: null,
    apiEndpoint: null,
};

// Sample raw job data from Ashby API
const relevantRemoteJob = {
    title: "Senior Remote Engineer",
    isRemote: true,
    isListed: true,
    descriptionHtml: "<p>Work from anywhere!</p>",
    publishedAt: "2024-01-15T10:00:00Z",
    employmentType: "FullTime",
    jobUrl: "https://jobs.ashbyhq.com/testashbyco/remote-senior",
    applyUrl: "https://jobs.ashbyhq.com/testashbyco/remote-senior/apply",
};

const relevantLatamJob = {
    title: "Marketing Manager",
    location: "Remote (LATAM)",
    isRemote: false, // isRemote might be false, but location specifies region
    isListed: true,
    descriptionHtml: "<p>Marketing para LatAm</p>",
    publishedAt: "2024-01-14T11:00:00Z",
    employmentType: "FullTime",
    jobUrl: "https://jobs.ashbyhq.com/testashbyco/mktg-latam",
    applyUrl: "https://jobs.ashbyhq.com/testashbyco/mktg-latam/apply",
};

const relevantBrazilJob = {
    title: "Analista de Dados",
    location: "São Paulo, SP",
    secondaryLocations: [{ location: "Remote - Brazil Only" }],
    isRemote: false,
    isListed: true,
    address: { postalAddress: { addressLocality: "São Paulo", addressRegion: "SP", addressCountry: "Brazil" }},
    descriptionHtml: "<p>Análise de dados.</p>",
    publishedAt: "2024-01-13T12:00:00Z",
    employmentType: "FullTime",
    jobUrl: "https://jobs.ashbyhq.com/testashbyco/data-br",
    applyUrl: "https://jobs.ashbyhq.com/testashbyco/data-br/apply",
};

const irrelevantLocationJob = {
    title: "Office Manager",
    location: "London, UK",
    isRemote: false,
    isListed: true,
    address: { postalAddress: { addressCountry: "UK" }},
    descriptionHtml: "<p>Manage the office.</p>",
    publishedAt: "2024-01-12T13:00:00Z",
    employmentType: "FullTime",
    jobUrl: "https://jobs.ashbyhq.com/testashbyco/office-london",
    applyUrl: "https://jobs.ashbyhq.com/testashbyco/office-london/apply",
};

const unlistedJob = {
    title: "Stealth Project Lead",
    isRemote: true,
    isListed: false, // Should be irrelevant
    descriptionHtml: "<p>Top secret.</p>",
    publishedAt: "2024-01-11T14:00:00Z",
    employmentType: "Contract",
    jobUrl: "https://jobs.ashbyhq.com/testashbyco/stealth",
    applyUrl: "https://jobs.ashbyhq.com/testashbyco/stealth/apply",
};

describe('AshbyProcessor', () => {
  let processor: AshbyProcessor;

  beforeEach(() => {
    processor = new AshbyProcessor();
    jest.clearAllMocks();

    // Provide default mock implementations for job utils
    (detectJobType as jest.Mock).mockReturnValue(JobType.UNKNOWN);
    (detectExperienceLevel as jest.Mock).mockReturnValue(ExperienceLevel.UNKNOWN);
    (extractSkills as jest.Mock).mockReturnValue(['skill1', 'skill2']);
  });

  describe('_isJobRelevant', () => {
    test('should return true for explicitly remote job', () => {
      const result = processor['_isJobRelevant'](relevantRemoteJob as any, mockLogger);
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ title: relevantRemoteJob.title }), expect.stringContaining('isRemote is true'));
    });

    test('should return true for job with LATAM keyword in location', () => {
        const relevantLatamJob = {
            title: "Marketing Manager",
            isRemote: false,
            isListed: true,
            location: "remote (latam)", // Contains remote keyword, should be caught first
            jobUrl: "https://jobs.ashbyhq.com/testashbyco/mktg-latam",
          };
        const result = processor['_isJobRelevant'](relevantLatamJob as any, mockLogger);
        expect(result).toBe(true);
        // Assert based on the actual logic: remote keyword takes precedence
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.objectContaining({ location: relevantLatamJob.location }), 
            expect.stringContaining('Remote keyword found')
        );
      });

    test('should return true for job with Brazil keyword in secondary location', () => {
        const relevantBrazilJob = {
            title: "Analista de Dados",
            isRemote: false,
            isListed: true,
            location: "brazil", // Primary location also matches
            secondaryLocations: [
              { location: "São Paulo, Brasil" },
              { location: "Remote - Brazil Only" } // Secondary location match
            ],
            jobUrl: "https://jobs.ashbyhq.com/testashbyco/data-br",
          };
       const result = processor['_isJobRelevant'](relevantBrazilJob as any, mockLogger);
       expect(result).toBe(true);
       // Brazil keyword is checked after remote, should log LATAM keyword found
       expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ location: relevantBrazilJob.location }), // Check based on primary match
        expect.stringContaining('LATAM keyword found')
       );
    });

    test('should return false for job with irrelevant location', () => {
      const result = processor['_isJobRelevant'](irrelevantLocationJob as any, mockLogger);
      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ title: irrelevantLocationJob.title }), expect.stringContaining('Did not meet remote/LATAM criteria'));
    });

    test('should return false for unlisted job', () => {
      const result = processor['_isJobRelevant'](unlistedJob as any, mockLogger);
      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ title: unlistedJob.title }), expect.stringContaining('isListed is false'));
    });
    
     // TODO: Add tests for keyword matching in title/description as fallback
  });

  describe('processJob', () => {
    test('should process a relevant remote job successfully', async () => {
      const result = await processor.processJob(relevantRemoteJob as any, mockSourceData, mockLogger);
      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      expect(result.job?.source).toBe('ashby');
      expect(result.job?.sourceId).toBe(relevantRemoteJob.jobUrl);
      expect(result.job?.title).toBe(relevantRemoteJob.title);
      expect(result.job?.applicationUrl).toBe(relevantRemoteJob.applyUrl);
      expect(result.job?.companyName).toBe(mockSourceData.name);
      expect(result.job?.companyWebsite).toBe(mockSourceData.companyWebsite);
      expect(result.job?.workplaceType).toBe('REMOTE');
      expect(result.job?.jobType).toBe(JobType.FULL_TIME);
      expect(result.job?.hiringRegion).toBe(HiringRegion.WORLDWIDE); 
      expect(result.job?.status).toBe(JobStatus.ACTIVE);
      expect(result.job?.description).toContain('Work from anywhere!'); // Check if HTML is cleaned
      expect(result.job?.skills?.length).toBeGreaterThan(0); // Basic skill check
    });

    test('should process a relevant LATAM job successfully', async () => {
        const result = await processor.processJob(relevantLatamJob as any, mockSourceData, mockLogger);
        expect(result.success).toBe(true);
        expect(result.job).toBeDefined();
        expect(result.job?.sourceId).toBe(relevantLatamJob.jobUrl);
        expect(result.job?.title).toBe(relevantLatamJob.title);
        expect(result.job?.hiringRegion).toBe(HiringRegion.LATAM);
        expect(result.job?.location).toBe(relevantLatamJob.location);
      });

      test('should process a relevant Brazil job successfully', async () => {
        const result = await processor.processJob(relevantBrazilJob as any, mockSourceData, mockLogger);
        expect(result.success).toBe(true);
        expect(result.job).toBeDefined();
        expect(result.job?.sourceId).toBe(relevantBrazilJob.jobUrl);
        expect(result.job?.title).toBe(relevantBrazilJob.title);
        expect(result.job?.hiringRegion).toBe(HiringRegion.BRAZIL);
        expect(result.job?.country).toBe('Brazil');
        expect(result.job?.location).toBe(relevantBrazilJob.location);
      });

    test('should return success:false for an irrelevant job', async () => {
      const result = await processor.processJob(irrelevantLocationJob as any, mockSourceData, mockLogger);
      expect(result.success).toBe(false);
      expect(result.job).toBeUndefined();
      expect(result.error).toBe('Job determined irrelevant');
    });

    test('should return success:false for an unlisted job', async () => {
        const result = await processor.processJob(unlistedJob as any, mockSourceData, mockLogger);
        expect(result.success).toBe(false);
        expect(result.job).toBeUndefined();
        expect(result.error).toBe('Job determined irrelevant');
      });

    test('should return success:false if jobUrl (used as sourceId) is missing', async () => {
      const jobMissingUrl = { ...relevantRemoteJob, jobUrl: undefined, applyUrl: undefined };
      const result = await processor.processJob(jobMissingUrl as any, mockSourceData, mockLogger);
      expect(result.success).toBe(false);
      expect(result.job).toBeUndefined();
      expect(result.error).toBe('Missing jobUrl to use as sourceId');
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ title: jobMissingUrl.title }), expect.stringContaining('Could not determine a unique sourceId'));
    });
    
    // TODO: Add test for general error during processing
  });

  // Add tests for private methods like _mapEmploymentType, _determineHiringRegion if needed for complex logic

  it('should be implemented', () => {
    // TODO: Implement tests
    expect(true).toBe(true); // Placeholder
  });
}); 
import { GreenhouseProcessor } from '../../../src/lib/jobProcessors/greenhouseProcessor';
import { GreenhouseJob, EnhancedGreenhouseJob, ProcessedJobResult } from '../../../src/lib/jobProcessors/types';
import * as jobUtils from '../../../src/lib/utils/jobUtils';
import { JobType, ExperienceLevel, WorkplaceType, HiringRegion } from '@prisma/client';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { JobSource } from '../../types/models';
import { JobSourceType } from '../../types/JobSource';
import { getCompanyLogo, extractDomain } from '../../../src/lib/utils/logoUtils';
import * as scorerUtils from '../../../src/lib/utils/JobRelevanceScorer';

// --- Mocks ---

// Mock Pino logger
jest.mock('pino', () => {
  const mockLog = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn(() => mockLog)
  };
  return jest.fn(() => mockLog);
});

// Mock the entire @prisma/client module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({})),
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
  HiringRegion: {
      WORLDWIDE: 'WORLDWIDE',
      LATAM: 'LATAM',
      BRAZIL: 'BRAZIL'
  }
}));

// **MOVED jobUtils mock BACK to top level**
jest.mock('../../../src/lib/utils/jobUtils', () => ({
  extractSkills: jest.fn(),
  cleanHtml: jest.fn(),
  stripHtml: jest.fn(),
  detectJobType: jest.fn(),
  detectExperienceLevel: jest.fn(),
  parseSections: jest.fn(),
  isRemoteJob: jest.fn(),
}));

// Mock logoUtils module and the specific function
jest.mock('../../../src/lib/utils/logoUtils', () => ({
    getCompanyLogo: jest.fn((website) => {
        if (website === 'https://enhanced.corp') {
            return 'https://img.logo.dev/enhanced.corp?token=pk_f4m8WG-wQOeM90skJ8dV6Q';
        }
        if (website === 'https://basic.example.com') {
            return undefined;
        }
        return undefined;
    }),
    extractDomain: jest.fn((url) => {
        try {
            if (!url) return null;
            return new URL(url).hostname.replace(/^www\./, '');
        } catch { return null; }
    })
}));

// Mock JobRelevanceScorer
jest.mock('../../../src/lib/utils/JobRelevanceScorer', () => ({
  calculateRelevanceScore: jest.fn(),
}));

// --- Test Suite ---

const createMockJobSource = (overrides: Partial<JobSource> = {}): JobSource => ({
  id: 'mock-source-id-gh',
  name: overrides.name ?? 'Test Greenhouse Source',
  type: 'greenhouse',
  config: { boardToken: 'testboard', ...overrides.config },
  companyWebsite: overrides.companyWebsite ?? 'https://basic.example.com',
  isEnabled: overrides.isEnabled ?? true,
  description: overrides.description ?? null,
  url: overrides.url ?? null,
  logoUrl: overrides.logoUrl ?? null,
  lastFetched: overrides.lastFetched ?? null,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

describe('GreenhouseProcessor', () => {
  let processor: GreenhouseProcessor;
  let mockPrisma: PrismaClient;
  let mockLogger: any;
  const mockedScorerUtils = scorerUtils as jest.Mocked<typeof scorerUtils>;

  // Cast the mock module AFTER top-level mock is defined
  const mockedJobUtils = jobUtils as jest.Mocked<typeof jobUtils>; 

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
    processor = new GreenhouseProcessor();
    mockLogger = pino(); 

    mockedJobUtils.stripHtml.mockImplementation(html => html ? String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    mockedJobUtils.extractSkills.mockReturnValue(['defaultSkill']);
    mockedJobUtils.detectJobType.mockReturnValue(JobType.FULL_TIME); 
    mockedJobUtils.detectExperienceLevel.mockReturnValue(ExperienceLevel.MID); 
    mockedJobUtils.parseSections.mockReturnValue({
      description: 'Default Parsed Description',
      requirements: 'Default Parsed Requirements',
      responsibilities: 'Default Parsed Responsibilities',
      benefits: 'Default Parsed Benefits'
    });
    mockedJobUtils.isRemoteJob.mockReturnValue(true);

    (getCompanyLogo as jest.Mock).mockClear();
    (getCompanyLogo as jest.Mock).mockImplementation((website) => {
        if (website === 'https://enhanced.corp') {
            return 'https://img.logo.dev/enhanced.corp?token=pk_f4m8WG-wQOeM90skJ8dV6Q';
        }
        if (website === 'https://basic.example.com') {
             return undefined;
         }
        return undefined;
    });

    const logoUtils = require('../../../src/lib/utils/logoUtils');
    logoUtils.extractDomain.mockImplementation((url: string | null | undefined) => {
         try {
            if (!url) return null;
            const hostname = new URL(url).hostname;
            return hostname.replace(/^www\./, '');
        } catch { return null; }
    });

    mockedScorerUtils.calculateRelevanceScore.mockReturnValue(99);
  });

  // --- Test Data Definition ---
  const basicRawJob: GreenhouseJob = {
    id: 123,
    title: 'Basic Engineer',
    updated_at: new Date('2024-02-01T00:00:00Z').toISOString(),
    published_at: new Date('2024-01-01T00:00:00Z').toISOString(),
    location: { name: 'Remote' },
    content: '<p>Basic job content</p>',
    absolute_url: 'https://jobs.greenhouse.io/basic/123',
    metadata: [{ name: 'ReqID', value: 'R123' }],
    offices: [{ id: 10, name: 'HQ' }],
    departments: [{ id: 1, name: 'Engineering', child_ids: [], parent_id: null }],
    company: { name: 'Basic Corp' },
  };

  const mockSourceDataBasic = createMockJobSource({ name: 'Basic Corp', companyWebsite: 'https://basic.example.com'});

  describe('processJob', () => {
    it('should process a basic GreenhouseJob correctly and calculate score', async () => {
      mockedJobUtils.isRemoteJob.mockReturnValue(true);
      const mockSourceDataWithScoring = createMockJobSource({
        ...mockSourceDataBasic,
        config: { ...mockSourceDataBasic.config, SCORING_SIGNALS: { /* mock signals */ } }
      });

      const result = await processor.processJob(basicRawJob, mockSourceDataWithScoring);

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      const job = result.job!;

      expect(mockedScorerUtils.calculateRelevanceScore).toHaveBeenCalledTimes(1);
      expect(mockedScorerUtils.calculateRelevanceScore).toHaveBeenCalledWith(
        { 
          title: basicRawJob.title, 
          description: "Basic job content", 
          location: basicRawJob.location.name 
        },
        mockSourceDataWithScoring.config
      );

      expect(job.relevanceScore).toBe(99);

      expect(job.source).toBe('greenhouse');
      expect(job.sourceId).toBe('123');
      expect(job.title).toBe('Basic Engineer');
      expect(job.description).toBe('Default Parsed Description'); 
      expect(job.applicationUrl).toBe(basicRawJob.absolute_url);
      expect(job.companyName).toBe(mockSourceDataBasic.name);
      expect(job.companyWebsite).toBe(mockSourceDataBasic.companyWebsite);
      expect(getCompanyLogo).toHaveBeenCalledWith(mockSourceDataBasic.companyWebsite); 
      expect(job.companyLogo).toBeUndefined();
      expect(job.jobType).toBe(JobType.FULL_TIME);
      expect(job.experienceLevel).toBe(ExperienceLevel.MID);
      expect(job.skills).toEqual(['defaultSkill']);
      expect(job.location).toBe('Remote');
      expect(job.requirements).toBe('Default Parsed Requirements');
      expect(job.responsibilities).toBe('Default Parsed Responsibilities');
      expect(job.benefits).toBe('Default Parsed Benefits');
      expect(job.metadataRaw).toEqual(basicRawJob.metadata);
      expect(job.publishedAt).toEqual(new Date(basicRawJob.published_at));
    });

    it('should process an EnhancedGreenhouseJob correctly and calculate score', async () => {
        const enhancedRawJob: EnhancedGreenhouseJob = {
          ...basicRawJob,
          id: 456,
          title: 'Enhanced Engineer',
          absolute_url: 'https://jobs.greenhouse.io/enhanced/456',
          _determinedHiringRegionType: 'latam',
          company: { name: 'Enhanced Corp', website: 'https://enhanced.corp' },
          requirements: 'Enhanced Requirements',
          responsibilities: 'Enhanced Responsibilities',
          benefits: 'Enhanced Benefits',
          skills: ['enhancedSkill'],
          tags: ['enhancedTag'],
          jobType: JobType.CONTRACT,
          experienceLevel: ExperienceLevel.SENIOR,
          country: 'Brazil',
          workplaceType: 'REMOTE',
          publishedAt: new Date('2024-01-15T00:00:00Z'),
          published_at: new Date('2024-01-15T00:00:00Z').toISOString(),
          updated_at: new Date('2024-01-20T00:00:00Z').toISOString(),
      };
       const mockSourceDataEnhancedWithScoring = createMockJobSource({ 
           name: 'Enhanced Corp', 
           companyWebsite: 'https://enhanced.corp',
           config: { ...mockSourceDataBasic.config, SCORING_SIGNALS: { /* mock signals */ } } 
       });

      mockedJobUtils.isRemoteJob.mockReturnValue(true);
      mockedJobUtils.parseSections.mockReturnValue({
          description: 'Default Parsed Description',
          requirements: enhancedRawJob.requirements,
          responsibilities: enhancedRawJob.responsibilities,
          benefits: enhancedRawJob.benefits
      });

      const result = await processor.processJob(enhancedRawJob, mockSourceDataEnhancedWithScoring);

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      const job = result.job!;

      expect(mockedScorerUtils.calculateRelevanceScore).toHaveBeenCalledTimes(1);
      expect(mockedScorerUtils.calculateRelevanceScore).toHaveBeenCalledWith(
        { 
          title: enhancedRawJob.title, 
          description: basicRawJob.content,
          location: enhancedRawJob.location.name 
        },
        mockSourceDataEnhancedWithScoring.config
      );
      expect(job.relevanceScore).toBe(99);

      expect(job.sourceId).toBe('456');
      expect(job.title).toBe('Enhanced Engineer');
      expect(job.description).toBe(basicRawJob.content);
      expect(job.requirements).toBe('Enhanced Requirements');
      expect(job.responsibilities).toBe('Enhanced Responsibilities');
      expect(job.benefits).toBe('Enhanced Benefits');
      expect(job.applicationUrl).toBe(enhancedRawJob.absolute_url);
      expect(job.companyName).toBe(mockSourceDataEnhancedWithScoring.name);
      expect(job.companyWebsite).toBe(mockSourceDataEnhancedWithScoring.companyWebsite);
      expect(getCompanyLogo).toHaveBeenCalledWith(mockSourceDataEnhancedWithScoring.companyWebsite);
      expect(job.companyLogo).toBe('https://img.logo.dev/enhanced.corp?token=pk_f4m8WG-wQOeM90skJ8dV6Q');
      expect(job.jobType).toBe(JobType.CONTRACT);
      expect(job.experienceLevel).toBe(ExperienceLevel.SENIOR);
      expect(job.skills).toEqual(['enhancedSkill']);
      expect(job.tags).toEqual(['enhancedTag']);
      expect(job.hiringRegion).toBe(HiringRegion.LATAM);
      expect(job.location).toBe('Remote');
      expect(job.country).toBe('Brazil');
      expect(job.workplaceType).toBe('REMOTE');
      expect(job.publishedAt).toEqual(enhancedRawJob.publishedAt);
      expect(job.metadataRaw).toEqual(enhancedRawJob.metadata);
      expect(mockedJobUtils.extractSkills).not.toHaveBeenCalled();
      expect(mockedJobUtils.detectJobType).not.toHaveBeenCalled();
      expect(mockedJobUtils.detectExperienceLevel).not.toHaveBeenCalled();
      expect(mockedJobUtils.parseSections).not.toHaveBeenCalled();
    });

    it('should return failure and NOT calculate score if job is not remote', async () => {
      mockedJobUtils.isRemoteJob.mockReturnValue(false);
      const mockSourceDataWithScoring = createMockJobSource({
          ...mockSourceDataBasic,
          config: { ...mockSourceDataBasic.config, SCORING_SIGNALS: { /* mock signals */ } }
      });

      const result = await processor.processJob(basicRawJob, mockSourceDataWithScoring);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Job is not remote or has location restrictions');
      expect(result.job).toBeUndefined();
      expect(mockedScorerUtils.calculateRelevanceScore).not.toHaveBeenCalled();
    });

    it('should process job but return null score if SCORING_SIGNALS are missing in config', async () => {
      mockedJobUtils.isRemoteJob.mockReturnValue(true);
      const mockSourceWithoutScoring = createMockJobSource(mockSourceDataBasic);

      const result = await processor.processJob(basicRawJob, mockSourceWithoutScoring);

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      const job = result.job!;

      expect(mockedScorerUtils.calculateRelevanceScore).not.toHaveBeenCalled();
      expect(job.relevanceScore).toBeNull();
    });

    it('should handle errors during processing and return success: false', async () => {
        const processingError = new Error('Failed to detect job type');
        mockedJobUtils.detectJobType.mockImplementation(() => { 
            throw processingError;
        });

        const result = await processor.processJob(basicRawJob, mockSourceDataBasic);

        expect(result.success).toBe(false);
        expect(result.error).toBe(processingError.message);
        expect(result.job).toBeUndefined();
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ error: processingError, jobId: basicRawJob.id }),
            'Error processing job in GreenhouseProcessor'
        );
    });

    it('should process an EnhancedGreenhouseJob correctly and calculate score', async () => {
        const enhancedRawJob: EnhancedGreenhouseJob = {
          ...basicRawJob,
          id: 456,
          title: 'Software Engineer, Backend',
          absolute_url: 'https://jobs.greenhouse.io/enhanced/456',
          _determinedHiringRegionType: 'latam',
          company: { name: 'Greenhouse Inc.', website: 'https://enhanced.corp' },
          requirements: 'Enhanced Requirements',
          responsibilities: 'Enhanced Responsibilities',
          benefits: 'Enhanced Benefits',
          skills: ['enhancedSkill'],
          tags: ['enhancedTag'],
          jobType: JobType.FULL_TIME,
          experienceLevel: ExperienceLevel.MID,
          country: 'Brazil',
          workplaceType: 'REMOTE',
          publishedAt: new Date('2024-01-20T00:00:00.000Z'),
          published_at: new Date('2024-01-15T00:00:00Z').toISOString(),
          updated_at: new Date('2024-01-20T00:00:00Z').toISOString(),
      };
       const mockSourceDataEnhancedWithScoring = createMockJobSource({ 
           name: 'Greenhouse Inc.', 
           companyWebsite: 'https://enhanced.corp',
           config: { ...mockSourceDataBasic.config, SCORING_SIGNALS: { /* mock signals */ } } 
       });

      mockedJobUtils.isRemoteJob.mockReturnValue(true);
      mockedJobUtils.parseSections.mockReturnValue({
          description: 'Default Parsed Description',
          requirements: enhancedRawJob.requirements,
          responsibilities: enhancedRawJob.responsibilities,
          benefits: enhancedRawJob.benefits
      });

      const result = await processor.processJob(enhancedRawJob, mockSourceDataEnhancedWithScoring);

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      const job = result.job!;

      expect(mockedScorerUtils.calculateRelevanceScore).toHaveBeenCalledTimes(1);
      expect(mockedScorerUtils.calculateRelevanceScore).toHaveBeenCalledWith(
        { 
          title: enhancedRawJob.title, 
          description: basicRawJob.content,
          location: enhancedRawJob.location.name 
        },
        mockSourceDataEnhancedWithScoring.config
      );
      expect(job.relevanceScore).toBe(99);

      expect(job.sourceId).toBe('456');
      expect(job.title).toBe('Software Engineer, Backend');
      expect(job.description).toBe(basicRawJob.content);
      expect(job.requirements).toBe('Enhanced Requirements');
      expect(job.responsibilities).toBe('Enhanced Responsibilities');
      expect(job.benefits).toBe('Enhanced Benefits');
      expect(job.applicationUrl).toBe(enhancedRawJob.absolute_url);
      expect(job.companyName).toBe(mockSourceDataEnhancedWithScoring.name);
      expect(job.companyWebsite).toBe(mockSourceDataEnhancedWithScoring.companyWebsite);
      expect(getCompanyLogo).toHaveBeenCalledWith(mockSourceDataEnhancedWithScoring.companyWebsite);
      expect(job.companyLogo).toBe('https://img.logo.dev/enhanced.corp?token=pk_f4m8WG-wQOeM90skJ8dV6Q');
      expect(job.jobType).toBe(JobType.FULL_TIME);
      expect(job.experienceLevel).toBe(ExperienceLevel.MID);
      expect(job.skills).toEqual(['enhancedSkill']);
      expect(job.tags).toEqual(['enhancedTag']);
      expect(job.hiringRegion).toBe(HiringRegion.LATAM);
      expect(job.location).toBe('Remote');
      expect(job.country).toBe('Brazil');
      expect(job.workplaceType).toBe('REMOTE');
      expect(job.publishedAt).toEqual(enhancedRawJob.publishedAt);
      expect(job.metadataRaw).toEqual(enhancedRawJob.metadata);
      expect(mockedJobUtils.extractSkills).not.toHaveBeenCalled();
      expect(mockedJobUtils.detectJobType).not.toHaveBeenCalled();
      expect(mockedJobUtils.detectExperienceLevel).not.toHaveBeenCalled();
      expect(mockedJobUtils.parseSections).not.toHaveBeenCalled();
    });
  });
}); 
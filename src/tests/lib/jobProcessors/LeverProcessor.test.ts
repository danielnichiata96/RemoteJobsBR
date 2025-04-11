import axios from 'axios';
import { LeverProcessor } from '@/lib/jobProcessors/LeverProcessor';
import { LeverBasicJobData } from '@/lib/jobProcessors/types';
import { JobType, ExperienceLevel } from '@prisma/client';
import pino from 'pino';

// Mock dependencies
jest.mock('axios');
jest.mock('@/lib/utils/jobUtils', () => ({
  cleanHtml: jest.fn((html) => html), // Simple passthrough for testing
  parseSections: jest.fn((content) => ({ 
      description: content, 
      requirements: 'Extracted Requirements', 
      responsibilities: 'Extracted Responsibilities', 
      benefits: 'Extracted Benefits' 
  })),
  extractSkills: jest.fn((content) => ['React', 'Node.js']), // Mock skills
  detectJobType: jest.fn((title, content) => JobType.FULL_TIME), // Mock type
  detectExperienceLevel: jest.fn((title, content) => ExperienceLevel.SENIOR), // Mock level
  isRemoteJob: jest.fn((location, content) => location.toLowerCase().includes('remote')), // Basic remote check mock
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger), // Return self for child logger
} as unknown as pino.Logger;

// Sample individual Lever job page HTML (simplified)
const mockLeverJobPageHtml = `
<html>
  <body>
    <h1>Senior Software Engineer</h1>
    <div class="section-wrapper company-description">
        Company Info...
    </div>
    <div class="section-wrapper" data-qa="job-description">
        <h2>Job Description</h2>
        <p>This is the main description.</p>
        <h3>Responsibilities</h3>
        <ul><li>Build features</li></ul>
        <h3>Basic Qualifications</h3>
        <ul><li>Degree Required</li></ul>
        <h3>Preferred Qualifications</h3>
        <ul><li>Masters Degree</li></ul>
        <h3>Benefits</h3>
        <ul><li>Health insurance</li><li>401k</li></ul>
    </div>
    <div class="section-wrapper compensation">
        Compensation info...
    </div>
    <div class="post-listing-category">
        Location: Remote - Americas
    </div>
  </body>
</html>
`;

const mockNonRemoteJobPageHtml = `
<html>
  <body>
    <h1>Office Manager</h1>
    <div data-qa="job-description">
        <p>Manage the office.</p>
    </div>
    <div class="post-listing-category">
        Location: London, UK
    </div>
  </body>
</html>
`;

describe('LeverProcessor', () => {
  let leverProcessor: LeverProcessor;

  beforeEach(() => {
    leverProcessor = new LeverProcessor();
    jest.clearAllMocks();
  });

  const mockRawJobData: LeverBasicJobData = {
    sourceId: 'job123',
    title: 'Senior Software Engineer',
    applicationUrl: 'https://jobs.lever.co/testco/job123',
    location: 'Remote - Americas', // From list page
    department: 'Engineering',
    companyName: 'TestCo',
  };

  test('should fetch, parse, and standardize a remote job successfully', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockLeverJobPageHtml });
    
    const result = await leverProcessor.processJob(mockRawJobData, mockLogger);

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith(mockRawJobData.applicationUrl, expect.any(Object));

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.job).toBeDefined();

    const job = result.job!;
    expect(job.source).toBe('lever');
    expect(job.sourceId).toBe('job123');
    expect(job.title).toBe('Senior Software Engineer');
    expect(job.description).toContain('This is the main description.');
    expect(job.requirements).toBe('Extracted Requirements'); // From mocked parseSections
    expect(job.responsibilities).toBe('Extracted Responsibilities');
    expect(job.benefits).toBe('Extracted Benefits');
    expect(job.skills).toEqual(['React', 'Node.js']); // From mocked extractSkills
    expect(job.tags).toEqual(['React', 'Node.js']);
    expect(job.jobType).toBe(JobType.FULL_TIME); // From mocked detectJobType
    expect(job.experienceLevel).toBe(ExperienceLevel.SENIOR); // From mocked detectExperienceLevel
    expect(job.location).toBe('Remote - Americas'); // Uses location from input data
    expect(job.country).toBe('Worldwide'); // Default placeholder
    expect(job.workplaceType).toBe('REMOTE');
    expect(job.applicationUrl).toBe(mockRawJobData.applicationUrl);
    expect(job.companyName).toBe('TestCo');
    expect(job.companyLogo).toBeNull(); // Not extracted
    expect(job.publishedAt).toBeInstanceOf(Date);
    expect(job.status).toBe('ACTIVE');
    expect(job.company).toBeDefined();
    expect(job.company?.connectOrCreate?.where?.name).toBe('TestCo');

    expect(mockLogger.info).toHaveBeenCalledWith('Successfully processed job details.');
  });

  test('should return success:false for non-remote jobs', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockNonRemoteJobPageHtml });
    const nonRemoteRawData = { ...mockRawJobData, location: 'London, UK' }; // Override location
    
    const result = await leverProcessor.processJob(nonRemoteRawData, mockLogger);

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Job is not remote');
    expect(result.job).toBeUndefined();
    expect(mockLogger.info).toHaveBeenCalledWith('Skipping job - determined not remote based on location/content.');
  });

  test('should handle Axios error when fetching job page', async () => {
    const axiosError = new Error('Fetch failed') as AxiosError;
    axiosError.isAxiosError = true;
    mockedAxios.get.mockRejectedValue(axiosError);

    const result = await leverProcessor.processJob(mockRawJobData, mockLogger);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Fetch failed');
    expect(result.job).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ error: axiosError }), expect.stringContaining('Error processing individual job page'));
  });

  test('should handle non-Axios error during processing', async () => {
    const genericError = new Error('Parsing failed');
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockLeverJobPageHtml });
    // Make one of the mocked utils throw an error
    const utils = require('@/lib/utils/jobUtils');
    utils.extractSkills.mockImplementationOnce(() => { throw genericError; });

    const result = await leverProcessor.processJob(mockRawJobData, mockLogger);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Parsing failed');
    expect(result.job).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ error: genericError }), expect.stringContaining('Error processing individual job page'));
  });

  test('should handle failure to fetch job page HTML (non-200 status)', async () => {
     mockedAxios.get.mockResolvedValue({ status: 404, data: 'Not Found' });
 
     const result = await leverProcessor.processJob(mockRawJobData, mockLogger);
 
     expect(result.success).toBe(false);
     expect(result.error).toContain('Failed to fetch job page HTML (Status: 404)');
     expect(result.job).toBeUndefined();
     expect(mockLogger.error).toHaveBeenCalledWith({ status: 404 }, '❌ Failed to fetch individual job page HTML');
   });

}); 
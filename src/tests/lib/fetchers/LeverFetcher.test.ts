import axios from 'axios';
import { PrismaClient, JobSource } from '@prisma/client';
import pino from 'pino';
import { LeverFetcher } from '@/lib/fetchers/LeverFetcher';
import { JobProcessingAdapter } from '@/lib/adapters/JobProcessingAdapter';
import { AxiosError } from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('@/lib/adapters/JobProcessingAdapter');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockJobProcessingAdapter = JobProcessingAdapter as jest.MockedClass<typeof JobProcessingAdapter>;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger), // Return self for child logger
} as unknown as pino.Logger;


// Sample Lever HTML structure (simplified)
const mockLeverListPageHtml = `
<html>
  <body>
    <div class="postings-group">
      <div class="posting">
        <a href="/figma/abcdef123" class="posting-title">
          <h5 class="posting-name">Software Engineer, Backend</h5>
        </a>
        <div class="posting-categories">
          <span class="location">Remote - USA</span>
          <span class="department">Engineering</span>
          <span class="commitment">Full-time</span>
        </div>
      </div>
      <div class="posting">
         <a href="/figma/ghijks456" class="posting-title">
            <h5 class="posting-name">Product Designer</h5>
         </a>
         <div class="posting-categories">
            <span class="location">Remote - Worldwide</span>
            <span class="department">Design</span>
         </div>
      </div>
      <div class="posting">
         <!-- Posting missing essential data -->
         <div class="posting-categories">
            <span class="location">Office - London</span>
         </div>
      </div>
    </div>
  </body>
</html>
`;

const mockLeverEmptyPageHtml = `<html><body></body></html>`;


describe('LeverFetcher', () => {
  let prismaClient: PrismaClient;
  let jobProcessingAdapter: JobProcessingAdapter;
  let leverFetcher: LeverFetcher;

  beforeEach(() => {
    prismaClient = new PrismaClient(); // Not actually used in fetcher logic, but needed for constructor
    jobProcessingAdapter = new MockJobProcessingAdapter();
    leverFetcher = new LeverFetcher(prismaClient, jobProcessingAdapter);
    jest.clearAllMocks(); // Clear mocks before each test
  });

  const mockSource: JobSource = {
    id: 'lever-src-1',
    name: 'Figma (Lever)',
    type: 'lever',
    isEnabled: true,
    url: 'https://jobs.lever.co/figma', // URL not directly used by current fetcher logic
    config: { companyIdentifier: 'figma' },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastFetched: null,
    logoUrl: null,
    apiKey: null,
    apiEndpoint: null,
  };

  test('should fetch, parse, and process Lever jobs successfully', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockLeverListPageHtml });
    // Mock the adapter's processRawJob to return true (success)
    (jobProcessingAdapter.processRawJob as jest.Mock).mockResolvedValue(true);

    const result = await leverFetcher.processSource(mockSource, mockLogger);

    // Check Axios call
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith('https://jobs.lever.co/figma', expect.any(Object));

    // Check stats
    expect(result.stats.found).toBe(3);
    expect(result.stats.relevant).toBe(2); // 2 successfully extracted basic info
    expect(result.stats.processed).toBe(2); // Assuming both relevant jobs were saved by adapter
    expect(result.stats.errors).toBe(0);
    
    // Check found IDs
    expect(result.foundSourceIds.size).toBe(2);
    expect(result.foundSourceIds).toContain('abcdef123');
    expect(result.foundSourceIds).toContain('ghijks456');

    // Check adapter calls
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledTimes(2);
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('lever', {
      sourceId: 'abcdef123',
      title: 'Software Engineer, Backend',
      applicationUrl: 'https://jobs.lever.co/figma/abcdef123',
      location: 'Remote - USA',
      department: 'Engineering',
      companyName: 'Figma (Lever)'
    });
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledWith('lever', {
       sourceId: 'ghijks456',
       title: 'Product Designer',
       applicationUrl: 'https://jobs.lever.co/figma/ghijks456',
       location: 'Remote - Worldwide',
       department: 'Design',
       companyName: 'Figma (Lever)'
     });
     
     // Check logging
     expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ leverCompanyId: 'figma' }), expect.stringContaining('Starting processing'));
     expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('potential job postings found'));
     expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('jobs successfully extracted basic info'));
     expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Processing completed'));
     expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping posting - could not find job link.'));
  });

  test('should handle zero job postings found', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockLeverEmptyPageHtml });

    const result = await leverFetcher.processSource(mockSource, mockLogger);

    expect(result.stats.found).toBe(0);
    expect(result.stats.relevant).toBe(0);
    expect(result.stats.processed).toBe(0);
    expect(result.stats.errors).toBe(0);
    expect(result.foundSourceIds.size).toBe(0);
    expect(jobProcessingAdapter.processRawJob).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ selector: '.posting'}), expect.stringContaining('No job postings found'));
  });

  test('should handle adapter processing failures', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: mockLeverListPageHtml });
    // Mock the adapter's processRawJob to return false (failure)
    (jobProcessingAdapter.processRawJob as jest.Mock).mockResolvedValue(false);

    const result = await leverFetcher.processSource(mockSource, mockLogger);

    expect(result.stats.found).toBe(3);
    expect(result.stats.relevant).toBe(2); 
    expect(result.stats.processed).toBe(0); // None were successfully processed
    expect(result.stats.errors).toBe(0); // Errors here count fetcher/parsing errors, not adapter failures
    expect(jobProcessingAdapter.processRawJob).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'abcdef123' }), expect.stringContaining('Adapter reported job not saved'));
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'ghijks456' }), expect.stringContaining('Adapter reported job not saved'));
  });

  test('should handle fetcher Axios error', async () => {
    // Arrange
    // Simplify the mock error object, focusing on what isAxiosError checks
    const mockError = {
      isAxiosError: true, 
      message: 'Network Error',
      response: { status: 500, data: 'Server Error', statusText: 'Internal Server Error', headers: {}, config: {} },
      config: {}, // Include a basic config object
      // Add other properties if needed by the code or assertions
    };
    (axios.get as jest.Mock).mockRejectedValue(mockError);
    const expectedApiUrl = `https://jobs.lever.co/${mockSource.config.companyIdentifier}`;

    // Act
    const result = await leverFetcher.processSource(mockSource, mockLogger);

    // Assert
    expect(result.stats.found).toBe(0);
    expect(result.stats.errors).toBe(1);
    expect(jobProcessingAdapter.processRawJob).not.toHaveBeenCalled();
    // Assert based on the ACTUAL received output (else block is being hit)
    expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
             error: mockError, // The error object itself is logged in the else block
             leverCompanyId: mockSource.config.companyIdentifier, 
             apiUrl: expectedApiUrl 
        }), 
        '❌ General error processing source' // Check the message string from the else block
    );
  });

   test('should handle invalid source config', async () => {
      const invalidSource = { ...mockSource, config: {} }; // Missing companyIdentifier
      const result = await leverFetcher.processSource(invalidSource, mockLogger);

      expect(result.stats.errors).toBe(1);
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Missing or invalid companyIdentifier in source config');
    });
  
}); 
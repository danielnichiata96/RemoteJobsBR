// TODO: Revisit Prisma mocking strategy. Tests currently fail due to issues with mocking `@/lib/prisma` 
// in the context of this API route. Persistent errors include `PrismaClient is unable to run...` 
// and mocks not being called, despite trying various Jest mocking patterns (top-level, beforeAll, resetModules, etc.).
// The handler was refactored to use the shared client and error check simplified, but the mock still fails.
import { createMocks, MockResponse, MockRequest } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/jobs/[jobId]/track-click'; 
// Still don't need Prisma import if relying on error code
// import { Prisma } from '@prisma/client'; 

// --- Mocks Definitions (Top Level) ---
const mockJobUpdate = jest.fn();
// No longer need to mock disconnect if it's not called
// const mockDisconnect = jest.fn();

describe('API Route: /api/jobs/[jobId]/track-click', () => {

  // --- Mock Setup (Inside beforeAll) ---
  beforeAll(() => {
    // Reset modules before mocking
    jest.resetModules(); 
    
    // Mock ONLY the shared prisma instance import used by the handler HERE
    jest.mock('@/lib/prisma', () => ({
      prisma: {
        job: {
          update: mockJobUpdate,
        },
        // Remove disconnect from the mock if it's not used
        // $disconnect: mockDisconnect,
        // Provide a dummy $disconnect if the type requires it
        $disconnect: jest.fn(), // Dummy mock, won't be called
      },
    }));
    // Force require the mocked module within beforeAll AFTER resetting and mocking
    require('@/lib/prisma'); 
  });

  // --- Test Setup (Inside beforeEach) ---
  beforeEach(() => {
    mockJobUpdate.mockClear();
    // mockDisconnect.mockClear(); // No longer needed
  });

  // --- Tests (Remove disconnect assertions) ---

  it('should return 405 if method is not POST', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET', 
      query: { jobId: 'test-job-id' },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders()).toEqual({ allow: ['POST'], 'content-type': 'application/json' }); 
    expect(res._getJSONData()).toEqual({ message: 'Method GET Not Allowed' });
    expect(mockJobUpdate).not.toHaveBeenCalled();
    // REMOVE: expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should return 400 if jobId is missing or not a string', async () => {
    // Test missing
    let { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: {}, 
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ message: 'Invalid Job ID format' }); 
    expect(mockJobUpdate).not.toHaveBeenCalled();
    // REMOVE: expect(mockDisconnect).toHaveBeenCalledTimes(1); 

    // Test empty string 
    // mockDisconnect.mockClear(); // No longer needed
    ({ req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId: '' }, 
    }));
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ message: 'Invalid Job ID format' }); 
    expect(mockJobUpdate).not.toHaveBeenCalled();
    // REMOVE: expect(mockDisconnect).toHaveBeenCalledTimes(1); 

    // Test array
    // mockDisconnect.mockClear(); // No longer needed
    ({ req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId: ['array'] }, 
    }));
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ message: 'Invalid Job ID format' });
    expect(mockJobUpdate).not.toHaveBeenCalled();
    // REMOVE: expect(mockDisconnect).toHaveBeenCalledTimes(1); 
  });

  it('should track click and return 200 on successful update', async () => {
    const jobId = 'job123';
    const updatedClickCount = 11; 
    mockJobUpdate.mockResolvedValue({ id: jobId, clickCount: updatedClickCount });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId },
    });
    await handler(req, res);
    expect(mockJobUpdate).toHaveBeenCalledTimes(1);
    expect(mockJobUpdate).toHaveBeenCalledWith({
        where: { id: jobId },
        data: { clickCount: { increment: 1 } },
    });
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ 
      message: 'Click tracked successfully',
      clickCount: updatedClickCount 
    });
    // REMOVE: expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should return 404 if job is not found (Prisma P2025 error)', async () => {
    const jobId = 'jobNotFound';
    const prismaError = new Error('Simulated P2025') as any;
    prismaError.code = 'P2025'; 
    mockJobUpdate.mockRejectedValue(prismaError); 
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId },
    });
    await handler(req, res);
    expect(mockJobUpdate).toHaveBeenCalledTimes(1);
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ message: 'Job not found to track click' }); 
    // REMOVE: expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should return 500 for other database errors', async () => {
    const jobId = 'jobDbError';
    const genericError = new Error('Some database connection issue');
    mockJobUpdate.mockRejectedValue(genericError);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId },
    });
    await handler(req, res);
    expect(mockJobUpdate).toHaveBeenCalledTimes(1);
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ message: 'Internal server error tracking click' });
    expect(consoleErrorSpy).toHaveBeenCalledWith("API Error tracking job click:", genericError);
    // REMOVE: expect(mockDisconnect).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });
});
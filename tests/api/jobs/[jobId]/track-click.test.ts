import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/jobs/[jobId]/track-click';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      update: jest.fn(),
    },
    // Mock $disconnect if needed, though usually not critical for tests
    $disconnect: jest.fn(), 
  },
}));

// Helper to create Prisma errors
const createPrismaError = (code: string): Prisma.PrismaClientKnownRequestError => {
  return new Prisma.PrismaClientKnownRequestError('Mock Prisma Error', { code, clientVersion: 'mock' });
};

describe('API Route: /api/jobs/[jobId]/track-click', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should return 405 if method is not POST', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET', // Use a non-POST method
      query: { jobId: 'job123' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders()).toEqual(expect.objectContaining({ allow: 'POST' }));
    expect(JSON.parse(res._getData())).toEqual({ message: 'Method GET Not Allowed' });
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('should return 400 if jobId is missing or invalid', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: {}, // No jobId
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Invalid Job ID format' });
    expect(prisma.job.update).not.toHaveBeenCalled();
    
    // Test with non-string jobId (though Next.js usually provides strings)
     const { req: req2, res: res2 } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId: ['array', 'is', 'invalid'] },
    });
    await handler(req2, res2);
    expect(res2._getStatusCode()).toBe(400);
    expect(JSON.parse(res2._getData())).toEqual({ message: 'Invalid Job ID format' });
  });

  it('should track click and return 200 on successful update', async () => {
    const jobId = 'job123';
    const updatedClickCount = 11;
    (prisma.job.update as jest.Mock).mockResolvedValue({ id: jobId, clickCount: updatedClickCount });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId },
    });

    await handler(req, res);

    expect(prisma.job.update).toHaveBeenCalledTimes(1);
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: jobId },
      data: {
        clickCount: { increment: 1 },
      },
    });
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Click tracked successfully',
      clickCount: updatedClickCount,
    });
  });

  it('should return 404 if job is not found (Prisma P2025 error)', async () => {
    const jobId = 'jobNotFound';
    const prismaError = createPrismaError('P2025');
    (prisma.job.update as jest.Mock).mockRejectedValue(prismaError);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId },
    });

    await handler(req, res);

    expect(prisma.job.update).toHaveBeenCalledTimes(1);
    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Job not found to track click' });
  });

  it('should return 500 for other database errors', async () => {
    const jobId = 'jobDbError';
    const genericError = new Error('Some database connection issue');
    (prisma.job.update as jest.Mock).mockRejectedValue(genericError);

    // Mock console.error to avoid polluting test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { jobId },
    });

    await handler(req, res);

    expect(prisma.job.update).toHaveBeenCalledTimes(1);
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Internal server error tracking click' });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
}); 
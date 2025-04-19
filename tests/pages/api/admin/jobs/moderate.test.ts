import { createMocks } from 'node-mocks-http';
import { PrismaClient, JobStatus } from '@prisma/client';
import handler from '../../../../../src/pages/api/admin/jobs/moderate';

// Mock Prisma client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    job: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    JobStatus: { 
      PENDING_REVIEW: 'PENDING_REVIEW',
      ACTIVE: 'ACTIVE',
      REJECTED: 'REJECTED',
      // ... other statuses
    }
  };
});

// Mock pino logger
jest.mock('pino', () => jest.fn(() => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
})));

// Mock zod (Optional, but good practice if complex logic depended on it)
// jest.mock('zod');

const prismaMock = new PrismaClient() as jest.Mocked<PrismaClient>;

describe('/api/admin/jobs/moderate API Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prismaMock.job.findUnique as jest.Mock).mockReset();
    (prismaMock.job.update as jest.Mock).mockReset();
  });

  it('should return 405 if method is not POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData().message).toContain('Method GET Not Allowed');
    expect(res._getHeaders().allow).toEqual(['POST']);
  });

  it('should return 400 if request body is invalid (missing jobId)', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { action: 'APPROVE' }, // Missing jobId
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().message).toBe('Invalid request body');
    // Optionally check for specific Zod error messages if needed
  });

    it('should return 400 if request body is invalid (bad action)', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { jobId: '123e4567-e89b-12d3-a456-426614174000', action: 'DELETE' }, // Use valid UUID format
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().message).toBe('Invalid request body');
  });

  it('should return 404 if job is not found', async () => {
    (prismaMock.job.findUnique as jest.Mock).mockResolvedValue(null);
    const jobId = '123e4567-e89b-12d3-a456-426614174001'; // Use valid UUID format
    const { req, res } = createMocks({
      method: 'POST',
      body: { jobId, action: 'APPROVE' },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData().message).toBe('Job not found');
    expect(prismaMock.job.findUnique).toHaveBeenCalledWith({ where: { id: jobId } });
  });

  it('should approve the job successfully', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174002'; // Use valid UUID format
    const mockJob = { id: jobId, status: JobStatus.PENDING_REVIEW };
    const updatedJob = { ...mockJob, status: JobStatus.ACTIVE };

    (prismaMock.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
    (prismaMock.job.update as jest.Mock).mockResolvedValue(updatedJob);

    const { req, res } = createMocks({
      method: 'POST',
      body: { jobId, action: 'APPROVE' },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().message).toBe('Job approved successfully.');
    expect(res._getJSONData().jobId).toBe(jobId);
    expect(res._getJSONData().newStatus).toBe(JobStatus.ACTIVE);
    expect(prismaMock.job.findUnique).toHaveBeenCalledWith({ where: { id: jobId } });
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: jobId },
      data: {
        status: JobStatus.ACTIVE,
      },
    });
  });

  it('should reject the job successfully', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174003'; // Use valid UUID format
    const mockJob = { id: jobId, status: JobStatus.PENDING_REVIEW };
    const updatedJob = { ...mockJob, status: JobStatus.REJECTED };

    (prismaMock.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
    (prismaMock.job.update as jest.Mock).mockResolvedValue(updatedJob);

    const { req, res } = createMocks({
      method: 'POST',
      body: { jobId, action: 'REJECT' },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().message).toBe('Job rejected successfully.');
    expect(res._getJSONData().jobId).toBe(jobId);
    expect(res._getJSONData().newStatus).toBe(JobStatus.REJECTED);
    expect(prismaMock.job.findUnique).toHaveBeenCalledWith({ where: { id: jobId } });
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: jobId },
      data: {
        status: JobStatus.REJECTED,
      },
    });
  });

  it('should return 500 if findUnique fails', async () => {
    const dbError = new Error('Find failed');
    (prismaMock.job.findUnique as jest.Mock).mockRejectedValue(dbError);
    const jobId = '123e4567-e89b-12d3-a456-426614174004'; // Use valid UUID format
    const { req, res } = createMocks({
      method: 'POST',
      body: { jobId, action: 'APPROVE' },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData().message).toBe('Internal Server Error');
  });

  it('should return 500 if update fails', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174005'; // Use valid UUID format
    const mockJob = { id: jobId, status: JobStatus.PENDING_REVIEW };
    const dbError = new Error('Update failed');
    (prismaMock.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
    (prismaMock.job.update as jest.Mock).mockRejectedValue(dbError);

    const { req, res } = createMocks({
      method: 'POST',
      body: { jobId, action: 'APPROVE' },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData().message).toBe('Internal Server Error');
  });
}); 
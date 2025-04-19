import { createMocks } from 'node-mocks-http';
import { PrismaClient, JobStatus } from '@prisma/client';
import handler from '../../../../../src/pages/api/admin/jobs/pending';

// Mock Prisma client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    job: {
      findMany: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    JobStatus: { // Make sure enums are available if needed
      PENDING_REVIEW: 'PENDING_REVIEW',
      ACTIVE: 'ACTIVE',
      // ... other statuses
    },
  };
});

// Mock pino logger
jest.mock('pino', () => jest.fn(() => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
})));

const prismaMock = new PrismaClient() as jest.Mocked<PrismaClient>; // Use mocked type

describe('/api/admin/jobs/pending API Handler', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    (prismaMock.job.findMany as jest.Mock).mockReset();
  });

  it('should return 405 if method is not GET', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData().message).toContain('Method POST Not Allowed');
    expect(res._getHeaders().allow).toEqual(['GET']);
  });

  it('should return pending jobs with company data on GET request', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        status: JobStatus.PENDING_REVIEW,
        updatedAt: new Date(),
        title: 'Pending Job 1',
        source: 'TestSource',
        sourceId: 'ts1',
        company: { name: 'Test Company 1', logo: 'logo1.png' },
      },
      {
        id: 'job-2',
        status: JobStatus.PENDING_REVIEW,
        updatedAt: new Date(),
        title: 'Pending Job 2',
        source: 'TestSource',
        sourceId: 'ts2',
        company: { name: 'Test Company 2', logo: null },
      },
    ];

    (prismaMock.job.findMany as jest.Mock).mockResolvedValue(mockJobs);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = res._getJSONData();
    expect(responseData.jobs).toHaveLength(2);
    expect(responseData.jobs[0].id).toBe('job-1');
    expect(responseData.jobs[0].company.name).toBe('Test Company 1');
    expect(responseData.jobs[1].id).toBe('job-2');
    expect(responseData.jobs[1].company.name).toBe('Test Company 2');
    expect(responseData.jobs[1].company.logo).toBeNull();
    expect(prismaMock.job.findMany).toHaveBeenCalledWith({
      where: {
        status: JobStatus.PENDING_REVIEW,
      },
      include: {
        company: {
          select: {
            name: true,
            logo: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  });

  it('should return an empty array if no pending jobs are found', async () => {
    (prismaMock.job.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().jobs).toEqual([]);
  });

  it('should return 500 if there is a database error', async () => {
    const dbError = new Error('Database connection failed');
    (prismaMock.job.findMany as jest.Mock).mockRejectedValue(dbError);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData().message).toBe('Internal Server Error fetching pending jobs');
  });
}); 
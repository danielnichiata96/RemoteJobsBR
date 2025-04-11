import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/jobs/search';
import { prisma } from '@/lib/prisma';

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Jobs Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 405 for non-GET requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        error: expect.any(String),
      })
    );
  });

  it('returns jobs with pagination for valid GET request', async () => {
    // Setup mock job data
    const mockJobs = [
      {
        id: 'job1',
        title: 'Frontend Developer',
        companyId: 'company1',
        company: { name: 'TechCorp', logoUrl: null },
        location: 'Remote - Worldwide',
        country: 'Worldwide',
        minSalary: 80000,
        maxSalary: 120000,
        currency: 'USD',
        salaryCycle: 'year',
        jobType: 'FULL_TIME',
        experienceLevel: 'MID',
        workplaceType: 'REMOTE',
        tags: ['React', 'JavaScript'],
        visas: [],
        languages: ['English'],
        createdAt: new Date('2023-01-01'),
        publishedAt: new Date('2023-01-01'),
        viewCount: 100,
        _count: { applications: 5, savedBy: 10 }
      },
    ];

    // Mock Prisma responses
    (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);
    (prisma.job.count as jest.Mock).mockResolvedValue(1);

    // Create mock request with search parameters
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: {
        q: 'frontend',
        page: '1',
        limit: '10',
        jobType: 'FULL_TIME',
        remote: 'true',
      },
    });

    await handler(req, res);

    // Assert response
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    
    expect(data).toHaveProperty('jobs');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination).toEqual({
      totalCount: 1,
      totalPages: 1,
      currentPage: 1,
      pageSize: 10,
      hasNextPage: false,
      hasPrevPage: false,
    });

    // Verify prisma was called with correct parameters
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          OR: expect.any(Array),
          workplaceType: { equals: 'REMOTE' },
        }),
      })
    );
  });

  it('handles error during job search', async () => {
    // Mock Prisma error
    (prisma.job.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { q: 'frontend' },
    });

    // Mock console.error to avoid pollution in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await handler(req, res);

    // Assert response
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: expect.any(String),
    });

    consoleSpy.mockRestore();
  });

  it('applies filters correctly to search queries', async () => {
    // Mock Prisma responses
    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.count as jest.Mock).mockResolvedValue(0);

    // Create mock request with multiple filters
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: {
        q: 'developer',
        jobType: 'FULL_TIME,CONTRACT',
        experienceLevel: 'MID,SENIOR',
        location: 'Remote',
        minSalary: '80000',
        remote: 'true',
        sortBy: 'newest',
      },
    });

    await handler(req, res);

    // Check if prisma was called with correct filters
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { title: { contains: 'developer', mode: 'insensitive' } },
          ]),
          jobType: { in: ['FULL_TIME', 'CONTRACT'] },
          experienceLevel: { in: ['MID', 'SENIOR'] },
          location: { contains: 'Remote', mode: 'insensitive' },
          minSalary: { gte: 80000 },
          workplaceType: { equals: 'REMOTE' },
        }),
        orderBy: { createdAt: 'desc' },
      })
    );
  });
}); 
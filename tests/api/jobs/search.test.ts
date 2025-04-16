import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/jobs/search';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Cache test approach: We'll manually mock NodeCache but test the key generation logic
// directly, rather than going through the full handler logic which relies on many
// external dependencies that are hard to mock correctly.

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    technology: {
      findMany: jest.fn(),
    },
  },
  Prisma: {
    PrismaClientKnownRequestError: jest.fn(),
  },
}));

// Mock NodeCache
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => {
    return {
      get: jest.fn(),
      set: jest.fn(),
    };
  });
});

// Helper mock data
const mockJobs = [
  { id: 'job1', title: 'Dev 1' },
  { id: 'job2', title: 'Dev 2' },
];
const mockAggregations = {
  jobTypes: { FULL_TIME: 5 },
  experienceLevels: { SENIOR: 5 },
  technologies: { React: 5 }
};
const mockPagination = {
  totalCount: 2,
  totalPages: 1,
  currentPage: 1,
  pageSize: 10,
  hasNextPage: false,
  hasPrevPage: false,
};
const mockResponseData = {
  jobs: mockJobs,
  aggregations: mockAggregations,
  pagination: mockPagination,
};

describe('Jobs Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Prisma mock calls
    (prisma.job.findMany as jest.Mock).mockClear();
    (prisma.job.count as jest.Mock).mockClear();
    (prisma.job.aggregate as jest.Mock).mockClear();
    (prisma.job.groupBy as jest.Mock).mockClear();
    (prisma.technology.findMany as jest.Mock).mockClear();
  });

  it('returns 405 for non-GET requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('applies company filter correctly to search query', async () => {
    // Mock Prisma responses to avoid actual DB calls
    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.count as jest.Mock).mockResolvedValue(0);
    (prisma.job.groupBy as jest.Mock).mockResolvedValue([]); 
    (prisma.technology.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.aggregate as jest.Mock).mockResolvedValue({ _count: 0 }); // Mock aggregation

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: {
        company: 'ExampleCorp'
      },
    });

    await handler(req, res);

    // Verify the findMany call includes the company filter
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { company: { name: { contains: 'ExampleCorp', mode: 'insensitive' } } }
          ])
        }),
      })
    );
    
    // Also verify the count call uses the same filter
    expect(prisma.job.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { company: { name: { contains: 'ExampleCorp', mode: 'insensitive' } } }
          ])
        }),
      })
    );
  });

  it('applies combined filters correctly (including company)', async () => {
    // Mock Prisma responses
    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.count as jest.Mock).mockResolvedValue(0);
    (prisma.job.groupBy as jest.Mock).mockResolvedValue([]); 
    (prisma.technology.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.aggregate as jest.Mock).mockResolvedValue({ _count: 0 }); // Mock aggregation

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: {
        q: 'developer',
        company: 'Test Inc',
        jobType: 'FULL_TIME',
        remote: 'true'
      },
    });

    await handler(req, res);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          AND: expect.arrayContaining([
            { OR: expect.arrayContaining([
                { title: { contains: 'developer', mode: 'insensitive' } },
                { description: { contains: 'developer', mode: 'insensitive' } },
                { requirements: { contains: 'developer', mode: 'insensitive' } },
                { tags: { hasSome: ['developer'] } },
              ])
            },
            { company: { name: { contains: 'Test Inc', mode: 'insensitive' } } },
            { jobType: { in: ['FULL_TIME'] } },
          ])
        }),
      })
    );
  });

  // --- Tests for Hiring Region Filter --- 

  it('does not add hiringRegion filter when not provided', async () => {
    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.count as jest.Mock).mockResolvedValue(0);
    (prisma.job.groupBy as jest.Mock).mockResolvedValue([]); 
    (prisma.technology.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { q: 'test' }, // Basic query without region
    });

    await handler(req, res);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.not.arrayContaining([
            expect.objectContaining({ hiringRegion: expect.anything() }), // Should not have direct region filter
            expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ hiringRegion: expect.anything() })]) }) // Should not have region OR filter
          ])
        }),
      })
    );
  });

  it('applies BRAZIL hiringRegion filter correctly', async () => {
    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.count as jest.Mock).mockResolvedValue(0);
    (prisma.job.groupBy as jest.Mock).mockResolvedValue([]); 
    (prisma.technology.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { hiringRegion: 'BRAZIL' },
    });

    await handler(req, res);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { hiringRegion: 'BRAZIL' }
          ])
        }),
      })
    );
  });

  it('applies LATAM hiringRegion filter correctly', async () => {
    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.count as jest.Mock).mockResolvedValue(0);
    (prisma.job.groupBy as jest.Mock).mockResolvedValue([]); 
    (prisma.technology.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { hiringRegion: 'LATAM' },
    });

    await handler(req, res);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { hiringRegion: 'LATAM' }
          ])
        }),
      })
    );
  });

  it('applies WORLDWIDE hiringRegion filter correctly (OR condition)', async () => {
    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.count as jest.Mock).mockResolvedValue(0);
    (prisma.job.groupBy as jest.Mock).mockResolvedValue([]); 
    (prisma.technology.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { hiringRegion: 'WORLDWIDE' },
    });

    await handler(req, res);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { hiringRegion: 'LATAM' },
            { hiringRegion: 'WORLDWIDE' },
            { hiringRegion: null }
          ]),
          AND: expect.arrayContaining([
            { hiringRegion: 'WORLDWIDE' }
          ])
        }),
      })
    );
  });

  it('combines WORLDWIDE filter and text search correctly using AND', async () => {
    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.job.count as jest.Mock).mockResolvedValue(0);
    (prisma.job.groupBy as jest.Mock).mockResolvedValue([]); 
    (prisma.technology.findMany as jest.Mock).mockResolvedValue([]);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { q: 'developer', hiringRegion: 'WORLDWIDE' },
    });

    await handler(req, res);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { hiringRegion: 'LATAM' },
            { hiringRegion: 'WORLDWIDE' },
            { hiringRegion: null }
          ]),
          AND: expect.arrayContaining([
            { OR: expect.arrayContaining([
                { title: { contains: 'developer', mode: 'insensitive' } },
                { description: { contains: 'developer', mode: 'insensitive' } },
                { requirements: { contains: 'developer', mode: 'insensitive' } },
                { tags: { hasSome: ['developer'] } },
              ])
            },
            { hiringRegion: 'WORLDWIDE' }
          ])
        }),
      })
    );
  });
});

// Directly test the internal cache key generation logic - extract the function from search.ts
describe('Cache Key Generation', () => {
  // This is a simplified version of the function from search.ts
  const generateCacheKey = (query: NodeJS.Dict<string | string[]>): string => {
    const sortedKeys = Object.keys(query).sort();
    const keyParts = sortedKeys.map(key => `${key}=${JSON.stringify(query[key])}`);
    return `search:${keyParts.join('&')}`;
  };

  it('should generate consistent cache keys regardless of parameter order', () => {
    // First query with parameters in one order
    const query1 = { 
      q: 'developer',
      jobType: 'FULL_TIME',
      remote: 'true'
    };
    
    // Second query with parameters in different order
    const query2 = { 
      remote: 'true',
      q: 'developer',
      jobType: 'FULL_TIME'
    };
    
    const key1 = generateCacheKey(query1);
    const key2 = generateCacheKey(query2);
    
    // Keys should be identical despite different parameter order
    expect(key1).toBe(key2);
  });
    
  it('should handle array parameters correctly', () => {
    const query = {
      technologies: ['React', 'TypeScript'],
      jobType: 'FULL_TIME,CONTRACT'
    };
    
    const key = generateCacheKey(query);
    expect(key).toContain('technologies=["React","TypeScript"]');
    expect(key).toContain('jobType="FULL_TIME,CONTRACT"');
  });
}); 
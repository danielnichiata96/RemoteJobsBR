// tests/api/users/me/saved-jobs.test.ts

// TODO: Test suite currently fails due to persistent ESM syntax errors.
// Similar to tests/api/jobs/saved/[jobId].test.ts, Jest/SWC struggles with
// nested ESM dependencies (e.g., preact-render-to-string) from next-auth.
// Requires further Jest/SWC configuration investigation.

import { createMocks } from 'node-mocks-http'; // Removed MockResponse, MockRequest as they weren't used directly
import handler from '@/pages/api/users/me/saved-jobs'; // Adjust path
import { getServerSession } from 'next-auth/next';
// REMOVED: import prisma from '@/lib/prisma';

// Mock next-auth
jest.mock('next-auth/next');
const mockGetServerSession = getServerSession as jest.Mock;

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  // Mock the named export 
  prisma: {
    savedJob: {
      findMany: jest.fn(),
    },
    // Add other models here if needed by this test file or globally in jest.setup.js
  }
}));

const mockUserId = 'user-123';
const mockSavedJobEntries = [
  {
    id: 'saved1',
    createdAt: new Date(),
    jobId: 'job1',
    candidateId: mockUserId,
    job: {
      id: 'job1',
      title: 'Job 1',
      company: { id: 'comp1', name: 'Company A', logo: 'logoA.png', isVerified: true, industry: 'Tech' } // Added missing fields used in include
      // Add other necessary Job fields that are included in the API response
    }
  },
  {
    id: 'saved2',
    createdAt: new Date(),
    jobId: 'job2',
    candidateId: mockUserId,
    job: {
      id: 'job2',
      title: 'Job 2',
      company: { id: 'comp2', name: 'Company B', logo: null, isVerified: false, industry: 'Finance' } // Added missing fields used in include
    }
  },
];

// Slightly adjust expected response based on prisma include select
const expectedApiResponse = mockSavedJobEntries.map(entry => ({
  ...entry.job, // Spreading the full job object first
  company: { // Explicitly selecting fields as per prisma query
    id: entry.job.company.id,
    name: entry.job.company.name,
    logo: entry.job.company.logo || null,
    isVerified: entry.job.company.isVerified,
    industry: entry.job.company.industry,
  },
  savedAt: entry.createdAt, // Keep this mapping
  isSaved: true, // Keep this indicator
}));


describe('/api/users/me/saved-jobs', () => {
  beforeEach(() => {
    // ADDED: require prisma mock inside beforeEach
    const { prisma } = require('@/lib/prisma');
    jest.clearAllMocks();
    mockGetServerSession.mockClear();
    // ADDED: Clear mock using the required prisma instance
    (prisma.savedJob.findMany as jest.Mock).mockClear();
  });

  it('should return 401 if user is not authenticated', async () => {
    // ADDED: import prisma (will resolve to mock due to jest.mock)
    const { prisma } = require('@/lib/prisma');
    mockGetServerSession.mockResolvedValueOnce(null);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Unauthorized: User not logged in.' });
  });

  it('should return 405 if method is not GET', async () => {
    // ADDED: import prisma
    const { prisma } = require('@/lib/prisma');
    mockGetServerSession.mockResolvedValueOnce({ user: { id: mockUserId } });
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Method POST Not Allowed' });
  });

  it('should return saved jobs for authenticated user', async () => {
    // ADDED: import prisma
    const { prisma } = require('@/lib/prisma');
    mockGetServerSession.mockResolvedValueOnce({ user: { id: mockUserId } });
    (prisma.savedJob.findMany as jest.Mock).mockResolvedValueOnce(mockSavedJobEntries);

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    // Check if the mock was called with the correct arguments
    expect(prisma.savedJob.findMany).toHaveBeenCalledWith({
      where: { candidateId: mockUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            company: {
              select: { // Ensure select matches expected structure
                id: true,
                name: true,
                logo: true,
                isVerified: true,
                industry: true,
              },
            },
          },
        },
      },
    });

    // Compare omitting the date which can be tricky due to serialization
    const responseData = JSON.parse(res._getData());
    // Ensure responseData matches expected structure based on mapping AND prisma includes
    expect(responseData).toHaveLength(expectedApiResponse.length);
    // Use .toMatchObject for flexibility, especially with dates
    expect(responseData[0]).toMatchObject({ ...expectedApiResponse[0], savedAt: expect.any(String) });
    expect(responseData[1]).toMatchObject({ ...expectedApiResponse[1], savedAt: expect.any(String) });

    // More specific checks if needed
    expect(responseData[0].company.name).toBe('Company A');
    expect(responseData[1].company.name).toBe('Company B');
    expect(responseData[0].isSaved).toBe(true);
  });


  it('should return empty array if user has no saved jobs', async () => {
    // ADDED: import prisma
    const { prisma } = require('@/lib/prisma');
    mockGetServerSession.mockResolvedValueOnce({ user: { id: mockUserId } });
    (prisma.savedJob.findMany as jest.Mock).mockResolvedValueOnce([]); // No saved jobs

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual([]);
     expect(prisma.savedJob.findMany).toHaveBeenCalledTimes(1); // Ensure mock was called
  });

  it('should return 500 if prisma query fails', async () => {
    // ADDED: import prisma
    const { prisma } = require('@/lib/prisma');
    mockGetServerSession.mockResolvedValueOnce({ user: { id: mockUserId } });
    const dbError = new Error('DB Error');
    (prisma.savedJob.findMany as jest.Mock).mockRejectedValueOnce(dbError);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Internal server error while fetching saved jobs.' });
    expect(prisma.savedJob.findMany).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching saved jobs:', dbError); // Check error message
    consoleErrorSpy.mockRestore();
  });
});
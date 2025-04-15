import { createMocks } from 'node-mocks-http';
import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../../../src/lib/prisma'; // Adjusted path
import handler from '../../../../../src/pages/api/admin/sources/health'; // Adjusted path
import { UserRole, JobSourceRunStats } from '@prisma/client';

// --- Mocks ---

// Mock Prisma
jest.mock('../../../../../src/lib/prisma', () => ({
  prisma: {
    jobSource: {
      findMany: jest.fn(),
    },
  },
}));

// Mock NextAuth getServerSession
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

// Mock the default export of next-auth
jest.mock('next-auth', () => ({
  __esModule: true, // Handle ES module interop
  default: jest.fn(), // Mock the default export (NextAuth function)
}));

// Mock pino logger (optional, can omit if not testing logs specifically)
jest.mock('pino', () => jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn().mockReturnThis(),
})));

// Type helpers for mocks
const mockGetServerSession = getServerSession as jest.Mock;
const mockPrismaJobSourceFindMany = prisma.jobSource.findMany as jest.Mock;

// --- Test Suite ---

describe('/api/admin/sources/health API Route', () => {

  beforeEach(() => {
    // Clear mocks before each test
    mockGetServerSession.mockClear();
    mockPrismaJobSourceFindMany.mockClear();
  });

  it('should return 405 if method is not GET', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders()).toEqual(expect.objectContaining({ allow: ['GET'] }));
    expect(JSON.parse(res._getData())).toEqual({ message: 'Method POST Not Allowed' });
  });

  it('should return 403 if user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null); // Simulate no session
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Forbidden: Access denied' });
  });

  it('should return 403 if user is not an ADMIN', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: UserRole.CANDIDATE }, // Simulate non-admin user
      expires: 'some-date',
    });
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Forbidden: Access denied' });
  });

  it('should return 500 if database query fails', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: UserRole.ADMIN },
      expires: 'some-date',
    });
    mockPrismaJobSourceFindMany.mockRejectedValue(new Error('DB Error')); // Simulate DB error
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Internal Server Error' });
  });

  it('should return 200 and source data with calculated health status for ADMIN user', async () => {
    // --- Mock Data ---
    const mockSession = {
      user: { id: 'admin-1', role: UserRole.ADMIN },
      expires: 'some-date',
    };
    const mockRunHealthy: JobSourceRunStats = {
        id: 'run-1', jobSourceId: 'source-1', runStartedAt: new Date(Date.now() - 3600000), 
        runEndedAt: new Date(Date.now() - 3000000), status: 'SUCCESS', jobsFound: 10, 
        jobsRelevant: 8, jobsProcessed: 8, jobsErrored: 0, errorMessage: null, durationMs: 60000
    };
    const mockRunWarningError: JobSourceRunStats = {
        id: 'run-2', jobSourceId: 'source-2', runStartedAt: new Date(Date.now() - 7200000),
        runEndedAt: new Date(Date.now() - 7000000), status: 'PARTIAL_SUCCESS', jobsFound: 5, 
        jobsRelevant: 5, jobsProcessed: 3, jobsErrored: 2, errorMessage: 'Some jobs failed', durationMs: 200000
    };
    const mockRunFailure: JobSourceRunStats = {
        id: 'run-3', jobSourceId: 'source-3', runStartedAt: new Date(Date.now() - 100000), 
        runEndedAt: new Date(Date.now() - 50000), status: 'FAILURE', jobsFound: 0, 
        jobsRelevant: 0, jobsProcessed: 0, jobsErrored: 1, errorMessage: 'API Unreachable', durationMs: 50000
    };
    const mockRunStale: JobSourceRunStats = { // Healthy but old
        id: 'run-4', jobSourceId: 'source-4', runStartedAt: new Date(Date.now() - 5*24*60*60*1000),
        runEndedAt: new Date(Date.now() - 5*24*60*60*1000 + 60000), status: 'SUCCESS', jobsFound: 20, 
        jobsRelevant: 15, jobsProcessed: 15, jobsErrored: 0, errorMessage: null, durationMs: 60000
    };
     const mockRunEmpty: JobSourceRunStats = { // Successful but found nothing
        id: 'run-5', jobSourceId: 'source-5', runStartedAt: new Date(Date.now() - 120000),
        runEndedAt: new Date(Date.now() - 60000), status: 'SUCCESS', jobsFound: 0, 
        jobsRelevant: 0, jobsProcessed: 0, jobsErrored: 0, errorMessage: null, durationMs: 60000
    };
    
    const mockDbResponse = [
        { id: 'source-1', name: 'Healthy Source', type: 'greenhouse', isEnabled: true, lastFetched: new Date(), companyWebsite: null, config: {}, runStats: [mockRunHealthy] },
        { id: 'source-2', name: 'Warning Source', type: 'ashby', isEnabled: true, lastFetched: new Date(), companyWebsite: null, config: {}, runStats: [mockRunWarningError] },
        { id: 'source-3', name: 'Error Source', type: 'greenhouse', isEnabled: true, lastFetched: new Date(), companyWebsite: null, config: {}, runStats: [mockRunFailure] },
        { id: 'source-4', name: 'Stale Source', type: 'ashby', isEnabled: true, lastFetched: new Date(Date.now() - 6*24*60*60*1000), companyWebsite: null, config: {}, runStats: [mockRunStale] },
        { id: 'source-5', name: 'Empty Source', type: 'greenhouse', isEnabled: true, lastFetched: new Date(), companyWebsite: null, config: {}, runStats: [mockRunEmpty] },
        { id: 'source-6', name: 'Unknown Source', type: 'other', isEnabled: false, lastFetched: null, companyWebsite: null, config: {}, runStats: [] }, // No run stats
    ];

    // --- Setup Mocks ---
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrismaJobSourceFindMany.mockResolvedValue(mockDbResponse);

    const { req, res } = createMocks({
      method: 'GET',
    });

    // --- Execute Handler ---
    await handler(req, res);

    // --- Assertions ---
    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData).toHaveLength(mockDbResponse.length);

    // Check specific health statuses
    expect(responseData.find((s: any) => s.id === 'source-1').healthStatus).toBe('Healthy');
    expect(responseData.find((s: any) => s.id === 'source-2').healthStatus).toBe('Warning');
    expect(responseData.find((s: any) => s.id === 'source-3').healthStatus).toBe('Error');
    expect(responseData.find((s: any) => s.id === 'source-4').healthStatus).toBe('Warning'); // Stale
    expect(responseData.find((s: any) => s.id === 'source-5').healthStatus).toBe('Warning'); // Empty run
    expect(responseData.find((s: any) => s.id === 'source-6').healthStatus).toBe('Unknown');

    // Check that latestRun data is included
    expect(responseData.find((s: any) => s.id === 'source-1').latestRun.id).toBe('run-1');
    expect(responseData.find((s: any) => s.id === 'source-6').latestRun).toBeNull();

    // Check that the prisma query included the runStats correctly
    expect(mockPrismaJobSourceFindMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: {
            runStats: {
                orderBy: { runStartedAt: 'desc' },
                take: 1,
            },
        },
    });
  });
}); 
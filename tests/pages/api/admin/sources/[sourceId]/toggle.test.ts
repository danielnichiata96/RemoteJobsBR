import { createMocks } from 'node-mocks-http';
import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../../../src/lib/prisma'; // Adjust path
import handler from '../../../../../src/pages/api/admin/sources/[sourceId]/toggle'; // Adjust path
import { UserRole, JobSource } from '@prisma/client';

// --- Mocks ---

// Mock Prisma
jest.mock('../../../../../src/lib/prisma', () => ({
  prisma: {
    jobSource: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock NextAuth getServerSession
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

// Mock the default export of next-auth (needed if authOptions is complex)
jest.mock('next-auth', () => ({
  __esModule: true, // Handle ES module interop
  default: jest.fn(), // Mock the default export (NextAuth function)
}));

// Mock pino logger
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
const mockPrismaFindUnique = prisma.jobSource.findUnique as jest.Mock;
const mockPrismaUpdate = prisma.jobSource.update as jest.Mock;

// --- Test Suite ---

describe('/api/admin/sources/[sourceId]/toggle API Route', () => {

  const sourceId = 'test-source-id';
  const mockAdminSession = {
    user: { id: 'admin-user-id', role: UserRole.ADMIN },
    expires: 'some-future-date',
  };

  beforeEach(() => {
    // Clear mocks before each test
    mockGetServerSession.mockClear();
    mockPrismaFindUnique.mockClear();
    mockPrismaUpdate.mockClear();
  });

  it('should return 405 if method is not PATCH', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getHeaders()).toEqual(expect.objectContaining({ allow: ['PATCH'] }));
    expect(JSON.parse(res._getData())).toEqual({ message: 'Method GET Not Allowed' });
  });

  it('should return 403 if user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'PATCH', query: { sourceId } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(403);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Forbidden: Access denied' });
  });

  it('should return 403 if user is not an ADMIN', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'non-admin-id', role: UserRole.CANDIDATE },
      expires: 'some-date',
    });
    const { req, res } = createMocks({ method: 'PATCH', query: { sourceId } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(403);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Forbidden: Access denied' });
  });

  it('should return 400 if sourceId is missing', async () => {
    mockGetServerSession.mockResolvedValue(mockAdminSession);
    const { req, res } = createMocks({ method: 'PATCH', query: {} }); // No sourceId
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Bad Request: Missing or invalid sourceId' });
  });

  it('should return 404 if source is not found', async () => {
    mockGetServerSession.mockResolvedValue(mockAdminSession);
    mockPrismaFindUnique.mockResolvedValue(null); // Simulate source not found
    const { req, res } = createMocks({ method: 'PATCH', query: { sourceId } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
    expect(mockPrismaFindUnique).toHaveBeenCalledWith({ where: { id: sourceId } });
    expect(JSON.parse(res._getData())).toEqual({ message: 'Job source not found' });
  });

  it('should return 500 if findUnique fails', async () => {
    mockGetServerSession.mockResolvedValue(mockAdminSession);
    const dbError = new Error('Database find error');
    mockPrismaFindUnique.mockRejectedValue(dbError);
    const { req, res } = createMocks({ method: 'PATCH', query: { sourceId } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Internal Server Error' });
  });

  it('should return 500 if update fails', async () => {
    const mockSource: JobSource = {
        id: sourceId, name: 'Test', type: 'greenhouse', companyWebsite: null,
        isEnabled: true, logoUrl: null, config: {}, createdAt: new Date(),
        updatedAt: new Date(), lastFetched: null
    };
    mockGetServerSession.mockResolvedValue(mockAdminSession);
    mockPrismaFindUnique.mockResolvedValue(mockSource);
    const dbError = new Error('Database update error');
    mockPrismaUpdate.mockRejectedValue(dbError);
    const { req, res } = createMocks({ method: 'PATCH', query: { sourceId } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: sourceId },
        data: { isEnabled: !mockSource.isEnabled },
    });
    expect(JSON.parse(res._getData())).toEqual({ message: 'Internal Server Error' });
  });

  it('should successfully toggle source from enabled to disabled', async () => {
    const mockSourceEnabled: JobSource = {
        id: sourceId, name: 'Test Enabled', type: 'greenhouse', companyWebsite: 'https://test.com',
        isEnabled: true, logoUrl: null, config: { boardToken: 'test' }, createdAt: new Date(),
        updatedAt: new Date(), lastFetched: new Date()
    };
    const mockSourceDisabled = { ...mockSourceEnabled, isEnabled: false }; // Expected result

    mockGetServerSession.mockResolvedValue(mockAdminSession);
    mockPrismaFindUnique.mockResolvedValue(mockSourceEnabled);
    mockPrismaUpdate.mockResolvedValue(mockSourceDisabled); // Return the updated state

    const { req, res } = createMocks({ method: 'PATCH', query: { sourceId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockPrismaFindUnique).toHaveBeenCalledWith({ where: { id: sourceId } });
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: sourceId },
      data: { isEnabled: false }, // Should be toggled to false
    });
    const responseData = JSON.parse(res._getData());
    // Convert dates to ISO strings for comparison if necessary, or omit if not critical
    expect(responseData).toEqual(JSON.parse(JSON.stringify(mockSourceDisabled)));
  });

  it('should successfully toggle source from disabled to enabled', async () => {
    const mockSourceDisabled: JobSource = {
        id: sourceId, name: 'Test Disabled', type: 'ashby', companyWebsite: null,
        isEnabled: false, logoUrl: null, config: { jobBoardName: 'test' }, createdAt: new Date(),
        updatedAt: new Date(), lastFetched: null
    };
    const mockSourceEnabled = { ...mockSourceDisabled, isEnabled: true }; // Expected result

    mockGetServerSession.mockResolvedValue(mockAdminSession);
    mockPrismaFindUnique.mockResolvedValue(mockSourceDisabled);
    mockPrismaUpdate.mockResolvedValue(mockSourceEnabled); // Return the updated state

    const { req, res } = createMocks({ method: 'PATCH', query: { sourceId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockPrismaFindUnique).toHaveBeenCalledWith({ where: { id: sourceId } });
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: sourceId },
      data: { isEnabled: true }, // Should be toggled to true
    });
    const responseData = JSON.parse(res._getData());
    expect(responseData).toEqual(JSON.parse(JSON.stringify(mockSourceEnabled)));
  });
}); 
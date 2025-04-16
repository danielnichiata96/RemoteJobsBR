import { createMocks, MockResponse, MockRequest } from 'node-mocks-http';
import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../../../../src/lib/prisma'; // Adjusted path
import handler from '../../../../../../src/pages/api/admin/sources/[sourceId]/toggle'; // Adjusted path
import { UserRole, JobSource } from '@prisma/client';

// --- Mocks ---

// Mock Prisma
jest.mock('../../../../../../src/lib/prisma', () => ({
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

// Mock the default export of next-auth
jest.mock('next-auth', () => ({
    __esModule: true,
    default: jest.fn(),
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
const mockPrismaJobSourceFindUnique = prisma.jobSource.findUnique as jest.Mock;
const mockPrismaJobSourceUpdate = prisma.jobSource.update as jest.Mock;

// Type for HTTP mocks
type ApiRequest = MockRequest<any> & { query: { sourceId?: string } };
type ApiResponse = MockResponse<any>;


// --- Test Suite ---

describe('/api/admin/sources/[sourceId]/toggle API Route', () => {
    const testSourceId = 'test-source-id';
    const adminSession = {
        user: { id: 'admin-1', role: UserRole.ADMIN },
        expires: 'some-date',
    };
    const candidateSession = {
        user: { id: 'candidate-1', role: UserRole.CANDIDATE },
        expires: 'some-date',
    };

    beforeEach(() => {
        // Clear mocks before each test
        mockGetServerSession.mockClear();
        mockPrismaJobSourceFindUnique.mockClear();
        mockPrismaJobSourceUpdate.mockClear();
    });

    it('should return 405 if method is not PATCH', async () => {
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'GET',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(405);
        expect(res._getHeaders()).toEqual(expect.objectContaining({ allow: ['PATCH'] }));
        expect(JSON.parse(res._getData())).toEqual({ message: 'Method GET Not Allowed' });
    });

    it('should return 400 if sourceId is missing', async () => {
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'PATCH',
            query: {}, // No sourceId
        });
        mockGetServerSession.mockResolvedValue(adminSession); // Assume admin is logged in

        await handler(req, res);

        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Bad Request: Missing sourceId' });
    });

    it('should return 403 if user is not authenticated', async () => {
        mockGetServerSession.mockResolvedValue(null); // No session
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'PATCH',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(403);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Forbidden: Access denied' });
    });

    it('should return 403 if user is not an ADMIN', async () => {
        mockGetServerSession.mockResolvedValue(candidateSession); // Non-admin user
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'PATCH',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(403);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Forbidden: Access denied' });
    });

    it('should return 404 if job source is not found', async () => {
        mockGetServerSession.mockResolvedValue(adminSession);
        mockPrismaJobSourceFindUnique.mockResolvedValue(null); // Simulate not found
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'PATCH',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(mockPrismaJobSourceFindUnique).toHaveBeenCalledWith({ where: { id: testSourceId } });
        expect(res._getStatusCode()).toBe(404);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Job source not found' });
    });

    it('should return 500 if database find operation fails', async () => {
        mockGetServerSession.mockResolvedValue(adminSession);
        mockPrismaJobSourceFindUnique.mockRejectedValue(new Error('DB Find Error')); // Simulate DB error
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'PATCH',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(500);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Internal Server Error' });
    });

    it('should return 500 if database update operation fails', async () => {
        const mockSource: JobSource = {
            id: testSourceId, name: 'Test Source', type: 'greenhouse', isEnabled: false,
            lastFetched: null, createdAt: new Date(), updatedAt: new Date(), companyWebsite: null, config: {}
        };
        mockGetServerSession.mockResolvedValue(adminSession);
        mockPrismaJobSourceFindUnique.mockResolvedValue(mockSource);
        mockPrismaJobSourceUpdate.mockRejectedValue(new Error('DB Update Error')); // Simulate DB error
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'PATCH',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(mockPrismaJobSourceUpdate).toHaveBeenCalledWith({
            where: { id: testSourceId },
            data: { isEnabled: true },
        });
        expect(res._getStatusCode()).toBe(500);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Internal Server Error' });
    });

    it('should successfully toggle isEnabled from true to false', async () => {
        const initialEnabledState = true;
        const mockSource: JobSource = {
            id: testSourceId, name: 'Test Source', type: 'greenhouse', isEnabled: initialEnabledState,
            lastFetched: null, createdAt: new Date(), updatedAt: new Date(), companyWebsite: null, config: {}
        };
        const updatedSource = { ...mockSource, isEnabled: !initialEnabledState };

        mockGetServerSession.mockResolvedValue(adminSession);
        mockPrismaJobSourceFindUnique.mockResolvedValue(mockSource);
        mockPrismaJobSourceUpdate.mockResolvedValue(updatedSource); // Return updated source

        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'PATCH',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(mockPrismaJobSourceFindUnique).toHaveBeenCalledWith({ where: { id: testSourceId } });
        expect(mockPrismaJobSourceUpdate).toHaveBeenCalledWith({
            where: { id: testSourceId },
            data: { isEnabled: !initialEnabledState },
        });
        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({
            id: testSourceId,
            isEnabled: !initialEnabledState, // Should be false
        }));
    });

     it('should successfully toggle isEnabled from false to true', async () => {
        const initialEnabledState = false;
         const mockSource: JobSource = {
             id: testSourceId, name: 'Test Source', type: 'greenhouse', isEnabled: initialEnabledState,
             lastFetched: null, createdAt: new Date(), updatedAt: new Date(), companyWebsite: null, config: {}
         };
        const updatedSource = { ...mockSource, isEnabled: !initialEnabledState };

        mockGetServerSession.mockResolvedValue(adminSession);
        mockPrismaJobSourceFindUnique.mockResolvedValue(mockSource);
        mockPrismaJobSourceUpdate.mockResolvedValue(updatedSource);

        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'PATCH',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(mockPrismaJobSourceFindUnique).toHaveBeenCalledWith({ where: { id: testSourceId } });
        expect(mockPrismaJobSourceUpdate).toHaveBeenCalledWith({
            where: { id: testSourceId },
            data: { isEnabled: !initialEnabledState },
        });
        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({
            id: testSourceId,
            isEnabled: !initialEnabledState, // Should be true
        }));
    });
}); 